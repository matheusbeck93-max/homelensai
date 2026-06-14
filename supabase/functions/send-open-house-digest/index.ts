/**
 * Cron-triggered open-house digest dispatcher.
 * Reads all enabled `open_house_alerts`, runs the search per alert,
 * and sends `open-houses-digest` emails via the shared sender.
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendTransactional } from '../_shared/email/sender.ts';
import { searchOpenHouses } from '../_shared/openHouses/searchClient.ts';
import { formatListingsAsCards } from '../_shared/openHouses/formatCards.ts';

const log = createLogger('send-open-house-digest');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const cronError = requireCronAuth(req);
  if (cronError) return cronError;

  let frequency: 'daily' | 'weekly' = 'daily';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.frequency === 'weekly') frequency = 'weekly';
  } catch {
    /* default daily */
  }

  const sb = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { data: alerts, error } = await sb
    .from('open_house_alerts')
    .select('id, user_id, country, state, city, filters, frequency')
    .eq('enabled', true)
    .eq('frequency', frequency);

  if (error) {
    log.error('alerts query failed', { error: error.message });
    return errorResponse('Failed to load alerts', 500, req);
  }

  const results: Array<{ alertId: string; status: string }> = [];

  for (const alert of alerts ?? []) {
    try {
      const search = await searchOpenHouses(
        {
          country: (alert.country as 'US' | 'CA') ?? 'US',
          state: alert.state ?? null,
          city: alert.city ?? null,
          ...((alert.filters as Record<string, unknown>) ?? {}),
        },
        // service-role context — pass service role as bearer for tier resolution to skip
        `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      );

      if (search.listings.length === 0) {
        results.push({ alertId: alert.id as string, status: 'skipped_no_listings' });
        continue;
      }

      const cards = formatListingsAsCards(search.listings);
      const outcome = await sendTransactional({
        userId: alert.user_id as string,
        template: 'open-houses-digest',
        templateData: {
          city: alert.city ?? '',
          state: alert.state ?? '',
          frequency,
          listings: cards.map((c) => ({
            address: c.address,
            cityState: c.cityState,
            price: c.price,
            beds: c.beds,
            baths: c.baths,
            openHouseLabel: c.openHouseLabel,
            listingUrl: c.listingUrl,
            photo: c.photo,
          })),
        },
        idempotencyKey: `oh-digest.${alert.id}.${new Date().toISOString().slice(0, 10)}`,
      });

      await sb
        .from('open_house_alerts')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', alert.id);

      results.push({ alertId: alert.id as string, status: outcome.status });
    } catch (err) {
      log.error('alert send failed', {
        alertId: alert.id,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ alertId: alert.id as string, status: 'failed' });
    }
  }

  return jsonResponse({ ok: true, frequency, processed: results.length, results }, 200, req);
});
