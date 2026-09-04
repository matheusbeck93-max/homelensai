/**
 * WATCH GOALS — client-side contract (Agentic v1).
 *
 * Mirrors `supabase/functions/_shared/watchGoals.ts`. A Watch Goal is stored
 * on the existing `saved_searches` table; the agentic fields live inside
 * `filters_json` so no schema migration is needed:
 *
 *   filters_json.match_threshold : number 0-10 (notify at or above)
 *   filters_json.notify          : 'in_app' | 'email' | 'both'
 *   filters_json.goal_kind       : 'watch_area' | 'watch_similar' | 'watch_price_drop'
 *   filters_json.seed_property   : { url, address, price, city, state, beds, baths }
 *
 * Cadence stays on the real column `alert_frequency`, active flag on
 * `alert_enabled`. The `watch-goals-evaluate` cron reads exactly these.
 */
import { supabase } from "@/integrations/supabase/client";

export type GoalKind = "watch_area" | "watch_similar" | "watch_price_drop";
export type NotifyChannel = "in_app" | "email" | "both";
export type Cadence = "daily" | "weekly";

export const DEFAULT_MATCH_THRESHOLD = 7;

export interface SeedProperty {
  url?: string;
  address?: string;
  price?: number;
  city?: string;
  state?: string;
  beds?: number;
  baths?: number;
}

export interface WatchGoalFields {
  matchThreshold: number;
  notify: NotifyChannel;
  goalKind: GoalKind;
  seedProperty: SeedProperty | null;
}

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  watch_area: "Watch an area",
  watch_similar: "Watch similar homes",
  watch_price_drop: "Watch for a price drop",
};

export const NOTIFY_LABEL: Record<NotifyChannel, string> = {
  in_app: "In-app only",
  email: "Email only",
  both: "In-app + email",
};

export function readGoalFields(filters: any): WatchGoalFields {
  const f = (filters ?? {}) as Record<string, unknown>;
  const raw = Number(f.match_threshold);
  const notify = String(f.notify ?? "in_app");
  const kind = String(f.goal_kind ?? "watch_area");
  return {
    matchThreshold: Number.isFinite(raw)
      ? Math.max(0, Math.min(10, raw))
      : DEFAULT_MATCH_THRESHOLD,
    notify: notify === "email" || notify === "both" ? (notify as NotifyChannel) : "in_app",
    goalKind:
      kind === "watch_similar" || kind === "watch_price_drop" ? (kind as GoalKind) : "watch_area",
    seedProperty: (f.seed_property as SeedProperty) ?? null,
  };
}

/** Merges agentic fields back into an existing filters_json blob. */
export function writeGoalFields(
  filters: any,
  patch: Partial<Pick<WatchGoalFields, "matchThreshold" | "notify" | "goalKind">>,
): Record<string, unknown> {
  const base = { ...(filters ?? {}) } as Record<string, unknown>;
  if (patch.matchThreshold != null) base.match_threshold = patch.matchThreshold;
  if (patch.notify) base.notify = patch.notify;
  if (patch.goalKind) base.goal_kind = patch.goalKind;
  return base;
}

export async function updateGoalFields(
  goalId: string,
  currentFilters: any,
  patch: Partial<Pick<WatchGoalFields, "matchThreshold" | "notify" | "goalKind">>,
): Promise<{ ok: true; filters: Record<string, unknown> } | { ok: false; error: string }> {
  const filters = writeGoalFields(currentFilters, patch);
  const { error } = await supabase
    .from("saved_searches")
    .update({ filters_json: filters })
    .eq("id", goalId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, filters };
}

export interface CreateWatchGoalInput {
  label: string;
  goalKind: GoalKind;
  location: string;
  cadence?: Cadence;
  matchThreshold?: number;
  notify?: NotifyChannel;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  seedProperty?: SeedProperty;
}

/** Creates a Watch Goal row. Returns the new goal id on success. */
export async function createWatchGoal(
  input: CreateWatchGoalInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false, error: "You need to sign in first." };
  if (!input.location?.trim()) {
    return { ok: false, error: "This listing has no city and state, so there's nothing to watch." };
  }

  const filters: Record<string, unknown> = {
    location: input.location.trim(),
    match_threshold: input.matchThreshold ?? DEFAULT_MATCH_THRESHOLD,
    notify: input.notify ?? "in_app",
    goal_kind: input.goalKind,
  };
  if (input.priceMin) filters.price_min = Math.round(input.priceMin);
  if (input.priceMax) filters.price_max = Math.round(input.priceMax);
  if (input.bedsMin) filters.beds_min = input.bedsMin;
  if (input.bathsMin) filters.baths_min = input.bathsMin;
  if (input.seedProperty) filters.seed_property = input.seedProperty;

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: user.id,
      query_text: input.label,
      filters_json: filters,
      alert_enabled: true,
      alert_frequency: input.cadence ?? "weekly",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}
