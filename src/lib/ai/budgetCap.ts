/**
 * Frontend budget-cap state shared across every AI surface.
 *
 * Two ways state moves:
 *   1. Polling — `useBudgetCap()` fetches `/budget-status` every 60s while
 *      the tab is focused AND at least one surface is mounted.
 *   2. 402 push — `recordBudgetExceededFrom402(body)` parses a structured
 *      402 payload (returned by `_shared/ai/budgetGuard.ts`) and flips the
 *      store to `exceeded` immediately. Composers across other tabs catch
 *      up on the next poll; same-tab consumers re-render instantly.
 *
 * Backend tier names (free | buyer | investor) are passed through
 * unchanged after the PR-2 tier rename.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BackendTier = "free" | "buyer" | "investor";
export type WarningLevel = "ok" | "approaching" | "exceeded";

export interface BudgetUpgradeInfo {
  available: boolean;
  nextTier: BackendTier | null;
  nextTierDisplay: string | null;
  nextTierPriceUsd: number | null;
  checkoutUrl: string | null;
}

export interface BudgetCapState {
  tier: BackendTier;
  tierDisplay: string;
  usageTodayUsd: number;
  dailyLimitUsd: number;
  usagePct: number;
  resetAt: Date;
  warningLevel: WarningLevel;
  upgrade: BudgetUpgradeInfo;
  loaded: boolean;
  /** Last surface that reported a 402 (drives `source=` tagging on CTAs). */
  lastBlockingSurface: string | null;
}

const TIER_DISPLAY: Record<BackendTier, string> = {
  free: "Free",
  buyer: "Buyer",
  investor: "Investor",
};

function defaultState(): BudgetCapState {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  return {
    tier: "free",
    tierDisplay: "Free",
    usageTodayUsd: 0,
    dailyLimitUsd: 0,
    usagePct: 0,
    resetAt: reset,
    warningLevel: "ok",
    upgrade: {
      available: false,
      nextTier: null,
      nextTierDisplay: null,
      nextTierPriceUsd: null,
      checkoutUrl: null,
    },
    loaded: false,
    lastBlockingSurface: null,
  };
}

// ── singleton store (avoid bringing in zustand for one feature) ──
let _state: BudgetCapState = defaultState();
const listeners = new Set<(s: BudgetCapState) => void>();
let activeSurfaces = 0;
let pollTimer: number | null = null;

function notify() {
  for (const l of listeners) l(_state);
}

function setState(patch: Partial<BudgetCapState>) {
  _state = { ..._state, ...patch };
  notify();
}

export function getBudgetCapState(): BudgetCapState {
  return _state;
}

function normalizeTier(raw: unknown): BackendTier {
  if (raw === "free" || raw === "paid" || raw === "premium") return raw;
  if (raw === "buyer") return "paid";
  if (raw === "investor") return "premium";
  return "free";
}

function levelFrom(pct: number): WarningLevel {
  if (pct >= 1) return "exceeded";
  if (pct >= 0.75) return "approaching";
  return "ok";
}

/** Map a `/budget-status` response into the in-memory state. */
function applyStatusBody(body: Record<string, unknown>) {
  const tier = normalizeTier(body.tier);
  const used = Number(body.usage_today_usd ?? 0);
  const cap = Number(body.daily_limit_usd ?? 0);
  const pct = cap > 0 ? Math.min(1, used / cap) : 0;
  const resetAtRaw = typeof body.reset_at === "string" ? body.reset_at : null;
  const resetAt = resetAtRaw ? new Date(resetAtRaw) : new Date();
  const wl: WarningLevel =
    typeof body.warning_level === "string"
      ? (body.warning_level as WarningLevel)
      : levelFrom(pct);
  setState({
    tier,
    tierDisplay: TIER_DISPLAY[tier],
    usageTodayUsd: used,
    dailyLimitUsd: cap,
    usagePct: pct,
    resetAt,
    warningLevel: wl,
    loaded: true,
  });
}

/**
 * Apply a structured 402 body returned by any AI edge function. Surfaces
 * call this from their error path (or via `parseAndRecordBudget402`).
 */
export function recordBudgetExceededFrom402(
  body: Record<string, unknown>,
  surface?: string,
): void {
  if (!body || body.error !== "budget_exceeded") return;
  const tier = normalizeTier(body.tier);
  const used = Number(body.usage_today_usd ?? 0);
  const cap = Number(body.daily_limit_usd ?? 0);
  const resetAtRaw = typeof body.reset_at === "string" ? body.reset_at : null;
  const upgradeRaw = (body.upgrade ?? {}) as Record<string, unknown>;
  const checkoutUrl =
    typeof upgradeRaw.checkout_url === "string" ? upgradeRaw.checkout_url : null;
  setState({
    tier,
    tierDisplay: TIER_DISPLAY[tier],
    usageTodayUsd: used,
    dailyLimitUsd: cap,
    usagePct: 1,
    resetAt: resetAtRaw ? new Date(resetAtRaw) : _state.resetAt,
    warningLevel: "exceeded",
    loaded: true,
    lastBlockingSurface: surface ?? (body.surface as string | undefined) ?? null,
    upgrade: {
      available: Boolean(upgradeRaw.available),
      nextTier: upgradeRaw.next_tier
        ? normalizeTier(upgradeRaw.next_tier)
        : null,
      nextTierDisplay:
        typeof upgradeRaw.next_tier_display === "string"
          ? upgradeRaw.next_tier_display
          : null,
      nextTierPriceUsd:
        typeof upgradeRaw.next_tier_price_usd === "number"
          ? (upgradeRaw.next_tier_price_usd as number)
          : null,
      checkoutUrl,
    },
  });
}

/**
 * Inspect a Supabase Edge Function error and absorb the structured 402
 * payload if present. Returns `true` when the error was a budget-cap hit
 * (so the caller can short-circuit its generic error toast).
 */
export async function parseAndRecordBudget402(
  error: unknown,
  surface?: string,
): Promise<boolean> {
  try {
    const ctx = (error as { context?: Response | undefined })?.context;
    if (!ctx || typeof ctx.clone !== "function") return false;
    const cloned = ctx.clone();
    if (cloned.status !== 402) return false;
    const body = await cloned.json().catch(() => null);
    if (!body || (body as { error?: string }).error !== "budget_exceeded") {
      return false;
    }
    recordBudgetExceededFrom402(body as Record<string, unknown>, surface);
    return true;
  } catch {
    return false;
  }
}

async function pollOnce() {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) return;
    const { data, error } = await supabase.functions.invoke("budget-status", {
      method: "GET",
    });
    if (error) return;
    if (data && typeof data === "object") {
      applyStatusBody(data as Record<string, unknown>);
    }
  } catch {
    /* network blips are fine — UI just keeps last-known state */
  }
}

function startPollingIfNeeded() {
  if (pollTimer != null) return;
  // Kick off an immediate fetch then poll every 60s.
  void pollOnce();
  pollTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (activeSurfaces <= 0) return;
    void pollOnce();
  }, 60_000);
}

function stopPollingIfIdle() {
  if (activeSurfaces > 0) return;
  if (pollTimer == null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

/**
 * Subscribe to budget-cap state. Mount this on every AI surface (composers,
 * brief refresh, artifact entry points). The hook increments an internal
 * "active surfaces" counter so polling only runs while AI UI is on screen.
 */
export function useBudgetCap(): BudgetCapState {
  const [s, setS] = useState<BudgetCapState>(_state);

  useEffect(() => {
    listeners.add(setS);
    activeSurfaces += 1;
    startPollingIfNeeded();
    return () => {
      listeners.delete(setS);
      activeSurfaces = Math.max(0, activeSurfaces - 1);
      stopPollingIfIdle();
    };
  }, []);

  return s;
}

/** Format the reset countdown for the banner / blocker. */
export function formatResetCountdown(resetAt: Date, now: Date = new Date()): string {
  const ms = resetAt.getTime() - now.getTime();
  if (ms <= 0) return "Resetting…";
  const hours = ms / (60 * 60 * 1000);
  if (hours <= 12) {
    const totalMin = Math.max(1, Math.floor(ms / 60_000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `Resets in ${m}m`;
    return `Resets in ${h}h ${m}m`;
  }
  const formatted = resetAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Resets at ${formatted}`;
}