import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendTransactional } from '../_shared/email/sender.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const userId = '936faac3-9eef-48e9-8fa1-b27dd16a7b5f';
  const stamp = Date.now();

  // Wipe prior failed rows for these idempotency keys so retries can write fresh logs.
  await sb.from('email_send_log').delete().eq('user_id', userId).eq('status', 'failed');

  const results: Record<string, unknown> = {};

  results.welcome = await sendTransactional({
    userId,
    template: 'welcome-test',
    templateData: { note: `Domain verification retry @ ${new Date().toISOString()}` },
    idempotencyKey: `welcome-test-retry-${stamp}`,
  });

  for (const tier of [3, 7, 14]) {
    results[`streak-${tier}`] = await sendTransactional({
      userId,
      template: 'streak-milestone',
      templateData: {
        tier,
        headline: `${tier}-day streak unlocked`,
        context: `${tier} days in a row on HomeLens. Keep going.`,
        rewardLabel: null,
      },
      idempotencyKey: `streak.${tier}d-retry-${stamp}`,
    });
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});