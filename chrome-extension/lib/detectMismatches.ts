/**
 * Pure function that compares a scraped listing to the user's saved
 * preferences and returns an ordered list of follow-up suggestions for
 * the extension popup to render.
 *
 * Severity order: blocker → major → minor. The popup caps the list to 2.
 */

export type MismatchSeverity = 'blocker' | 'major' | 'minor';
export type MismatchType =
  | 'location'
  | 'budget_over'
  | 'budget_under'
  | 'property_type'
  | 'min_beds'
  | 'min_baths'
  | 'min_sqft'
  | 'cap_rate';

export interface Preferences {
  preferred_cities?: string[] | null;
  property_types?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  min_bedrooms?: number | null;
  min_bathrooms?: number | null;
  min_sqft?: number | null;
  target_cap_rate?: number | null;
}

export interface ListingSnapshot {
  city?: string | null;
  state?: string | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  propertyType?: string | null;
  /** Optional cap rate as a percent number, e.g. 6.2 for 6.2%. */
  capRate?: number | null;
}

export interface UpdatePayload {
  preferred_cities?: { add?: string[]; remove?: string[] };
  property_types?: { add?: string[]; remove?: string[] };
  budget_min?: number;
  budget_max?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_sqft?: number;
  target_cap_rate?: number;
}

export interface MismatchFollowup {
  type: MismatchType;
  severity: MismatchSeverity;
  /** Short question for the card header. */
  prompt: string;
  /** Optional one-line explanation under the prompt. */
  detail?: string;
  /** Human-readable confirmation toast on success. */
  confirmation: string;
  /** Update payload for `extension-followups#update`. Null = informational. */
  update_payload: UpdatePayload | null;
  /** Prefilled chat prompt for informational ("Tell me more") cards. */
  chat_prompt?: string;
}

export interface DismissalRow {
  mismatch_type: string;
  dismissed_at: string;
}

function normalizeMarket(city?: string | null, state?: string | null): string | null {
  const c = (city ?? '').trim();
  const s = (state ?? '').trim();
  if (!c) return null;
  return s ? `${c}, ${s}` : c;
}

function eqLower(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function includesLower(list: string[] | null | undefined, value: string): boolean {
  if (!list?.length) return false;
  return list.some((v) => eqLower(v, value));
}

function suggestBudgetBump(price: number): number {
  // Round up to nearest $25k.
  return Math.ceil(price / 25_000) * 25_000;
}

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

const SEVERITY_ORDER: Record<MismatchSeverity, number> = {
  blocker: 0,
  major: 1,
  minor: 2,
};

export function detectMismatches(
  listing: ListingSnapshot,
  prefs: Preferences,
): MismatchFollowup[] {
  const out: MismatchFollowup[] = [];

  // ── Location ────────────────────────────────────────────────
  const market = normalizeMarket(listing.city, listing.state);
  const cityOnly = (listing.city ?? '').trim();
  if (market && prefs.preferred_cities?.length) {
    const matched =
      includesLower(prefs.preferred_cities, market) ||
      (cityOnly && includesLower(prefs.preferred_cities, cityOnly));
    if (!matched) {
      out.push({
        type: 'location',
        severity: 'blocker',
        prompt: `Add ${market} to your preferred locations?`,
        detail: `This listing isn't in any of your saved markets.`,
        confirmation: `Added ${market} to your preferences`,
        update_payload: { preferred_cities: { add: [market] } },
      });
    }
  }

  // ── Budget ──────────────────────────────────────────────────
  if (typeof listing.price === 'number' && listing.price > 0) {
    if (typeof prefs.budget_max === 'number' && listing.price > prefs.budget_max) {
      const next = suggestBudgetBump(listing.price);
      out.push({
        type: 'budget_over',
        severity: 'major',
        prompt: `Bump your max budget to ${formatMoney(next)}?`,
        detail: `This listing is ${formatMoney(listing.price)} — above your current ${formatMoney(prefs.budget_max)} cap.`,
        confirmation: `Updated your max budget to ${formatMoney(next)}`,
        update_payload: { budget_max: next },
      });
    } else if (typeof prefs.budget_min === 'number' && listing.price < prefs.budget_min) {
      out.push({
        type: 'budget_under',
        severity: 'minor',
        prompt: `This is under your usual budget — want to take a look?`,
        detail: `${formatMoney(listing.price)} vs your min of ${formatMoney(prefs.budget_min)}.`,
        confirmation: '',
        update_payload: null,
        chat_prompt: `This listing is ${formatMoney(listing.price)}, below my usual budget of ${formatMoney(prefs.budget_min)}. What's the catch — and is it worth a closer look?`,
      });
    }
  }

  // ── Property type ───────────────────────────────────────────
  if (listing.propertyType && prefs.property_types?.length) {
    const matched = includesLower(prefs.property_types, listing.propertyType);
    if (!matched) {
      const pretty = prettyType(listing.propertyType);
      out.push({
        type: 'property_type',
        severity: 'major',
        prompt: `Add ${pretty} to your property types?`,
        detail: `You haven't saved ${pretty} as a type you're open to.`,
        confirmation: `Added ${pretty} to your property types`,
        update_payload: { property_types: { add: [listing.propertyType] } },
      });
    }
  }

  // ── Min beds ────────────────────────────────────────────────
  if (
    typeof listing.beds === 'number' &&
    typeof prefs.min_bedrooms === 'number' &&
    listing.beds < prefs.min_bedrooms
  ) {
    out.push({
      type: 'min_beds',
      severity: 'minor',
      prompt: `Lower your minimum to ${listing.beds} beds?`,
      detail: `This has ${listing.beds} — your min is ${prefs.min_bedrooms}.`,
      confirmation: `Updated minimum bedrooms to ${listing.beds}`,
      update_payload: { min_bedrooms: listing.beds },
    });
  }

  // ── Min baths ───────────────────────────────────────────────
  if (
    typeof listing.baths === 'number' &&
    typeof prefs.min_bathrooms === 'number' &&
    listing.baths < prefs.min_bathrooms
  ) {
    out.push({
      type: 'min_baths',
      severity: 'minor',
      prompt: `Lower your minimum to ${listing.baths} baths?`,
      detail: `This has ${listing.baths} — your min is ${prefs.min_bathrooms}.`,
      confirmation: `Updated minimum bathrooms to ${listing.baths}`,
      update_payload: { min_bathrooms: listing.baths },
    });
  }

  // ── Min sqft ────────────────────────────────────────────────
  if (
    typeof listing.sqft === 'number' &&
    typeof prefs.min_sqft === 'number' &&
    listing.sqft < prefs.min_sqft
  ) {
    out.push({
      type: 'min_sqft',
      severity: 'minor',
      prompt: `Lower your min size to ${listing.sqft.toLocaleString()} sqft?`,
      detail: `This is ${listing.sqft.toLocaleString()} — your min is ${prefs.min_sqft.toLocaleString()}.`,
      confirmation: `Updated minimum size to ${listing.sqft.toLocaleString()} sqft`,
      update_payload: { min_sqft: listing.sqft },
    });
  }

  // ── Cap rate ────────────────────────────────────────────────
  if (
    typeof listing.capRate === 'number' &&
    typeof prefs.target_cap_rate === 'number' &&
    listing.capRate < prefs.target_cap_rate
  ) {
    out.push({
      type: 'cap_rate',
      severity: 'major',
      prompt: `Lower your target cap rate to ${listing.capRate.toFixed(1)}%?`,
      detail: `This deal pencils at ${listing.capRate.toFixed(1)}% — your target is ${prefs.target_cap_rate.toFixed(1)}%.`,
      confirmation: `Updated target cap rate to ${listing.capRate.toFixed(1)}%`,
      update_payload: { target_cap_rate: Number(listing.capRate.toFixed(2)) },
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Anti-nagging gate. Suppresses a follow-up type if the user has dismissed
 * it 3+ times in the last 7 days; suppression lasts 30 days from the
 * 3rd-most-recent dismissal.
 */
export function shouldShow(
  type: MismatchType,
  dismissals: DismissalRow[] | undefined,
): boolean {
  if (!dismissals?.length) return true;
  const sameType = dismissals
    .filter((d) => d.mismatch_type === type)
    .map((d) => new Date(d.dismissed_at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a); // newest first
  if (sameType.length < 3) return true;
  const triggerAt = sameType[2]; // 3rd-most-recent
  const suppressUntil = triggerAt + 30 * 24 * 60 * 60 * 1000;
  return Date.now() > suppressUntil;
}