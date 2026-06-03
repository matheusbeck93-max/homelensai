/**
 * Subscription helpers shared across edge functions.
 *
 * Legacy pricing detection: any Stripe Price ID listed in
 * STRIPE_LEGACY_PRICE_IDS (comma-separated env var) is considered legacy.
 * Two convenience env vars also feed the set:
 *   - STRIPE_LEGACY_PAID_PRICE_ID    (old $4.97 monthly)
 *   - STRIPE_LEGACY_PREMIUM_PRICE_ID (old premium price id, if any)
 *
 * Current pricing is read from the explicit per-tier env vars below.
 */

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const LEGACY_PRICE_IDS: Set<string> = new Set<string>(
  [
    Deno.env.get('STRIPE_LEGACY_PAID_PRICE_ID'),
    Deno.env.get('STRIPE_LEGACY_PREMIUM_PRICE_ID'),
    ...parseList(Deno.env.get('STRIPE_LEGACY_PRICE_IDS')),
  ].filter((v): v is string => !!v),
);

export const CURRENT_PRICE_IDS = {
  buyerMonthly: Deno.env.get('STRIPE_BUYER_MONTHLY_PRICE_ID') ?? '',
  buyerAnnual: Deno.env.get('STRIPE_BUYER_ANNUAL_PRICE_ID') ?? '',
  investorMonthly: Deno.env.get('STRIPE_INVESTOR_MONTHLY_PRICE_ID') ?? '',
  investorAnnual: Deno.env.get('STRIPE_INVESTOR_ANNUAL_PRICE_ID') ?? '',
};

export const CURRENT_PRICE_ID_SET: Set<string> = new Set<string>(
  Object.values(CURRENT_PRICE_IDS).filter(Boolean),
);

export function isLegacyPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return LEGACY_PRICE_IDS.has(priceId);
}

export function isCurrentPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return CURRENT_PRICE_ID_SET.has(priceId);
}

export function targetPriceIdForTier(
  tier: 'buyer' | 'investor',
): string | null {
  if (tier === 'buyer') return CURRENT_PRICE_IDS.buyerMonthly || null;
  if (tier === 'investor') return CURRENT_PRICE_IDS.investorMonthly || null;
  return null;
}