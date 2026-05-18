import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getOrCacheStripeCustomerId } from '../_shared/stripeCustomer.ts';

const log = createLogger('customer-portal');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    log.step("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log.step("User authenticated", { userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const customerId = await getOrCacheStripeCustomerId(supabaseClient, stripe, user.id, user.email);
    if (!customerId) {
      throw new Error("No Stripe customer found for this user");
    }
    log.step("Found Stripe customer", { customerId });

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/console?tab=subscription`,
    });
    log.step("Customer portal session created", { sessionId: portalSession.id });

    return jsonResponse({ url: portalSession.url });
  } catch (error) {
    log.step("ERROR", { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error));
  }
});
