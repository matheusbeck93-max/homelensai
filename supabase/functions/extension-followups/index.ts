/**
 * extension-followups
 *
 * Single action-routed endpoint that powers the Chrome extension's
 * Smart Preference Follow-ups. Four actions:
 *
 *   get_state      → returns { preferences, dismissals, settings } so the
 *                    extension can render + filter follow-ups in one round-trip.
 *   update         → applies a validated patch to the user's preferences
 *                    (preferred_cities, budget_min/max, property_types,
 *                    min_bedrooms, min_bathrooms, min_sqft, target_cap_rate).
 *   dismiss        → records a dismissal in preference_followup_dismissals.
 *   save_exception → upserts into user_exception_properties with an optional
 *                    user-provided note ("why is this one interesting?").
 *
 * Auth: validates JWT in code via _shared/profileLoader (no verify_jwt
 * override needed; the project's signing-keys setup deploys with
 * verify_jwt=false by default).
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { loadProfile } from '../_shared/profileLoader.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('extension-followups');

// ────────────────────────────────────────────────────────────────────
// Zod schemas
// ────────────────────────────────────────────────────────────────────

const StringList = z.object({
  add: z.array(z.string().min(1)).optional(),
  remove: z.array(z.string().min(1)).optional(),
}).partial();

const UpdateSchema = z.object({
  action: z.literal('update'),
  source: z.string().min(1),
  source_listing_url: z.string().url().optional(),
  mismatch_type: z.string().optional(),
  preferred_cities: StringList.optional(),
  property_types: StringList.optional(),
  budget_min: z.number().nonnegative().optional(),
  budget_max: z.number().nonnegative().optional(),
  min_bedrooms: z.number().int().nonnegative().optional(),
  min_bathrooms: z.number().nonnegative().optional(),
  min_sqft: z.number().int().nonnegative().optional(),
  target_cap_rate: z.number().min(0).max(100).optional(),
});

const DismissSchema = z.object({
  action: z.literal('dismiss'),
  mismatch_type: z.string().min(1).max(64),
});

const SaveExceptionSchema = z.object({
  action: z.literal('save_exception'),
  property_url: z.string().url(),
  listing_snapshot: z.record(z.unknown()).default({}),
  reason: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

const GetStateSchema = z.object({ action: z.literal('get_state') });

const BodySchema = z.discriminatedUnion('action', [
  GetStateSchema,
  UpdateSchema,
  DismissSchema,
  SaveExceptionSchema,
]);

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function mergeStringArray(
  current: string[] | null | undefined,
  patch: { add?: string[]; remove?: string[] } | undefined,
): string[] | null {
  if (!patch || (!patch.add?.length && !patch.remove?.length)) return null;
  const set = new Map<string, string>(); // lowercased -> original casing
  for (const v of current ?? []) {
    if (typeof v === 'string' && v.trim()) set.set(v.trim().toLowerCase(), v.trim());
  }
  for (const v of patch.add ?? []) {
    const key = v.trim().toLowerCase();
    if (key && !set.has(key)) set.set(key, v.trim());
  }
  for (const v of patch.remove ?? []) {
    set.delete(v.trim().toLowerCase());
  }
  return Array.from(set.values());
}

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key);
}

// ────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 405, req);
  }

  // Auth
  const { user, profile } = await loadProfile(req);
  if (!user) return errorResponse('unauthorized', 401, req);

  // Validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return validationError('invalid_json', undefined, req);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return validationError('invalid_body', parsed.error.flatten(), req);
  }
  const body = parsed.data;
  const supabase = serviceClient();

  try {
    if (body.action === 'get_state') {
      // Pull dismissals from the last 7 days only.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dismissals } = await supabase
        .from('preference_followup_dismissals')
        .select('mismatch_type, dismissed_at')
        .eq('user_id', user.id)
        .gte('dismissed_at', sevenDaysAgo)
        .order('dismissed_at', { ascending: false });

      const preferences = {
        preferred_cities: profile?.preferred_cities ?? [],
        property_types: profile?.property_types ?? [],
        budget_min: profile?.budget_min ?? null,
        budget_max: profile?.budget_max ?? null,
        min_bedrooms: profile?.min_bedrooms ?? null,
        min_bathrooms: profile?.min_bathrooms ?? null,
        min_sqft: profile?.min_sqft ?? null,
        target_cap_rate: profile?.target_cap_rate ?? null,
        persona: profile?.persona ?? null,
        primary_goal: profile?.primary_goal ?? null,
      };

      const settings = {
        extension_smart_suggestions_enabled:
          profile?.extension_smart_suggestions_enabled ?? true,
      };

      return jsonResponse({ preferences, dismissals: dismissals ?? [], settings }, 200, req);
    }

    if (body.action === 'update') {
      const patch: Record<string, unknown> = {};

      const mergedCities = mergeStringArray(profile?.preferred_cities, body.preferred_cities);
      if (mergedCities) patch.preferred_cities = mergedCities;

      const mergedTypes = mergeStringArray(profile?.property_types, body.property_types);
      if (mergedTypes) patch.property_types = mergedTypes;

      if (typeof body.budget_min === 'number') patch.budget_min = body.budget_min;
      if (typeof body.budget_max === 'number') patch.budget_max = body.budget_max;
      if (typeof body.min_bedrooms === 'number') patch.min_bedrooms = body.min_bedrooms;
      if (typeof body.min_bathrooms === 'number') patch.min_bathrooms = body.min_bathrooms;
      if (typeof body.min_sqft === 'number') patch.min_sqft = body.min_sqft;
      if (typeof body.target_cap_rate === 'number') patch.target_cap_rate = body.target_cap_rate;

      if (Object.keys(patch).length === 0) {
        return validationError('empty_patch', undefined, req);
      }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select(
          'preferred_cities, property_types, budget_min, budget_max, min_bedrooms, min_bathrooms, min_sqft, target_cap_rate',
        )
        .single();

      if (error) {
        log.error('profile_update_failed', { error: error.message });
        return errorResponse('update_failed', 500, req);
      }

      log.info('preference_updated_from_extension', {
        user_id: user.id,
        fields: Object.keys(patch),
        mismatch_type: body.mismatch_type ?? null,
        source: body.source,
        source_listing_url: body.source_listing_url ?? null,
      });

      return jsonResponse({ success: true, updated_preferences: updated }, 200, req);
    }

    if (body.action === 'dismiss') {
      const { error } = await supabase
        .from('preference_followup_dismissals')
        .insert({ user_id: user.id, mismatch_type: body.mismatch_type });
      if (error) {
        log.error('dismiss_insert_failed', { error: error.message });
        return errorResponse('dismiss_failed', 500, req);
      }
      log.info('extension_followup_dismissed', {
        user_id: user.id,
        mismatch_type: body.mismatch_type,
      });
      return jsonResponse({ success: true }, 200, req);
    }

    if (body.action === 'save_exception') {
      const { data, error } = await supabase
        .from('user_exception_properties')
        .upsert(
          {
            user_id: user.id,
            property_url: body.property_url,
            listing_snapshot: body.listing_snapshot ?? {},
            reason: body.reason ?? null,
            note: body.note ?? null,
          },
          { onConflict: 'user_id,property_url' },
        )
        .select('id')
        .single();
      if (error) {
        log.error('exception_save_failed', { error: error.message });
        return errorResponse('exception_save_failed', 500, req);
      }
      log.info('extension_followup_saved_as_exception', {
        user_id: user.id,
        property_url: body.property_url,
        has_note: Boolean(body.note),
      });
      return jsonResponse({ success: true, id: data?.id }, 200, req);
    }

    return validationError('unknown_action', undefined, req);
  } catch (err) {
    log.error('handler_error', { error: (err as Error)?.message });
    return errorResponse('internal_error', 500, req);
  }
});