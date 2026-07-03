import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/responses.ts";
import { getErrorMessage } from "../_shared/errors.ts";
import { createLogger } from "../_shared/logging.ts";
import {
  getOrCacheStripeCustomerId,
  cacheStripeCustomerId,
} from "../_shared/stripeCustomer.ts";
import { getCreditPack, type CreditPackSize } from "../_shared/credits.ts";
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

/**
 * Creates a Stripe Checkout session for a one-time AI credit pack purchase.
 *
 * Body: { pack: 'small' | 'medium' | 'large', source?: string }
 *
 * Free users are rejected (403) — they should upgrade to Buyer instead.
 * Pack price IDs are env-pinned: STRIPE_CREDIT_PACK_{SMALL,MEDIUM,LARGE}_PRICE_ID.
 * Until those are set, the function returns 503 so the UI can warn the user.
 */

const log = createLogger("buy-credits");

const VALID_PACKS: ReadonlySet<CreditPackSize> = new Set<CreditPackSize>([
  "small",
  "medium",
  "large",
]);

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({} as any));
    const packSize = body?.pack as CreditPackSize | undefined;
    const source = typeof body?.source === "string" ? body.source : "manual";
    if (!packSize || !VALID_PACKS.has(packSize)) {
      return errorResponse("pack must be one of small | medium | large", 400, req);
    }
    const pack = getCreditPack(packSize);
    if (!pack || !pack.stripePriceId) {
      log.error("Credit pack price not configured", { pack: packSize });
      return errorResponse(
        "Top-up credits are not configured yet. Please try again later.",
        503,
        req,
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return errorResponse("STRIPE_SECRET_KEY not configured", 500, req);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401, req);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      return errorResponse("Unauthorized", 401, req);
    }
    const user = userData.user;

    // Free users get redirected — they should upgrade, not top up.
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    const tier = (profile?.subscription_status as string | null) ?? "free";
    if (tier !== "buyer" && tier !== "investor" && tier !== "paid" && tier !== "premium") {
      return errorResponse(
        "Top-up credits are available on Buyer and Investor plans. Please upgrade your subscription.",
        403,
        req,
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    let customerId = await getOrCacheStripeCustomerId(
      supabaseClient,
      stripe,
      user.id,
      user.email,
    );

    const origin = req.headers.get("origin") || "https://homelensais.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      success_url: `${origin}/console?tab=plan&topup=success&pack=${packSize}`,
      cancel_url: `${origin}/console?tab=plan&topup=canceled`,
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email,
      metadata: {
        user_id: user.id,
        pack_size: packSize,
        credit_usd: String(pack.creditUsd),
        price_usd: String(pack.priceUsd),
        kind: "ai_credit_topup",
        source,
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_size: packSize,
          credit_usd: String(pack.creditUsd),
          kind: "ai_credit_topup",
        },
      },
    });

    if (!customerId && session.customer) {
      const newId =
        typeof session.customer === "string" ? session.customer : session.customer.id;
      await cacheStripeCustomerId(supabaseClient, user.id, newId);
    }

    // Fire-and-forget telemetry.
    void supabaseClient.from("topup_events").insert({
      user_id: user.id,
      event_type: "pack_clicked",
      pack_size: packSize,
      tier,
      source,
      price_usd: pack.priceUsd,
      credit_usd: pack.creditUsd,
      stripe_session_id: session.id,
    });

    log.step("Checkout session created", { sessionId: session.id, pack: packSize });
    return jsonResponse({ url: session.url, pack: packSize, credit_usd: pack.creditUsd }, 200, req);
  } catch (e) {
    log.error("buy-credits failed", { error: getErrorMessage(e) });
    return errorResponse(getErrorMessage(e), 500, req);
  }
})(req)));