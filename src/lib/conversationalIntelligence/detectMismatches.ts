/**
 * Pure mismatch detection — surface-agnostic copy of the extension's
 * `chrome-extension/lib/detectMismatches.ts`. Kept byte-equivalent so a
 * future convergence step can have the extension import from here.
 *
 * Note: in Phase 2 the primary trigger for follow-up cards becomes the
 * AI's `mismatch_signals` field on the turn. This pure detector remains
 * the fallback / cross-check, and is what the extension popup uses today
 * because it operates on a static listing snapshot (no AI roundtrip).
 */

export type MismatchSeverity = "blocker" | "major" | "minor";
export type MismatchType =
  | "location"
  | "budget_over"
  | "budget_under"
  | "property_type"
  | "min_beds"
  | "min_baths"
  | "min_sqft"
  | "cap_rate";

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
  prompt: string;
  detail?: string;
  confirmation: string;
  update_payload: UpdatePayload | null;
  chat_prompt?: string;
}

export interface DismissalRow {
  mismatch_type: string;
  dismissed_at: string;
}

function normalizeMarket(city?: string | null, state?: string | null): string | null {
  const c = (city ?? "").trim();
  const s = (state ?? "").trim();
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
  return Math.ceil(price / 25_000) * 25_000;
}

function prettyType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  const market = normalizeMarket(listing.city, listing.state);
  const cityOnly = (listing.city ?? "").trim();
  if (market && prefs.preferred_cities?.length) {
    const matched =
      includesLower(prefs.preferred_cities, market) ||
      (cityOnly && includesLower(prefs.preferred_cities, cityOnly));
    if (!matched) {
      out.push({
        type: "location",
        severity: "blocker",
        prompt: `Add ${market} to your preferred locations?`,
        detail: `This isn't in any of your saved markets.`,
        confirmation: `Added ${market} to your preferences`,
        update_payload: { preferred_cities: { add: [market] } },
      });
    }
  }

  if (typeof listing.price === "number" && listing.price > 0) {
    if (typeof prefs.budget_max === "number" && listing.price > prefs.budget_max) {
      const next = suggestBudgetBump(listing.price);
      out.push({
        type: "budget_over",
        severity: "major",
        prompt: `Bump your max budget to ${formatMoney(next)}?`,
        detail: `${formatMoney(listing.price)} — above your ${formatMoney(prefs.budget_max)} cap.`,
        confirmation: `Updated your max budget to ${formatMoney(next)}`,
        update_payload: { budget_max: next },
      });
    } else if (typeof prefs.budget_min === "number" && listing.price < prefs.budget_min) {
      out.push({
        type: "budget_under",
        severity: "minor",
        prompt: `Under your usual budget — want a closer look?`,
        detail: `${formatMoney(listing.price)} vs your min of ${formatMoney(prefs.budget_min)}.`,
        confirmation: "",
        update_payload: null,
        chat_prompt: `This is ${formatMoney(listing.price)}, below my min of ${formatMoney(prefs.budget_min)}. What's the catch and is it worth a look?`,
      });
    }
  }

  if (listing.propertyType && prefs.property_types?.length) {
    const matched = includesLower(prefs.property_types, listing.propertyType);
    if (!matched) {
      const pretty = prettyType(listing.propertyType);
      out.push({
        type: "property_type",
        severity: "major",
        prompt: `Add ${pretty} to your property types?`,
        detail: `You haven't saved ${pretty} as a type you're open to.`,
        confirmation: `Added ${pretty} to your property types`,
        update_payload: { property_types: { add: [listing.propertyType] } },
      });
    }
  }

  if (
    typeof listing.beds === "number" &&
    typeof prefs.min_bedrooms === "number" &&
    listing.beds < prefs.min_bedrooms
  ) {
    out.push({
      type: "min_beds",
      severity: "minor",
      prompt: `Lower your minimum to ${listing.beds} beds?`,
      detail: `This has ${listing.beds} — your min is ${prefs.min_bedrooms}.`,
      confirmation: `Updated minimum bedrooms to ${listing.beds}`,
      update_payload: { min_bedrooms: listing.beds },
    });
  }

  if (
    typeof listing.baths === "number" &&
    typeof prefs.min_bathrooms === "number" &&
    listing.baths < prefs.min_bathrooms
  ) {
    out.push({
      type: "min_baths",
      severity: "minor",
      prompt: `Lower your minimum to ${listing.baths} baths?`,
      detail: `This has ${listing.baths} — your min is ${prefs.min_bathrooms}.`,
      confirmation: `Updated minimum bathrooms to ${listing.baths}`,
      update_payload: { min_bathrooms: listing.baths },
    });
  }

  if (
    typeof listing.sqft === "number" &&
    typeof prefs.min_sqft === "number" &&
    listing.sqft < prefs.min_sqft
  ) {
    out.push({
      type: "min_sqft",
      severity: "minor",
      prompt: `Lower your min size to ${listing.sqft.toLocaleString()} sqft?`,
      detail: `This is ${listing.sqft.toLocaleString()} — your min is ${prefs.min_sqft.toLocaleString()}.`,
      confirmation: `Updated minimum size to ${listing.sqft.toLocaleString()} sqft`,
      update_payload: { min_sqft: listing.sqft },
    });
  }

  if (
    typeof listing.capRate === "number" &&
    typeof prefs.target_cap_rate === "number" &&
    listing.capRate < prefs.target_cap_rate
  ) {
    out.push({
      type: "cap_rate",
      severity: "major",
      prompt: `Lower your target cap rate to ${listing.capRate.toFixed(1)}%?`,
      detail: `Pencils at ${listing.capRate.toFixed(1)}% — your target is ${prefs.target_cap_rate.toFixed(1)}%.`,
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
    .sort((a, b) => b - a);
  if (sameType.length < 3) return true;
  const triggerAt = sameType[2];
  const suppressUntil = triggerAt + 30 * 24 * 60 * 60 * 1000;
  return Date.now() > suppressUntil;
}

/**
 * Bridge: convert AI-returned `mismatch_signals` (Phase 2) into the same
 * `MismatchFollowup` shape the renderer already understands. When the AI
 * provides signals, this is preferred over running `detectMismatches`
 * against an extracted snapshot.
 */
export function mismatchFollowupsFromSignals(
  signals: import("./types").MismatchSignal[],
  prefs: Preferences,
): MismatchFollowup[] {
  const synthetic: ListingSnapshot = {};
  for (const s of signals) {
    switch (s.type) {
      case "location":
        if (typeof s.value === "string") {
          const [city, state] = s.value.split(",").map((p) => p.trim());
          synthetic.city = city || null;
          synthetic.state = state || null;
        }
        break;
      case "budget_over":
      case "budget_under":
        if (typeof s.value === "number") synthetic.price = s.value;
        break;
      case "property_type":
        if (typeof s.value === "string") synthetic.propertyType = s.value;
        break;
      case "min_beds":
        if (typeof s.value === "number") synthetic.beds = s.value;
        break;
      case "min_baths":
        if (typeof s.value === "number") synthetic.baths = s.value;
        break;
      case "min_sqft":
        if (typeof s.value === "number") synthetic.sqft = s.value;
        break;
      case "cap_rate":
        if (typeof s.value === "number") synthetic.capRate = s.value;
        break;
    }
  }
  return detectMismatches(synthetic, prefs);
}