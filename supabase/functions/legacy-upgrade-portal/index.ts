import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import {
  isLegacyPriceId,
  targetPriceIdForTier,
} from '../_shared/subscriptions.ts';

const log = createLogger('legacy-upgrade-portal');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error('Not authenticated');

    const body = await req.json().catch(() => ({} as any));
    const surface: string = body?.surface ?? 'unknown';

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id || !profile?.stripe_subscription_id) {
      return errorResponse('No active subscription on file', 400);
    }
    if (!isLegacyPriceId(profile.stripe_price_id)) {
      return errorResponse('Not eligible for legacy upgrade', 400);
    }
    const tier = profile.subscription_status as 'buyer' | 'investor';
    if (tier !== 'buyer' && tier !== 'investor') {
      return errorResponse('Tier not eligible', 400);
    }
    const targetPrice = targetPriceIdForTier(tier);
    if (!targetPrice) {
      log.error('Missing STRIPE_*_MONTHLY_PRICE_ID env for tier', { tier });
      return errorResponse('Upgrade target price not configured', 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
    const origin = req.headers.get('origin') ?? '';
    const returnUrl = `${origin}/console?legacy_upgrade=complete`;

    // Resolve subscription item id if not cached.
    let itemId = profile.stripe_subscription_item_id;
    if (!itemId) {
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      itemId = sub.items.data[0]?.id ?? null;
    }
    if (!itemId) return errorResponse('Subscription item not found', 500);

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: profile.stripe_subscription_id,
          items: [{ id: itemId, price: targetPrice, quantity: 1 }],
        },
        after_completion: {
          type: 'redirect',
          redirect: { return_url: returnUrl },
        },
      },
    });

    // Record acceptance. Always insert a fresh event so we have a clean
    // audit trail; the track endpoint owns shown/dismissed/deferred events.
    await supabase.from('legacy_upgrade_nudges').insert({
      user_id: user.id,
      legacy_price_id: profile.stripe_price_id,
      current_tier: tier,
      surface,
      shown_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      new_stripe_session_id: session.id,
    });

    log.step('Portal session created', { sessionId: session.id, tier });
    return jsonResponse({ url: session.url });
  } catch (err) {
    log.error('legacy-upgrade-portal failed', err);
    return errorResponse(getErrorMessage(err), 500);
  }
});