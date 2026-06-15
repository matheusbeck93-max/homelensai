/**
 * Single-shot RentCast enrichment for non-tool-loop surfaces (ai-chat
 * firecrawl + extension branches, future investor-brief enrichment).
 *
 * Returns a short, model-ready MARKET DATA block when:
 *   - tier is buyer or investor
 *   - address is complete enough to query
 *   - RentCast call succeeds (or returns from cache)
 *
 * Returns null in every other case — including free tier, quota exceeded,
 * upgrade-required, malformed address, or API failure. Callers append the
 * returned string verbatim to the system/analysis prompt; null means the
 * surface behaves exactly as it does today.
 *
 * This intentionally does NOT throw and does NOT surface upgrade nudges:
 * those surfaces are one-shot prose generators, not interactive tool loops.
 * Upgrade CTAs live in owned-property-chat / investor-chat where the model
 * can react to the upgrade_required tool response in conversation.
 */
import {
  getValuationCached,
  resolveRentcastTier,
  RentcastQuotaError,
  RentcastUpgradeRequiredError,
  type RentcastAddress,
  type RentcastTier,
} from './rentcast.ts';

type SbClient = { from: (t: string) => any };

export interface EnrichmentInput {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  property_type?: string;
}

function isCompleteAddress(a: EnrichmentInput): boolean {
  return (
    !!a.address_line1 &&
    a.address_line1 !== 'Unknown' &&
    !!a.city &&
    a.city !== 'Unknown' &&
    !!a.state &&
    a.state !== 'XX' &&
    !!a.zip &&
    a.zip !== '00000' &&
    /^\d{5}$/.test(String(a.zip))
  );
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return 'n/a';
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

/**
 * Attempts a cached RentCast value+rent lookup and formats a MARKET DATA
 * block. Always silent on failure — returns null. Tier is resolved here so
 * callers don't need to thread it through.
 */
export async function fetchRentcastEnrichmentBlock(
  svc: SbClient,
  userId: string | null | undefined,
  addr: EnrichmentInput,
  opts?: { tierOverride?: RentcastTier },
): Promise<string | null> {
  if (!userId) return null;
  if (!isCompleteAddress(addr)) return null;
  try {
    const tier = opts?.tierOverride ?? (await resolveRentcastTier(svc as any, userId));
    if (tier === 'free') return null;
    const r = await getValuationCached(svc as any, userId, tier, addr as RentcastAddress);
    if (r.value == null && r.rent == null) return null;
    const lines: string[] = [];
    lines.push('--- LIVE MARKET DATA (source: RentCast) ---');
    lines.push(`Address: ${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip}`);
    if (r.value != null) {
      const range =
        r.low != null && r.high != null ? ` (range ${fmt(r.low)}–${fmt(r.high)})` : '';
      lines.push(`Estimated value: ${fmt(r.value)}${range}`);
    }
    if (r.rent != null) {
      const range =
        r.rentLow != null && r.rentHigh != null
          ? ` (range ${fmt(r.rentLow)}–${fmt(r.rentHigh)})`
          : '';
      lines.push(`Estimated monthly rent: ${fmt(r.rent)}${range}`);
    }
    lines.push(
      `Cite "RentCast" if you reference these numbers. Cached=${r.cached ? 'yes' : 'no'}.`,
    );
    return '\n\n' + lines.join('\n') + '\n';
  } catch (e) {
    if (e instanceof RentcastUpgradeRequiredError || e instanceof RentcastQuotaError) {
      return null;
    }
    console.warn('[rentcast-enrichment] silent failure:', (e as Error).message);
    return null;
  }
}