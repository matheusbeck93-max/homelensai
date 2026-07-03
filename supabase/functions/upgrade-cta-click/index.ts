/**
 * Records an upgrade-CTA click triggered by a budget-cap hit.
 *
 * The frontend (`UpgradeCTA`) generates a `cap_session_id` UUID and posts
 * it here. The same id is later carried through Stripe checkout metadata,
 * so `stripe-webhook` can mark the row as converted on
 * `checkout.session.completed`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('upgrade-cta-click');

const BodySchema = z.object({
  cap_session_id: z.string().uuid(),
  source: z.string().min(1).max(120),
  from_tier: z.enum(['free', 'buyer', 'investor']),
});

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401, req);
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse('Unauthorized', 401, req);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse('Invalid request body', 400, req);
    }
    const { cap_session_id, source, from_tier } = parsed.data;

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { error } = await svc.from('upgrade_cta_events').insert({
      user_id: user.id,
      cap_session_id,
      source,
      from_tier,
    });
    if (error) {
      log.warn('insert failed', { error: error.message });
      // Best-effort telemetry — don't break UX.
    }
    return jsonResponse({ ok: true }, 200, req);
  } catch (e) {
    log.error('handler error', { error: getErrorMessage(e) });
    return errorResponse(getErrorMessage(e), 500, req);
  }
})(req)));