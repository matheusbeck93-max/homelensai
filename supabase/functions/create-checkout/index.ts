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

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");
    log.step("Price ID received", { priceId });

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
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
    };
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
