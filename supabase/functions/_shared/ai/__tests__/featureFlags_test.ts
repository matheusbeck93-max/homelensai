import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getFlagDecision, isSurfaceEnabled } from "../featureFlags.ts";

const SURFACE = "investor_chat";
const ENV_ENABLED = "AI_ROUTER_INVESTOR_CHAT_ENABLED";
const ENV_PCT = "AI_ROUTER_INVESTOR_CHAT_ROLLOUT_PCT";
const ENV_ALLOW = "AI_ROUTER_INVESTOR_CHAT_ALLOWLIST";

function clearEnv() {
  for (const k of [ENV_ENABLED, ENV_PCT, ENV_ALLOW, "AI_ROUTER_DISABLED"]) {
    Deno.env.delete(k);
  }
}

Deno.test("disabled by default", () => {
  clearEnv();
  const d = getFlagDecision(SURFACE, "u1");
  assertFalse(d.enabled);
  assertEquals(d.reason, "disabled");
});

Deno.test("global kill switch overrides everything", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "100");
  Deno.env.set("AI_ROUTER_DISABLED", "1");
  try {
    const d = getFlagDecision(SURFACE, "u1");
    assertFalse(d.enabled);
    assertEquals(d.reason, "kill_switch");
  } finally { clearEnv(); }
});

Deno.test("allowlist always enables", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "0");
  Deno.env.set(ENV_ALLOW, "u1, u2 ,u3");
  try {
    assert(isSurfaceEnabled(SURFACE, "u2"));
    assertFalse(isSurfaceEnabled(SURFACE, "u99"));
  } finally { clearEnv(); }
});

Deno.test("rollout bucket is stable per (user, surface)", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "100");
  try {
    const a = getFlagDecision(SURFACE, "user-stable-1");
    const b = getFlagDecision(SURFACE, "user-stable-1");
    assertEquals(a.bucket, b.bucket);
    assert(a.enabled);
  } finally { clearEnv(); }
});

Deno.test("rollout 0% excludes everyone (no allowlist)", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "0");
  try {
    assertFalse(isSurfaceEnabled(SURFACE, "u1"));
    assertFalse(isSurfaceEnabled(SURFACE, "u2"));
  } finally { clearEnv(); }
});

Deno.test("rollout ~50% splits population roughly in half", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "50");
  try {
    let enabled = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (isSurfaceEnabled(SURFACE, `user-${i}`)) enabled++;
    }
    // Hash should give ~50%; allow 40-60% range.
    assert(enabled > 400 && enabled < 600, `expected ~500, got ${enabled}`);
  } finally { clearEnv(); }
});

Deno.test("anonymous user only enabled at 100%", () => {
  clearEnv();
  Deno.env.set(ENV_ENABLED, "1");
  Deno.env.set(ENV_PCT, "50");
  try {
    assertFalse(isSurfaceEnabled(SURFACE, ""));
    Deno.env.set(ENV_PCT, "100");
    assert(isSurfaceEnabled(SURFACE, ""));
  } finally { clearEnv(); }
});