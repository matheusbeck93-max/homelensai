import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkBudget, getBudgetLimits } from "../budgetGuard.ts";

// Minimal fake client that returns a preset cost-row set for any query.
function fakeClient(rows: Array<{ cost_usd: number }>): any {
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        // Resolve to PostgREST-shaped response on the final `eq`.
        then(resolve: any) { resolve({ data: rows, error: null }); },
      };
    },
  };
}

Deno.test("checkBudget returns allowed=true when spend below cap", async () => {
  const limits = getBudgetLimits();
  const status = await checkBudget("user-1", "free", {
    client: fakeClient([{ cost_usd: 0.01 }, { cost_usd: 0.02 }]),
    limits,
  });
  assert(status.allowed);
  assertEquals(status.usedUsd, 0.03);
  assertEquals(status.capUsd, limits.free);
});

Deno.test("checkBudget returns allowed=false when spend at or above cap", async () => {
  const status = await checkBudget("user-1", "free", {
    client: fakeClient([{ cost_usd: 5 }]),
    limits: { free: 1, paid: 10, premium: 100 },
  });
  assertEquals(status.allowed, false);
  assertEquals(status.usedUsd, 5);
  assertEquals(status.capUsd, 1);
  assertEquals(status.remainingUsd, 0);
});

Deno.test("checkBudget fails open when no userId", async () => {
  const status = await checkBudget("", "premium", {
    client: fakeClient([{ cost_usd: 999 }]),
    limits: { free: 1, paid: 10, premium: 100 },
  });
  assert(status.allowed);
});

Deno.test("checkBudget bypasses when AI_BUDGET_DISABLED=1", async () => {
  Deno.env.set("AI_BUDGET_DISABLED", "1");
  try {
    const status = await checkBudget("user-1", "free", {
      client: fakeClient([{ cost_usd: 999 }]),
      limits: { free: 0.01, paid: 0.01, premium: 0.01 },
    });
    assert(status.allowed);
  } finally {
    Deno.env.delete("AI_BUDGET_DISABLED");
  }
});