/**
 * RentCast API adapter for auto-valuation of owned properties.
 * Single call returns sale-value AVM + rent estimate.
 * Docs: https://developers.rentcast.io/reference
 */

const RENTCAST_BASE = 'https://api.rentcast.io/v1';

export interface RentcastValuation {
  saleValue: number | null;
  saleValueLow: number | null;
  saleValueHigh: number | null;
  rentEstimate: number | null;
  rentLow: number | null;
  rentHigh: number | null;
  raw: unknown;
}

export interface RentcastAddress {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  property_type?: string;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
}

function mapPropertyType(t?: string): string | undefined {
  switch (t) {
    case 'single_family':
      return 'Single Family';
    case 'townhome':
      return 'Townhouse';
    case 'condo':
      return 'Condo';
    case 'duplex':
    case 'triplex':
    case 'fourplex':
    case 'multifamily':
      return 'Multi-Family';
    case 'land':
      return 'Land';
    default:
      return undefined;
  }
}

async function callRentcast(path: string, params: Record<string, string | number | undefined>) {
  const apiKey = Deno.env.get('RENTCAST_API_KEY');
  if (!apiKey) throw new Error('RENTCAST_API_KEY not configured');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const url = `${RENTCAST_BASE}${path}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RentCast ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchRentcastValuation(addr: RentcastAddress): Promise<RentcastValuation> {
  const address = `${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip}`;
  const common = {
    address,
    propertyType: mapPropertyType(addr.property_type),
    bedrooms: addr.beds ?? undefined,
    bathrooms: addr.baths ?? undefined,
    squareFootage: addr.sqft ?? undefined,
  };

  // Run sale + rent in parallel; tolerate one failing.
  const [saleRes, rentRes] = await Promise.allSettled([
    callRentcast('/avm/value', common),
    callRentcast('/avm/rent/long-term', common),
  ]);

  let saleValue: number | null = null;
  let saleLow: number | null = null;
  let saleHigh: number | null = null;
  if (saleRes.status === 'fulfilled') {
    const d: any = saleRes.value;
    saleValue = Number(d?.price ?? null) || null;
    saleLow = Number(d?.priceRangeLow ?? null) || null;
    saleHigh = Number(d?.priceRangeHigh ?? null) || null;
  }

  let rent: number | null = null;
  let rentLow: number | null = null;
  let rentHigh: number | null = null;
  if (rentRes.status === 'fulfilled') {
    const d: any = rentRes.value;
    rent = Number(d?.rent ?? null) || null;
    rentLow = Number(d?.rentRangeLow ?? null) || null;
    rentHigh = Number(d?.rentRangeHigh ?? null) || null;
  }

  return {
    saleValue,
    saleValueLow: saleLow,
    saleValueHigh: saleHigh,
    rentEstimate: rent,
    rentLow,
    rentHigh,
    raw: {
      sale: saleRes.status === 'fulfilled' ? saleRes.value : { error: String(saleRes.reason) },
      rent: rentRes.status === 'fulfilled' ? rentRes.value : { error: String(rentRes.reason) },
    },
  };
}

/**
 * Standard amortization remaining balance after `monthsElapsed` payments.
 */
export function amortizedBalance(
  originalPrincipal: number,
  rateApr: number,
  termYears: number,
  monthsElapsed: number,
): number {
  if (!originalPrincipal || rateApr <= 0 || termYears <= 0) return originalPrincipal ?? 0;
  const r = rateApr / 12;
  const n = termYears * 12;
  const k = Math.max(0, Math.min(monthsElapsed, n));
  const pow = Math.pow(1 + r, n);
  const powK = Math.pow(1 + r, k);
  return originalPrincipal * (pow - powK) / (pow - 1);
}

export function monthsBetween(start: string | Date, end: string | Date = new Date()): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

// -------------------------------------------------------------------------
// Caching + per-user daily quota layer (added after RentCast Foundation tier
// went live). Used by the chat-callable AI tools — the background
// auto-valuation refresh still uses fetchRentcastValuation directly.
// -------------------------------------------------------------------------

export type RentcastTier = 'free' | 'buyer' | 'investor';

const QUOTA_PER_DAY: Record<RentcastTier, number> = {
  free: 0, // free tier never hits RentCast — falls back to Perplexity
  buyer: 5,
  investor: 50,
};

// TTL per endpoint in milliseconds.
const TTL_MS: Record<string, number> = {
  value: 24 * 60 * 60 * 1000,
  rent: 24 * 60 * 60 * 1000,
  comps: 24 * 60 * 60 * 1000,
  details: 7 * 24 * 60 * 60 * 1000,
};

export class RentcastQuotaError extends Error {
  constructor(public tier: RentcastTier, public limit: number) {
    super(`RentCast daily quota exceeded for tier=${tier} (limit=${limit})`);
    this.name = 'RentcastQuotaError';
  }
}

/**
 * Thrown when a `free`-tier user tries to call a RentCast-backed tool.
 * Distinct from RentcastQuotaError so callers can surface an upgrade CTA
 * instead of a "try again tomorrow" message. There is NO Perplexity AVM
 * fallback for free users — live valuations are paid-only.
 */
export class RentcastUpgradeRequiredError extends Error {
  constructor() {
    super('RentCast live valuations require a Buyer or Investor subscription.');
    this.name = 'RentcastUpgradeRequiredError';
  }
}

function normalizeAddrKey(addr: RentcastAddress): string {
  return [
    addr.address_line1,
    addr.city,
    addr.state,
    addr.zip,
    addr.beds ?? '',
    addr.baths ?? '',
    addr.sqft ?? '',
    addr.property_type ?? '',
  ]
    .map((v) => String(v).trim().toLowerCase())
    .join('|');
}

function cacheKey(endpoint: string, addr: RentcastAddress): string {
  return `${endpoint}:${normalizeAddrKey(addr)}`;
}

// Minimal supabase-client shape; we only need from()/select/insert/upsert.
type SbClient = {
  from: (t: string) => any;
};

export async function enforceDailyQuota(
  sb: SbClient,
  userId: string,
  tier: RentcastTier,
): Promise<void> {
  const limit = QUOTA_PER_DAY[tier] ?? 0;
  // Free tier: never call RentCast. Surface an upgrade CTA instead.
  if (tier === 'free' || limit <= 0) throw new RentcastUpgradeRequiredError();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await sb
    .from('rentcast_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('called_at', since);
  if (error) {
    console.warn('[rentcast] usage count failed, allowing call:', error.message);
    return;
  }
  if ((count ?? 0) >= limit) throw new RentcastQuotaError(tier, limit);
}

export async function logRentcastCall(
  sb: SbClient,
  userId: string,
  endpoint: string,
  cacheHit: boolean,
): Promise<void> {
  try {
    await sb.from('rentcast_usage_log').insert({
      user_id: userId,
      endpoint,
      cache_hit: cacheHit,
    });
  } catch (e) {
    console.warn('[rentcast] usage log insert failed:', (e as Error).message);
  }
}

async function readCache(sb: SbClient, key: string): Promise<unknown | null> {
  const { data, error } = await sb
    .from('rentcast_cache')
    .select('payload, expires_at')
    .eq('cache_key', key)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload;
}

async function writeCache(
  sb: SbClient,
  key: string,
  endpoint: string,
  payload: unknown,
): Promise<void> {
  const ttl = TTL_MS[endpoint] ?? TTL_MS.value;
  const expires_at = new Date(Date.now() + ttl).toISOString();
  try {
    await sb
      .from('rentcast_cache')
      .upsert({ cache_key: key, endpoint, payload, fetched_at: new Date().toISOString(), expires_at });
  } catch (e) {
    console.warn('[rentcast] cache upsert failed:', (e as Error).message);
  }
}

export interface CachedValuationResult {
  value: number | null;
  low: number | null;
  high: number | null;
  rent: number | null;
  rentLow: number | null;
  rentHigh: number | null;
  cached: boolean;
  source: 'rentcast';
}

/**
 * Cached + quota-aware variant of fetchRentcastValuation for the chat tools.
 * Throws RentcastQuotaError when the per-user daily limit is exceeded.
 */
export async function getValuationCached(
  sb: SbClient,
  userId: string,
  tier: RentcastTier,
  addr: RentcastAddress,
): Promise<CachedValuationResult> {
  const key = cacheKey('value+rent', addr);
  const cached = (await readCache(sb, key)) as RentcastValuation | null;
  if (cached) {
    await logRentcastCall(sb, userId, 'value+rent', true);
    return {
      value: cached.saleValue,
      low: cached.saleValueLow,
      high: cached.saleValueHigh,
      rent: cached.rentEstimate,
      rentLow: cached.rentLow,
      rentHigh: cached.rentHigh,
      cached: true,
      source: 'rentcast',
    };
  }
  await enforceDailyQuota(sb, userId, tier);
  const fresh = await fetchRentcastValuation(addr);
  await writeCache(sb, key, 'value', fresh);
  await logRentcastCall(sb, userId, 'value+rent', false);
  return {
    value: fresh.saleValue,
    low: fresh.saleValueLow,
    high: fresh.saleValueHigh,
    rent: fresh.rentEstimate,
    rentLow: fresh.rentLow,
    rentHigh: fresh.rentHigh,
    cached: false,
    source: 'rentcast',
  };
}

// -------------------------------------------------------------------------
// Shared tier resolver. Single source of truth for every surface that
// gates RentCast (investor-chat, owned-property-chat, ai-chat, etc.).
// Maps profiles.subscription_status + stripe_price_id → RentcastTier.
// -------------------------------------------------------------------------
export async function resolveRentcastTier(
  sb: SbClient,
  userId: string,
): Promise<RentcastTier> {
  try {
    const { data } = await sb
      .from('profiles')
      .select('subscription_status, stripe_price_id')
      .eq('id', userId)
      .maybeSingle();
    const status = String((data as any)?.subscription_status ?? '').toLowerCase();
    const priceId = String((data as any)?.stripe_price_id ?? '');
    const investorPriceIds = [
      Deno.env.get('STRIPE_INVESTOR_MONTHLY_PRICE_ID'),
      Deno.env.get('STRIPE_INVESTOR_ANNUAL_PRICE_ID'),
    ].filter(Boolean);
    if (investorPriceIds.includes(priceId)) return 'investor';
    // Legacy/explicit status shims first…
    if (status === 'investor' || status === 'premium') return 'investor';
    if (status === 'buyer' || status === 'paid') return 'buyer';
    // …then the generic Stripe subscription states (any paid sub = buyer).
    if (status === 'active' || status === 'trialing') return 'buyer';
    return 'free';
  } catch {
    return 'free';
  }
}