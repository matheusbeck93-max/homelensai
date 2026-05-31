/**
 * Per-surface rollout flags for the AI router.
 *
 * Default posture: every surface is OFF unless explicitly enabled. Callers
 * decide whether to fall back to their legacy code path when the flag is
 * off — the router itself doesn't gate the call, it just exposes the check.
 *
 * Per-surface env vars (SURFACE = upper-cased SurfaceId, dashes → underscores):
 *   AI_ROUTER_<SURFACE>_ENABLED      "1" to allow the surface at all
 *   AI_ROUTER_<SURFACE>_ROLLOUT_PCT  0-100 stable bucket per userId
 *   AI_ROUTER_<SURFACE>_ALLOWLIST    comma-separated userIds (always on)
 *
 * Global kill-switch:
 *   AI_ROUTER_DISABLED               "1" forces every surface off
 */

import type { SurfaceId } from "./surfaceConfig.ts";

function envKey(surface: SurfaceId, suffix: string): string {
  return `AI_ROUTER_${surface.toUpperCase().replace(/-/g, "_")}_${suffix}`;
}

/** Stable 0-99 bucket from (userId, surface) — same user gets the same bucket. */
function hashBucket(userId: string, surface: SurfaceId): number {
  const s = `${surface}:${userId}`;
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

export interface FlagDecision {
  enabled: boolean;
  reason: "kill_switch" | "disabled" | "allowlist" | "rollout_in" | "rollout_out" | "no_user";
  bucket?: number;
  rolloutPct?: number;
}

export function getFlagDecision(surface: SurfaceId, userId: string): FlagDecision {
  if (Deno.env.get("AI_ROUTER_DISABLED") === "1") {
    return { enabled: false, reason: "kill_switch" };
  }
  const enabledRaw = Deno.env.get(envKey(surface, "ENABLED"));
  if (enabledRaw !== "1") return { enabled: false, reason: "disabled" };

  const allowlistRaw = Deno.env.get(envKey(surface, "ALLOWLIST")) ?? "";
  const allowlist = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (userId && allowlist.includes(userId)) {
    return { enabled: true, reason: "allowlist" };
  }

  const pctRaw = Deno.env.get(envKey(surface, "ROLLOUT_PCT"));
  const pct = pctRaw ? Math.max(0, Math.min(100, Number(pctRaw) | 0)) : 0;
  if (!userId) {
    // Anonymous: only ride along when fully rolled out.
    return pct >= 100
      ? { enabled: true, reason: "rollout_in", rolloutPct: pct }
      : { enabled: false, reason: "no_user", rolloutPct: pct };
  }
  const bucket = hashBucket(userId, surface);
  return bucket < pct
    ? { enabled: true, reason: "rollout_in", bucket, rolloutPct: pct }
    : { enabled: false, reason: "rollout_out", bucket, rolloutPct: pct };
}

export function isSurfaceEnabled(surface: SurfaceId, userId: string): boolean {
  return getFlagDecision(surface, userId).enabled;
}