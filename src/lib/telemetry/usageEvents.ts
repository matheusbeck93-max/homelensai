/**
 * Canonical contract for usage / cap / top-up / upgrade telemetry events.
 *
 * All events are dispatched as `window` CustomEvents under the `homelens:`
 * namespace with snake_case payload keys. This module is the single source
 * of truth — components should NEVER construct one of these CustomEvents
 * directly; call `emitUsageEvent(name, payload)` instead.
 *
 * See `docs/telemetry/usage-events.md` for the full table.
 */

export type Tier = "free" | "buyer" | "investor";
export type CapType = "daily" | "monthly";

export type UsageEventSource =
  | "header_chip"
  | "usage_page"
  | "cap_blocker_daily"
  | "cap_blocker_monthly"
  | "cap_banner"
  | "topup_packs"
  | "next_tier_compare"
  | "console_plan"
  | "overview_card"
  | "chat_inline";

interface BaseShown {
  tier: Tier;
  surface?: string;
  source: UsageEventSource;
  cap_type?: CapType;
}

export interface UsageEventPayloads {
  "homelens:usage_page_viewed": {
    tier: Tier;
    pct_day?: number;
    pct_month?: number;
    credits_balance?: number;
  };
  "homelens:usage_indicator_clicked": {
    tier: Tier;
    source: Extract<UsageEventSource, "header_chip">;
    pct: number;
    driver: "daily" | "monthly";
    cap_type?: CapType;
  };
  "homelens:budget_cap_approaching_shown": BaseShown & {
    surface: string;
    cap_type: CapType;
    usage_pct: number;
  };
  "homelens:budget_cap_hit_shown": BaseShown & {
    surface: string;
    cap_type: CapType;
    usage_today_usd: number;
    cap_session_id?: string;
  };
  "homelens:topup_offered": BaseShown & {
    surface: string;
    cap_type: CapType;
  };
  "homelens:topup_pack_clicked": {
    tier: Tier;
    source: UsageEventSource;
    pack_size: "small" | "medium" | "large";
    surface?: string;
    cap_type?: CapType;
  };
  "homelens:upgrade_cta_clicked": {
    tier: Tier;
    source: UsageEventSource;
    to_tier: Tier;
    cap_session_id?: string;
    cap_type?: CapType;
    surface?: string;
  };
}

export type UsageEventName = keyof UsageEventPayloads;

/**
 * Dispatch a usage telemetry event. Drops `undefined` keys so payloads
 * stay clean for any downstream analytics listener. Never throws.
 */
export function emitUsageEvent<N extends UsageEventName>(
  name: N,
  payload: UsageEventPayloads[N],
): void {
  try {
    if (typeof window === "undefined") return;
    const detail: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (v !== undefined && v !== null) detail[k] = v;
    }
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* telemetry must never break UX */
  }
}