import Stripe from "https://esm.sh/stripe@18.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Resolve a Stripe customer ID for a user.
 *
 * Priority:
 *   1. profiles.stripe_customer_id (fast path, no Stripe API call)
 *   2. stripe.customers.list({ email }) (legacy fallback)
 *
 * When found via fallback, backfills profiles.stripe_customer_id so subsequent
 * calls take the fast path. Returns null if no customer exists yet.
 */
export async function getOrCacheStripeCustomerId(
  supabase: SupabaseClient,
  stripe: Stripe,
  userId: string,
  email: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const cached = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (cached) return cached;

  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) return null;

  const customerId = customers.data[0].id;
  await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  return customerId;
}

/**
 * Cache a Stripe customer ID on the profile. Use after creating a customer
 * (e.g. inside checkout) to avoid the email lookup next time.
 */
export async function cacheStripeCustomerId(
  supabase: SupabaseClient,
  userId: string,
  customerId: string,
): Promise<void> {
  await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
}
