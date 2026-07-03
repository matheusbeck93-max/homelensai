import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { isLegacyPriceId, isCurrentPriceId } from '../_shared/subscriptions.ts';
import { getCreditPackByPriceId, TOPUP_CREDIT_EXPIRY_DAYS } from '../_shared/credits.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

/**
 * Stripe webhook handler.
 *
 * Until this lands, the app polls Stripe every 5 minutes from
 * useSubscription to refresh subscription state. That means:
 *   - Users who cancel keep Premium access for up to 5 minutes.
 *   - Failed payments don't propagate to subscription_status until
 *     the next poll.
 *   - Every active premium user costs Stripe API quota for status
 *     checks they didn't ask for.
 *
 * Setup (see CONFIG_CHANGES.md):
 *   1. Generate signing secret in Stripe dashboard.
 *   2. supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
 *   3. Set verify_jwt = false for this function in config.toml — Stripe
 *      doesn't send a Supabase JWT; we verify via the stripe-signature
 *      header instead.
 *   4. Subscribe to events: customer.subscription.created,
 *      customer.subscription.updated, customer.subscription.deleted,
 *      invoice.payment_failed, checkout.session.completed.
 *
 * See homelens_subscription_billing_fix_prompt.md P0-2.
 */

const log = createLogger('stripe-webhook');

// Keep in sync with src/lib/subscriptionPlans.ts and check-subscription/index.ts.
const PRODUCT_TIER_MAP: Record<string, 'free' | 'buyer' | 'investor'> = {
  'prod_URFGRoGQyqiWSq': 'buyer',    // Buyer monthly — formerly Premium
  'prod_URFGwmCiEV7RY9': 'buyer',    // Buyer annual  — formerly Premium annual
  'prod_UZ16G46hQlRRVD': 'investor', // Investor monthly
  'prod_UZ17Q3M67mTUP4': 'investor', // Investor annual
};

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    log.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET — see CONFIG_CHANGES.md');
    return errorResponse('Webhook not configured. See CONFIG_CHANGES.md.', 500);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return errorResponse('Missing stripe-signature header', 400);

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    log.warn('Signature verification failed', String(err));
    return errorResponse('Invalid signature', 400);
  }

  log.step('Received event', { type: event.type, id: event.id });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const item = sub.items.data[0];
        const productId = item?.price.product as string;
        const priceId = item?.price.id as string | undefined;
        const subscriptionItemId = item?.id as string | undefined;
        const tier = (sub.status === 'active' || sub.status === 'trialing')
          ? (PRODUCT_TIER_MAP[productId] ?? 'free')
          : 'free';
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const periodStart = new Date(sub.current_period_start * 1000).toISOString();

        // Look up the monthly plan-credit allowance for this tier.
        let allowanceUsd = 0;
        if (tier === 'buyer' || tier === 'investor') {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('monthly_credit_allowance_usd')
            .eq('tier', tier)
            .maybeSingle();
          allowanceUsd = Number(plan?.monthly_credit_allowance_usd ?? 0) || 0;
        }

        // Resolve target profile so we can decide whether this is a new
        // cycle (period_start changed) and whether to stamp trial_used_at.
        const profile = await resolveProfile(supabase, stripe, customerId);

        const fields: Record<string, unknown> = {
          subscription_status: tier,
          subscription_renews_at: sub.cancel_at_period_end ? null : periodEnd,
          subscription_cancel_at: sub.cancel_at_period_end ? periodEnd : null,
          stripe_price_id: priceId ?? null,
          stripe_subscription_id: sub.id,
          stripe_subscription_item_id: subscriptionItemId ?? null,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        };

        // Trial lock — stamp the first time we ever see this user on a
        // subscription, regardless of whether they actually got a trial.
        if (profile && !profile.trial_used_at) {
          fields.trial_used_at = new Date().toISOString();
        }

        // Plan-credit grant/reset:
        //  - subscription.created → grant full allowance.
        //  - subscription.updated → reset only when period_start changed
        //    (new billing cycle), otherwise leave balance alone so mid-
        //    cycle plan changes don't double-grant.
        const isNewCycle = !profile?.current_period_start
          || profile.current_period_start !== periodStart;
        let didGrant = false;
        if (tier === 'free') {
          fields.plan_credits_remaining_usd = 0;
          fields.plan_credits_allowance_usd = 0;
        } else if (event.type === 'customer.subscription.created' || isNewCycle) {
          fields.plan_credits_remaining_usd = allowanceUsd;
          fields.plan_credits_allowance_usd = allowanceUsd;
          didGrant = true;
        }

        await updateProfileByCustomerId(supabase, stripe, customerId, fields);

        if (didGrant && profile?.id) {
          await supabase.from('topup_events').insert({
            user_id: profile.id,
            event_type: event.type === 'customer.subscription.created'
              ? 'plan_granted'
              : 'plan_reset',
            credit_usd: allowanceUsd,
            remaining_balance_usd: allowanceUsd,
          });
        }

        // Detect legacy → current upgrade and mark nudge complete.
        if (event.type === 'customer.subscription.updated') {
          const prevPriceId = (event.data.previous_attributes as any)
            ?.items?.data?.[0]?.price?.id as string | undefined;
          if (prevPriceId && priceId && isLegacyPriceId(prevPriceId) && isCurrentPriceId(priceId)) {
            await markLegacyUpgradeComplete(supabase, customerId, prevPriceId, priceId);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        await updateProfileByCustomerId(supabase, stripe, customerId, {
          subscription_status: 'free',
          subscription_renews_at: null,
          subscription_cancel_at: null,
          plan_credits_remaining_usd: 0,
          plan_credits_allowance_usd: 0,
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        log.warn('Payment failed', { customerId: invoice.customer, invoiceId: invoice.id });
        // Don't immediately downgrade — Stripe will retry. The subsequent
        // subscription.updated event drives the state change if applicable.
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        log.step('Checkout completed', { sessionId: session.id });
        await recordCapConversion(supabase, session);
        // One-time AI credit pack purchase: insert user_credits row.
        await recordCreditPackPurchase(supabase, stripe, session);
        // Subscription tier change still arrives via subscription.created.
        break;
      }
      default:
        log.step('Unhandled event type', { type: event.type });
    }
    return jsonResponse({ received: true });
  } catch (err) {
    log.error('Handler error', err);
    return errorResponse(getErrorMessage(err), 500);
  }
})(req)));

async function getCustomerEmail(stripe: Stripe, customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return (customer as Stripe.Customer).email ?? null;
}

/**
 * Resolve the profile row backing a Stripe customer. Returns key fields
 * needed by the subscription handler — id, trial_used_at, and the prior
 * cycle's start so we can detect billing-cycle rollovers.
 */
async function resolveProfile(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  customerId: string,
): Promise<{ id: string; trial_used_at: string | null; current_period_start: string | null } | null> {
  const select = 'id, trial_used_at, current_period_start';
  const { data: byId } = await supabase
    .from('profiles')
    .select(select)
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (byId?.id) return byId as any;

  const email = await getCustomerEmail(stripe, customerId);
  if (!email) return null;
  const { data: authResp } = await (supabase as any).auth.admin.listUsers();
  const target = (authResp?.users ?? []).find((u: any) => u.email === email);
  if (!target?.id) return null;
  const { data } = await supabase
    .from('profiles')
    .select(select)
    .eq('id', target.id)
    .maybeSingle();
  return (data as any) ?? null;
}

async function updateProfileByCustomerId(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  customerId: string,
  fields: Record<string, unknown>
) {
  // Fast path: profile already cached the Stripe customer ID.
  const { data: byId } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (byId?.id) {
    const { error } = await supabase.from('profiles').update(fields).eq('id', byId.id);
    if (error) console.error('profile update failed', error);
    return;
  }

  // Fallback: resolve by email, then backfill stripe_customer_id.
  const email = await getCustomerEmail(stripe, customerId);
  if (!email) {
    console.warn('No email for customer', customerId);
    return;
  }
  await updateProfileByEmail(supabase, email, { ...fields, stripe_customer_id: customerId });
}

async function updateProfileByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
  fields: Record<string, unknown>
) {
  // The auth admin API is the canonical way to map email -> user_id.
  const { data: authResp, error: authErr } = await (supabase as any).auth.admin.listUsers();
  if (authErr) {
    console.error('listUsers failed', authErr);
    return;
  }
  const target = (authResp?.users ?? []).find((u: any) => u.email === email);
  if (!target) {
    console.warn('No auth user for email', email);
    return;
  }
  const { error } = await supabase.from('profiles').update(fields).eq('id', target.id);
  if (error) console.error('profile update failed', error);
}

/**
 * Marks the matching upgrade_cta_events row as converted when the
 * Stripe checkout session carries our `cap_session_id` metadata and the
 * click happened within the last 24h. Best-effort — never throws.
 */
async function recordCapConversion(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  try {
    const capSessionId = session.metadata?.cap_session_id;
    if (!capSessionId) return;
    const productId = session.line_items?.data?.[0]?.price?.product as string | undefined;
    const toTier = productId ? (PRODUCT_TIER_MAP[productId] ?? null) : null;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('upgrade_cta_events')
      .update({
        converted_at: new Date().toISOString(),
        stripe_session_id: session.id,
        to_tier: toTier,
      })
      .eq('cap_session_id', capSessionId)
      .is('converted_at', null)
      .gte('clicked_at', cutoff)
      .select('id, user_id, from_tier, source');
    if (error) {
      console.error('cap conversion update failed', error);
      return;
    }
    if (data && data.length > 0) {
      log.step('upgrade_cta_converted', {
        cap_session_id: capSessionId,
        rows: data.length,
        to_tier: toTier,
      });
    } else {
      log.step('cap_session_id not matched (stale or unknown)', { capSessionId });
    }
  } catch (err) {
    console.error('recordCapConversion error', err);
  }
}

/**
 * When a subscription's Stripe Price ID moves from a legacy ID to a current
 * one, mark the matching open legacy_upgrade_nudges row(s) as completed.
 */
async function markLegacyUpgradeComplete(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
  fromPriceId: string,
  toPriceId: string,
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (!profile?.id) {
      log.step('legacy upgrade: no profile for customer', { customerId });
      return;
    }
    const { data, error } = await supabase
      .from('legacy_upgrade_nudges')
      .update({ upgrade_completed_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .not('accepted_at', 'is', null)
      .is('upgrade_completed_at', null)
      .select('id');
    if (error) {
      console.error('legacy upgrade complete update failed', error);
      return;
    }
    log.step('legacy_upgrade_completed', {
      user_id: profile.id,
      from_price: fromPriceId,
      to_price: toPriceId,
      rows: data?.length ?? 0,
    });
  } catch (err) {
    console.error('markLegacyUpgradeComplete error', err);
  }
}

/**
 * Handles one-time AI credit-pack checkouts.
 * Detects pack via:
 *   1) session metadata.kind === 'ai_credit_topup' (preferred — set by buy-credits)
 *   2) Price ID match against the env-pinned credit-pack catalog (fallback)
 * Inserts an active `user_credits` row with a 30-day expiration. Idempotent
 * — the `stripe_session_id` unique index swallows webhook retries.
 */
async function recordCreditPackPurchase(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) {
  try {
    if (session.mode !== 'payment') return;
    const meta = session.metadata ?? {};
    let userId = meta.user_id as string | undefined;
    let packSize = meta.pack_size as 'small' | 'medium' | 'large' | undefined;
    let creditUsd = meta.credit_usd ? Number(meta.credit_usd) : NaN;
    let priceUsd = meta.price_usd ? Number(meta.price_usd) : NaN;

    // Fallback: look up the line item's price and match against env packs.
    if (!packSize || !Number.isFinite(creditUsd)) {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const priceId = lineItems.data[0]?.price?.id as string | undefined;
      const pack = getCreditPackByPriceId(priceId);
      if (!pack) return; // Not a credit-pack purchase.
      packSize = pack.size;
      creditUsd = pack.creditUsd;
      priceUsd = pack.priceUsd;
    }
    if (!Number.isFinite(creditUsd) || creditUsd <= 0) return;

    // If user_id missing from metadata, resolve via customer email.
    if (!userId) {
      const email = (session.customer_email as string | null)
        ?? (session.customer_details?.email as string | null);
      if (email) {
        const { data: authResp } = await (supabase as any).auth.admin.listUsers();
        const target = (authResp?.users ?? []).find((u: any) => u.email === email);
        userId = target?.id;
      }
    }
    if (!userId || !packSize) {
      log.warn('credit-pack: could not resolve user_id or pack_size', { sessionId: session.id });
      return;
    }

    const expiresAt = new Date(
      Date.now() + TOPUP_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await supabase.from('user_credits').insert({
      user_id: userId,
      amount_usd: creditUsd,
      pack_size: packSize,
      stripe_session_id: session.id,
      expires_at: expiresAt,
      status: 'active',
    });
    if (error) {
      // Unique violation = idempotent retry; quietly skip.
      if (error.code === '23505') {
        log.step('credit-pack: duplicate session, ignored', { sessionId: session.id });
        return;
      }
      console.error('credit-pack insert failed', error);
      return;
    }

    await supabase.from('topup_events').insert({
      user_id: userId,
      event_type: 'completed',
      pack_size: packSize,
      price_usd: Number.isFinite(priceUsd) ? priceUsd : null,
      credit_usd: creditUsd,
      stripe_session_id: session.id,
    });
    log.step('credit-pack purchase recorded', {
      userId,
      packSize,
      creditUsd,
      sessionId: session.id,
    });
  } catch (err) {
    console.error('recordCreditPackPurchase error', err);
  }
}
