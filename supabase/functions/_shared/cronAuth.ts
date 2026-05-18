/**
 * Internal-secret auth for cron-triggered edge functions.
 *
 * Cron jobs invoked via pg_cron's net.http_post do NOT carry a user JWT,
 * so verify_jwt = true would break them. Instead, the cron job includes
 * a custom header X-Cron-Secret containing the value of the
 * CRON_SHARED_SECRET environment variable. Edge functions that should
 * only be reachable by the cron use requireCronAuth() at the top of the
 * handler.
 *
 * Setup:
 *   1) supabase secrets set CRON_SHARED_SECRET=$(openssl rand -hex 32)
 *   2) In Postgres:
 *        alter database postgres set "app.settings.cron_secret" to '<same value>';
 *   3) Update the cron job to include the header:
 *        net.http_post(
 *          url := ...,
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'X-Cron-Secret', current_setting('app.settings.cron_secret')
 *          )
 *        );
 *
 * See homelens_public_endpoints_fix_prompt.md P0-4 and CONFIG_CHANGES.md.
 */

import { errorResponse } from './responses.ts';

export function requireCronAuth(req: Request): Response | null {
  const provided = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SHARED_SECRET');
  if (!expected || expected.length < 32) {
    return errorResponse(
      'CRON_SHARED_SECRET not configured on the server. See CONFIG_CHANGES.md.',
      500
    );
  }
  if (!provided || provided !== expected) {
    return errorResponse('Unauthorized', 401);
  }
  return null;
}
