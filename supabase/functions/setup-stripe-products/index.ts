import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import Stripe from "https://esm.sh/stripe@18.5.0";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const monthlyProduct = await stripe.products.create({
      name: "HomeLens Premium",
      description: "Unlimited AI chat, property analysis, Investment Score, calculators, and more.",
    });
    const monthlyPrice = await stripe.prices.create({
      product: monthlyProduct.id,
      unit_amount: 997,
      currency: "usd",
      recurring: { interval: "month" },
      nickname: "Premium Monthly",
    });

    const annualProduct = await stripe.products.create({
      name: "HomeLens Premium (Annual)",
      description: "HomeLens Premium billed annually — save 10%.",
    });
    const annualPrice = await stripe.prices.create({
      product: annualProduct.id,
      unit_amount: 10764,
      currency: "usd",
      recurring: { interval: "year" },
      nickname: "Premium Annual",
    });

    return jsonResponse({
      monthly: { product: monthlyProduct.id, price: monthlyPrice.id },
      annual:  { product: annualProduct.id,  price: annualPrice.id  },
    });
  } catch (error) {
    return errorResponse(getErrorMessage(error));
  }
});