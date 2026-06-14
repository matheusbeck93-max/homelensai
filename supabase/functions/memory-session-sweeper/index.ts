/**
 * memory-session-sweeper
 *
 * Cron — every 10 min. Finds conversations whose latest activity is
 * 10-60 min old and that haven't been summarised since, and invokes
 * memory-summarize-session for each.
 *
 * Guarded by CRON_SHARED_SECRET (X-Cron-Secret header).
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const denied = requireCronAuth(req);
  if (denied) return denied;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const now = Date.now();
  const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const sixtyMinAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await admin
    .from('conversations')
    .select('id, updated_at, last_summarized_at')
    .lt('updated_at', tenMinAgo)
    .gt('updated_at', sixtyMinAgo)
    .or('last_summarized_at.is.null,last_summarized_at.lt.updated_at')
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const c of stale ?? []) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/memory-summarize-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ conversationId: c.id }),
      });
      results.push({ id: c.id, ok: resp.ok });
    } catch (err) {
      results.push({ id: c.id, ok: false, error: (err as Error).message });
    }
  }

  return new Response(JSON.stringify({ scanned: stale?.length ?? 0, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});