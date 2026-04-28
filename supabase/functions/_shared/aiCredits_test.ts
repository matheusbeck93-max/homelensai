import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Unit tests for the daily-reset semantics in `aiCredits.ts`.
 *
 * We re-implement the exact reset branch so we can exercise it without
 * touching the real database. The contract under test:
 *   - When `ai_credits_last_reset` ≠ today's UTC date, the function
 *     resets `ai_credits_used_today` to 0 and updates `ai_credits_last_reset`.
 *   - When the dates already match, nothing changes.
 *   - "Today" is computed from `new Date().toISOString().split('T')[0]`,
 *     i.e. the UTC calendar date.
 */

interface ProfileRow {
  ai_credits_used_today: number;
  ai_credits_last_reset: string | null;
}

/** Mirrors the reset branch inside `precheckAiCredits`. */
function applyDailyReset(profile: ProfileRow, today: string): ProfileRow {
  if (profile.ai_credits_last_reset !== today) {
    return { ai_credits_used_today: 0, ai_credits_last_reset: today };
  }
  return profile;
}

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

Deno.test("resets ai_credits_used_today when ai_credits_last_reset is yesterday (UTC)", () => {
  const yesterday = "2026-04-27";
  const today = "2026-04-28";
  const before: ProfileRow = { ai_credits_used_today: 73, ai_credits_last_reset: yesterday };

  const after = applyDailyReset(before, today);

  assertEquals(after.ai_credits_used_today, 0, "used_today must reset to 0");
  assertEquals(after.ai_credits_last_reset, today, "last_reset must advance to today");
});

Deno.test("resets when ai_credits_last_reset is null (fresh profile)", () => {
  const today = "2026-04-28";
  const after = applyDailyReset(
    { ai_credits_used_today: 0, ai_credits_last_reset: null },
    today,
  );
  assertEquals(after.ai_credits_last_reset, today);
  assertEquals(after.ai_credits_used_today, 0);
});

Deno.test("does NOT reset when ai_credits_last_reset is already today", () => {
  const today = "2026-04-28";
  const before: ProfileRow = { ai_credits_used_today: 42, ai_credits_last_reset: today };

  const after = applyDailyReset(before, today);

  assertEquals(after.ai_credits_used_today, 42, "must NOT clear in-progress usage");
  assertEquals(after.ai_credits_last_reset, today);
});

Deno.test("UTC date helper produces YYYY-MM-DD that matches the contract", () => {
  const stamp = todayUtc();
  // Format must be YYYY-MM-DD so it compares directly with a Postgres `date` column.
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(stamp);
  assertEquals(isIsoDate, true, `expected ISO date, got "${stamp}"`);
});

Deno.test("crossing the UTC midnight boundary triggers a reset on the next request", () => {
  // Simulate the user being at 99/100 credits used at 23:59 UTC on day N,
  // then the next request arriving at 00:01 UTC on day N+1.
  const dayN = "2026-04-28";
  const dayNplus1 = "2026-04-29";
  const stale: ProfileRow = { ai_credits_used_today: 99, ai_credits_last_reset: dayN };

  const reset = applyDailyReset(stale, dayNplus1);

  assertEquals(reset.ai_credits_used_today, 0);
  assertEquals(reset.ai_credits_last_reset, dayNplus1);

  // And a follow-up call on the same new day must NOT re-reset.
  const followUp = applyDailyReset(
    { ai_credits_used_today: 5, ai_credits_last_reset: dayNplus1 },
    dayNplus1,
  );
  assertEquals(followUp.ai_credits_used_today, 5);
});