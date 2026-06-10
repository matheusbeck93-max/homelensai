import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  BudgetExceededError,
  buildBudgetExceededPayload,
  firstOfNextMonthIso,
  getBudgetLimits,
  getMonthlyBudgetLimits,
  nextUtcMidnightIso,
} from "../budgetGuard.ts";

Deno.test("buildBudgetExceededPayload — free tier offers Buyer upgrade", async () => {
  const err = new BudgetExceededError("free", 0.105, 0.10, "general_chat");
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.error, "budget_exceeded");
  assertEquals(payload.tier, "free");
  assertEquals(payload.tier_display, "Free");
  assertEquals(payload.surface, "general_chat");
  assertEquals(payload.usage_today_usd, 0.105);
  assertEquals(payload.daily_limit_usd, 0.10);
  assertEquals(payload.cap_type, "daily");
  assertEquals(payload.upgrade.available, true);
  if (payload.upgrade.available) {
    assertEquals(payload.upgrade.next_tier, "buyer");
    assertEquals(payload.upgrade.next_tier_display, "Buyer");
    assertEquals(payload.upgrade.next_tier_price_usd, 9.97);
    assertEquals(
      payload.upgrade.checkout_url,
      "/pricing?plan=buyer&source=cap_hit_general_chat",
    );
  }
  // Free users never see top-up packs.
  assertEquals(payload.topup.available, false);
});

Deno.test("buildBudgetExceededPayload — paid tier offers Investor upgrade", async () => {
  const err = new BudgetExceededError("buyer", 0.55, 0.50, "investor_chat");
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.tier_display, "Buyer");
  assertEquals(payload.cap_type, "daily");
  if (payload.upgrade.available) {
    assertEquals(payload.upgrade.next_tier, "investor");
    assertEquals(payload.upgrade.next_tier_price_usd, 24.97);
  } else {
    throw new Error("expected upgrade available for paid tier");
  }
  // Buyers see three top-up packs.
  assertEquals(payload.topup.available, true);
  if (payload.topup.available) {
    assertEquals(payload.topup.packs.length, 3);
  }
});

Deno.test("buildBudgetExceededPayload — premium has no upgrade", async () => {
  const err = new BudgetExceededError("investor", 1.6, 1.5, "general_chat");
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.tier_display, "Investor");
  assertEquals(payload.upgrade.available, false);
  assertEquals(payload.upgrade.next_tier, null);
  assertEquals(payload.upgrade.checkout_url, null);
  // Investors still get top-up packs.
  assertEquals(payload.topup.available, true);
});

Deno.test("nextUtcMidnightIso — returns next UTC midnight", () => {
  const now = new Date(Date.UTC(2026, 5, 2, 14, 30, 0));
  const iso = nextUtcMidnightIso(now);
  assertEquals(iso, "2026-06-03T00:00:00.000Z");
});

Deno.test("buildBudgetExceededPayload — monthly cap_type passes through", async () => {
  const err = new BudgetExceededError(
    "buyer", 0.30, 0.50, "general_chat", undefined, "monthly", 12.10, 12.00,
  );
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.cap_type, "monthly");
  assertEquals(payload.usage_month_usd, 12.10);
  assertEquals(payload.monthly_limit_usd, 12.00);
});

Deno.test("buildBudgetExceededPayload — monthly reset_at points to next UTC month", async () => {
  const err = new BudgetExceededError(
    "buyer", 0.05, 0.50, "general_chat", undefined, "monthly", 12.00, 12.00,
  );
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.reset_at, firstOfNextMonthIso());
});

Deno.test("buildBudgetExceededPayload — monthly free tier still routes to upgrade, no topup", async () => {
  const err = new BudgetExceededError(
    "free", 0.01, 0.10, "general_chat", undefined, "monthly", 3.10, 3.00,
  );
  const payload = await buildBudgetExceededPayload(err);
  assertEquals(payload.cap_type, "monthly");
  assertEquals(payload.upgrade.available, true);
  assertEquals(payload.topup.available, false);
});

Deno.test("firstOfNextMonthIso — wraps year on December", () => {
  const now = new Date(Date.UTC(2026, 11, 15, 10, 0, 0));
  assertEquals(firstOfNextMonthIso(now), "2027-01-01T00:00:00.000Z");
});

Deno.test("getBudgetLimits / getMonthlyBudgetLimits — default tier thresholds", () => {
  const daily = getBudgetLimits();
  assertEquals(daily.free, 0.10);
  assertEquals(daily.buyer, 0.50);
  assertEquals(daily.investor, 1.50);

  const monthly = getMonthlyBudgetLimits();
  assertEquals(monthly.free, 3);
  assertEquals(monthly.buyer, 12);
  assertEquals(monthly.investor, 40);
});