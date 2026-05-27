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