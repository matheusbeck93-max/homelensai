import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { requireTier } from "../tiers";
import { logMcpCall } from "../usageLog";

const TOOL = "rental_calculator";

export default defineTool({
  name: TOOL,
  title: "Rental / investment calculator",
  description:
    "Compute rental-property metrics: monthly cash flow, cap rate, cash-on-cash return, and DSCR. Investor plan only.",
  inputSchema: {
    purchasePrice: z.number().positive().describe("Purchase price in USD."),
    downPayment: z.number().nonnegative().describe("Down payment in USD."),
    interestRate: z.number().positive().max(30).describe("Annual mortgage interest rate as a percent."),
    loanTermYears: z.number().int().positive().max(40).default(30),
    monthlyRent: z.number().positive().describe("Expected monthly rent in USD."),
    monthlyExpenses: z.number().nonnegative().describe("Monthly operating expenses (taxes, insurance, HOA, maintenance, mgmt) in USD."),
    vacancyRatePct: z.number().nonnegative().max(50).default(5).describe("Assumed vacancy rate as a percent (default 5)."),
    closingCosts: z.number().nonnegative().optional().describe("Closing costs in USD (default 3% of purchase price)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "investor" });
    if (!gate.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "gated", latencyMs: Date.now() - started });
      return gate.upgrade!;
    }

    const loanAmount = Math.max(0, input.purchasePrice - input.downPayment);
    const r = input.interestRate / 100 / 12;
    const n = input.loanTermYears * 12;
    const monthlyPI = r === 0 ? loanAmount / n : (loanAmount * r) / (1 - Math.pow(1 + r, -n));
    const vacancyLoss = input.monthlyRent * (input.vacancyRatePct / 100);
    const effectiveRent = input.monthlyRent - vacancyLoss;
    const monthlyCashFlow = effectiveRent - input.monthlyExpenses - monthlyPI;
    const noiAnnual = (effectiveRent - input.monthlyExpenses) * 12;
    const capRate = input.purchasePrice > 0 ? (noiAnnual / input.purchasePrice) * 100 : 0;
    const closing = input.closingCosts ?? input.purchasePrice * 0.03;
    const cashInvested = input.downPayment + closing;
    const cashOnCash = cashInvested > 0 ? ((monthlyCashFlow * 12) / cashInvested) * 100 : 0;
    const annualDebtService = monthlyPI * 12;
    const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : 0;

    const result = {
      monthlyPI: Math.round(monthlyPI),
      effectiveMonthlyRent: Math.round(effectiveRent),
      monthlyCashFlow: Math.round(monthlyCashFlow),
      annualNOI: Math.round(noiAnnual),
      capRatePct: Number(capRate.toFixed(2)),
      cashOnCashPct: Number(cashOnCash.toFixed(2)),
      dscr: Number(dscr.toFixed(2)),
      cashInvested: Math.round(cashInvested),
      loanAmount: Math.round(loanAmount),
      inputs: input,
    };

    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "ok", latencyMs: Date.now() - started });
    const verdict =
      monthlyCashFlow >= 0 && dscr >= 1.2
        ? "Positive cash flow with healthy DSCR."
        : monthlyCashFlow >= 0
        ? "Positive cash flow but DSCR is thin — lenders may push back."
        : "Negative cash flow at these assumptions.";
    const summary =
      `Monthly cash flow: $${result.monthlyCashFlow.toLocaleString()}. ` +
      `Cap rate ${result.capRatePct}%, cash-on-cash ${result.cashOnCashPct}%, DSCR ${result.dscr}. ${verdict}`;
    return {
      content: [
        { type: "text", text: summary },
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
      structuredContent: result,
    };
  },
});