import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getOrCacheStripeCustomerId, cacheStripeCustomerId } from '../_shared/stripeCustomer.ts';

const log = createLogger('create-checkout');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log.step("Function started");

    const body = await req.json().catch(() => ({} as any));
    const { priceId, cap_session_id: capSessionId, source: capSource } = body ?? {};
    if (!priceId) throw new Error("priceId is required");
    log.step("Price ID received", { priceId });

    // Server-side validation: only allow price IDs we've explicitly configured
    // as backend secrets. Prevents clients from passing arbitrary Stripe prices.
    const allowedPriceIds = new Set(
      [
        Deno.env.get("STRIPE_BUYER_MONTHLY_PRICE_ID"),
        Deno.env.get("STRIPE_BUYER_ANNUAL_PRICE_ID"),
        Deno.env.get("STRIPE_INVESTOR_MONTHLY_PRICE_ID"),
        Deno.env.get("STRIPE_INVESTOR_ANNUAL_PRICE_ID"),
        Deno.env.get("STRIPE_CREDIT_PACK_SMALL_PRICE_ID"),
        Deno.env.get("STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID"),
        Deno.env.get("STRIPE_CREDIT_PACK_LARGE_PRICE_ID"),
      ].filter((v): v is string => typeof v === "string" && v.length > 0),
    );
    if (!allowedPriceIds.has(priceId)) {
      log.step("Rejected unknown priceId");
      return errorResponse("Invalid priceId", 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.step("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    let customerId = await getOrCacheStripeCustomerId(supabaseClient, stripe, user.id, user.email);
    if (customerId) {
      log.step("Existing customer found", { customerId });
    } else {
      log.step("No existing customer, will create in checkout");
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const sessionParams: Record<string, unknown> = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
    };
    // Carry cap-conversion attribution through Stripe metadata so the
    // webhook can credit the upgrade_cta_events row on completion.
    const metadata: Record<string, string> = { user_id: user.id };
    if (typeof capSessionId === 'string' && capSessionId) {
      metadata.cap_session_id = capSessionId;
    }
    if (typeof capSource === 'string' && capSource) {
      metadata.cap_source = capSource;
    }
    sessionParams.metadata = metadata;

    // 7-day trial — only for users who have never used it. The webhook
    // stamps `trial_used_at` on subscription.created to block re-trialing.
    const { data: profileRow } = await supabaseClient
      .from("profiles")
      .select("trial_used_at")
      .eq("id", user.id)
      .maybeSingle();
    const isFirstTimeSubscriber = !profileRow?.trial_used_at;
    const subscriptionData: Record<string, unknown> = { metadata };
    if (isFirstTimeSubscriber) {
      subscriptionData.trial_period_days = 7;
      log.step("Applying 7-day free trial");
    } else {
      log.step("Trial already used — no trial period applied");
    }
    sessionParams.subscription_data = subscriptionData;
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = user.email;
    }
    const session = await stripe.checkout.sessions.create(sessionParams as any);
    log.step("Checkout session created", { sessionId: session.id });

    // If Stripe created a new customer during checkout, cache it on the profile.
    if (!customerId && session.customer) {
      const newId = typeof session.customer === 'string' ? session.customer : session.customer.id;
      await cacheStripeCustomerId(supabaseClient, user.id, newId);
      log.step("Cached new Stripe customer", { customerId: newId });
    }

    return jsonResponse({ url: session.url });
  } catch (error) {
    log.step("ERROR", { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error));
  }
});
