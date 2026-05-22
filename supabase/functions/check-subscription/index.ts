import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getOrCacheStripeCustomerId } from '../_shared/stripeCustomer.ts';
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const log = createLogger('check-subscription');

// Product ID to tier mapping. Keep in sync with src/lib/subscriptionPlans.ts
// and supabase/functions/stripe-webhook/index.ts.
const PRODUCT_TIER_MAP: Record<string, 'free' | 'buyer' | 'investor'> = {
  "prod_URFGRoGQyqiWSq": "buyer",     // Buyer monthly ($9.97/mo) — formerly Premium
  "prod_URFGwmCiEV7RY9": "buyer",     // Buyer annual  ($95.64/yr) — formerly Premium annual
  "prod_UZ16G46hQlRRVD": "investor",  // Investor monthly ($24.97/mo)
  "prod_UZ17Q3M67mTUP4": "investor",  // Investor annual  ($239.71/yr)
};

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.step("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const customerId = await getOrCacheStripeCustomerId(supabaseClient, stripe, user.id, user.email);

    if (!customerId) {
      log.step("No customer found, setting tier to free");
      
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_status: 'free',
          subscription_renews_at: null,
          subscription_cancel_at: null
        })
        .eq('id', user.id);
      
      return jsonResponse({ subscribed: false, tier: 'free' });
    }
    log.step("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      log.step("No active subscription, setting tier to free");
      
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_status: 'free',
          subscription_renews_at: null,
          subscription_cancel_at: null
        })
        .eq('id', user.id);
      
      return jsonResponse({ subscribed: false, tier: 'free' });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0].price.product as string;
    const tier = PRODUCT_TIER_MAP[productId] || 'free';
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    
    log.step("Active subscription found", { 
      subscriptionId: subscription.id, 
      productId, 
      tier,
      endDate: subscriptionEnd,
      cancelAtPeriodEnd 
    });

    // Update profile with subscription info
    await supabaseClient
      .from('profiles')
      .update({ 
        subscription_status: tier,
        subscription_renews_at: cancelAtPeriodEnd ? null : subscriptionEnd,
        subscription_cancel_at: cancelAtPeriodEnd ? subscriptionEnd : null
      })
      .eq('id', user.id);

    log.step("Profile updated with subscription status");

    return jsonResponse({
      subscribed: true,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd
    });
  } catch (error) {
    log.step("ERROR", { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error));
  }
});
