/**
 * WATCH GOALS (Agentic v1) — shared contract.
 * ==========================================
 * A Watch Goal is a standing "watch → score → notify" instruction. It is
 * stored on the EXISTING `saved_searches` table; the agentic fields live
 * inside `filters_json` so v1 needs no schema migration.
 *
 * `saved_searches` row shape used here:
 *   query_text        text        — human label ("3bd under 600k in Austin")
 *   alert_enabled     boolean     — goal is active
 *   alert_frequency   text        — 'daily' | 'weekly' (default weekly)
 *   last_alert_sent   timestamptz — stamped after each evaluation run
 *   filters_json      jsonb       — search criteria + agentic fields:
 *     {
 *       location:  string,          // "Austin, TX"
 *       price_min: number,
 *       price_max: number,
 *       beds_min:  number,
 *       baths_min: number,
 *       prop_type: 'house'|'condo'|'townhome'|'multi'|'any',
 *
 *       // --- agentic v1 fields ---
 *       match_threshold: number,    // 0-10, default 7 — notify at or above
 *       notify: 'in_app' | 'email' | 'both',   // default 'in_app'
 *       goal_kind: 'watch_area' | 'watch_similar' | 'watch_price_drop',
 *       seed_property: {            // present for watch_similar / price_drop
 *         url?: string, address?: string, price?: number,
 *         city?: string, state?: string, beds?: number, baths?: number
 *       }
 *     }
 *
 * Notifications are written to `alert_events` (type `watch_goal_match`),
 * whose `property_id` is a free-text column, so live listing ids are fine.
 */

export type GoalKind = "watch_area" | "watch_similar" | "watch_price_drop";
export type NotifyChannel = "in_app" | "email" | "both";

export interface SeedProperty {
  url?: string;
  address?: string;
  price?: number;
  city?: string;
  state?: string;
  beds?: number;
  baths?: number;
}

export interface WatchGoal {
  id: string;
  userId: string;
  label: string;
  frequency: "daily" | "weekly";
  lastAlertSent: string | null;
  matchThreshold: number;
  notify: NotifyChannel;
  goalKind: GoalKind;
  seedProperty: SeedProperty | null;
  search: {
    location: string;
    price_min?: number;
    price_max?: number;
    beds_min?: number;
    baths_min?: number;
    prop_type?: "house" | "condo" | "townhome" | "multi" | "any";
  };
}

export const DEFAULT_MATCH_THRESHOLD = 7;

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Normalizes a `saved_searches` row into a WatchGoal. Returns null when unusable. */
export function parseWatchGoal(row: any): WatchGoal | null {
  if (!row?.id || !row?.user_id) return null;
  const f = (row.filters_json ?? {}) as Record<string, unknown>;

  const location = String(f.location ?? f.city ?? row.query_text ?? "").trim();
  if (!location) return null; // nothing real to search — skip rather than guess

  const threshold = num(f.match_threshold);
  const notifyRaw = String(f.notify ?? "in_app");
  const notify: NotifyChannel =
    notifyRaw === "email" || notifyRaw === "both" ? notifyRaw : "in_app";
  const kindRaw = String(f.goal_kind ?? "watch_area");
  const goalKind: GoalKind =
    kindRaw === "watch_similar" || kindRaw === "watch_price_drop"
      ? (kindRaw as GoalKind)
      : "watch_area";

  const propTypeRaw = String(f.prop_type ?? "any");
  const propType = ["house", "condo", "townhome", "multi", "any"].includes(propTypeRaw)
    ? (propTypeRaw as WatchGoal["search"]["prop_type"])
    : "any";

  return {
    id: String(row.id),
    userId: String(row.user_id),
    label: String(row.query_text ?? location),
    frequency: row.alert_frequency === "daily" ? "daily" : "weekly",
    lastAlertSent: row.last_alert_sent ?? null,
    matchThreshold: Math.max(0, Math.min(10, threshold ?? DEFAULT_MATCH_THRESHOLD)),
    notify,
    goalKind,
    seedProperty: (f.seed_property as SeedProperty) ?? null,
    search: {
      location,
      price_min: num(f.price_min),
      price_max: num(f.price_max),
      beds_min: num(f.beds_min),
      baths_min: num(f.baths_min),
      prop_type: propType,
    },
  };
}

/** True when the goal's cadence window has elapsed since the last run. */
export function isGoalDue(goal: WatchGoal, now = new Date()): boolean {
  if (!goal.lastAlertSent) return true;
  const last = new Date(goal.lastAlertSent).getTime();
  if (!Number.isFinite(last)) return true;
  const windowMs = goal.frequency === "daily" ? 20 * 3600_000 : 6.5 * 24 * 3600_000;
  return now.getTime() - last >= windowMs;
}

export interface CandidateListing {
  id: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  externalUrl?: string;
  imageUrl?: string;
  zestimate?: number;
  [k: string]: unknown;
}

/**
 * Deterministic prefilter — runs BEFORE any AI call so we never pay to score
 * listings that plainly miss the goal. Also drops anything already notified.
 */
export function prefilterListings(
  listings: CandidateListing[],
  goal: WatchGoal,
  alreadyNotifiedIds: Set<string>,
  limit = 5,
): CandidateListing[] {
  const seedPrice = goal.seedProperty?.price;
  const out = (listings ?? []).filter((l) => {
    if (!l?.id) return false;
    if (alreadyNotifiedIds.has(String(l.id))) return false;
    const price = Number(l.price ?? 0);
    if (!price) return false;
    if (goal.search.price_min && price < goal.search.price_min) return false;
    if (goal.search.price_max && price > goal.search.price_max) return false;
    if (goal.search.beds_min && Number(l.bedrooms ?? 0) < goal.search.beds_min) return false;
    if (goal.search.baths_min && Number(l.bathrooms ?? 0) < goal.search.baths_min) return false;
    // Price-drop goals only care about listings cheaper than the seed.
    if (goal.goalKind === "watch_price_drop" && seedPrice && price >= seedPrice) return false;
    return true;
  });

  // Cheapest-first keeps the AI spend focused on the strongest value candidates.
  out.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  return out.slice(0, limit);
}

/** Compact listing description handed to the scoring model. */
export function describeListing(l: CandidateListing): string {
  const parts = [
    l.address ? `Address: ${l.address}` : null,
    l.city || l.state ? `Location: ${[l.city, l.state].filter(Boolean).join(", ")}` : null,
    l.price ? `Price: $${Number(l.price).toLocaleString("en-US")}` : null,
    l.bedrooms != null ? `Beds: ${l.bedrooms}` : null,
    l.bathrooms != null ? `Baths: ${l.bathrooms}` : null,
    l.sqft ? `Sqft: ${Number(l.sqft).toLocaleString("en-US")}` : null,
    l.zestimate ? `Zestimate: $${Number(l.zestimate).toLocaleString("en-US")}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}
