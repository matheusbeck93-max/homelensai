import Stripe from 'https://esm.sh/stripe@18.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// One-shot operator tool. Creates (or rotates) the stripe-webhook endpoint
// and returns the signing secret. Delete after use.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'create';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const webhookUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

  try {
    // Probe scope
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    const found = existing.data.find(e => e.url === webhookUrl);

    if (action === 'probe') {
      return new Response(JSON.stringify({
        scope_ok: true,
        webhook_url: webhookUrl,
        existing_count: existing.data.length,
        match: found ? { id: found.id, status: found.status, enabled_events: found.enabled_events } : null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (found) {
      // Delete & recreate to get a fresh, retrievable secret.
      await stripe.webhookEndpoints.del(found.id);
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_failed',
        'checkout.session.completed',
      ],
      description: 'HomeLens subscription state sync',
      api_version: '2024-12-18.acacia',
    });

    return new Response(JSON.stringify({
      ok: true,
      replaced: !!found,
      id: endpoint.id,
      url: endpoint.url,
      enabled_events: endpoint.enabled_events,
      created: endpoint.created,
      secret: endpoint.secret,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: err?.message ?? String(err),
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});