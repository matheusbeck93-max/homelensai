import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUserProfile } from '../_shared/auth.ts';
import { getSupabaseEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('extension-save-property');

const BodySchema = z.object({
  listing_url: z.string().url(),
  scraped_data: z.object({
    address: z.string().min(1),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
    beds: z.number().optional().nullable(),
    baths: z.number().optional().nullable(),
    sqft: z.number().optional().nullable(),
    primary_photo_url: z.string().optional().nullable(),
  }),
  ai_analysis: z.record(z.unknown()).optional().nullable(),
});

function viewUrlForTier(tier?: string | null): string {
  // Investor → Console Properties tab; Free / Buyer → /chats sidebar.
  // Single source of truth is the saved_properties table; this just
  // chooses which surface to deep-link the user into after saving.
  if (tier === 'investor') {
    return '/console?tab=properties';
  }
  return '/chats';
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const t0 = Date.now();
  try {
    const auth = await getAuthenticatedUserProfile(req);
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { listing_url, scraped_data, ai_analysis } = parsed.data;

    const { url, serviceRoleKey } = getSupabaseEnv();
    const supabase = createClient(url, serviceRoleKey);

    // Upsert: refresh listing snapshot, preserve ai_analysis on conflict.
    const insertPayload = {
      user_id: auth.user.id,
      property_url: listing_url,
      property_address: scraped_data.address,
      city: scraped_data.city ?? null,
      state: scraped_data.state ?? null,
      price: scraped_data.price ?? null,
      beds: scraped_data.beds ?? null,
      baths: scraped_data.baths ?? null,
      sqft: scraped_data.sqft ?? null,
      image_url: scraped_data.primary_photo_url ?? null,
      ai_analysis: ai_analysis ?? null,
      source: 'chrome_extension' as const,
    };

    // Look up existing row to decide is_new and whether to preserve analysis.
    const { data: existing } = await supabase
      .from('saved_properties')
      .select('id, ai_analysis')
      .eq('user_id', auth.user.id)
      .eq('property_url', listing_url)
      .maybeSingle();

    let savedId: string;
    let isNew = false;

    if (existing) {
      const { data: updated, error: upErr } = await supabase
        .from('saved_properties')
        .update({
          price: insertPayload.price,
          beds: insertPayload.beds,
          baths: insertPayload.baths,
          sqft: insertPayload.sqft,
          image_url: insertPayload.image_url,
          // intentionally NOT updating ai_analysis / address / city / state
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      if (upErr) throw upErr;
      savedId = updated.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('saved_properties')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      savedId = inserted.id;
      isNew = true;
    }

    const tier = auth.profile?.subscription_status as string | undefined;
    const body = {
      saved_property_id: savedId,
      is_new: isNew,
      view_url: viewUrlForTier(tier),
    };
    log.info('saved', { user_id: auth.user.id, is_new: isNew, latency_ms: Date.now() - t0 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    log.error('failed', { error: err?.message });
    return new Response(
      JSON.stringify({ error: 'internal_error', message: err?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});