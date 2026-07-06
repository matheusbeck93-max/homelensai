import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { currentTier } from "../tiers";
import { internalCall } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "mortgage_calculator";

function computeMortgage(input: {
  homePrice: number;
  downPayment: number;
  interestRate: number;
  loanTermYears: number;
  propertyTaxRate?: number;
  insuranceMonthly?: number;
  hoaMonthly?: number;
}) {
  const loanAmount = Math.max(0, input.homePrice - input.downPayment);
  const r = input.interestRate / 100 / 12;
  const n = input.loanTermYears * 12;
  const monthlyPI = r === 0 ? loanAmount / n : (loanAmount * r) / (1 - Math.pow(1 + r, -n));
  const dpPct = input.homePrice > 0 ? (input.downPayment / input.homePrice) * 100 : 0;
  const monthlyPMI = dpPct < 20 ? (loanAmount * 0.0075) / 12 : 0;
  const taxRate = input.propertyTaxRate ?? 1.1;
  const monthlyTax = (input.homePrice * (taxRate / 100)) / 12;
  const insurance = input.insuranceMonthly ?? Math.round((input.homePrice * 0.0035) / 12);
  const hoa = input.hoaMonthly ?? 0;
  const total = monthlyPI + monthlyPMI + monthlyTax + insurance + hoa;
  return {
    loanAmount: Math.round(loanAmount),
    downPaymentPercent: Number(dpPct.toFixed(1)),
    monthlyPI: Math.round(monthlyPI),
    monthlyPMI: Math.round(monthlyPMI),
    monthlyPropertyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(insurance),
    hoaMonthly: Math.round(hoa),
    totalMonthlyPayment: Math.round(total),
    propertyTaxRate: taxRate,
    interestRate: input.interestRate,
    loanTerm: input.loanTermYears,
    homePrice: input.homePrice,
    downPayment: input.downPayment,
  };
}

export default defineTool({
  name: TOOL,
  title: "Mortgage calculator",
  description:
    "Calculate a full US mortgage payment (P&I, PMI, taxes, insurance, HOA). Automatically adds PMI when down payment < 20%. Includes HomeLens AI commentary on affordability.",
  inputSchema: {
    homePrice: z.number().positive().describe("Home price in USD."),
    downPayment: z.number().nonnegative().describe("Down payment amount in USD."),
    interestRate: z.number().positive().max(30).describe("Annual interest rate as a percent (e.g. 6.5)."),
    loanTermYears: z.number().int().positive().max(40).default(30).describe("Loan term in years (default 30)."),
    propertyTaxRate: z.number().nonnegative().max(10).optional().describe("Annual property tax rate as a percent. Defaults to ~1.1%."),
    insuranceMonthly: z.number().nonnegative().optional().describe("Monthly insurance premium in USD."),
    hoaMonthly: z.number().nonnegative().optional().describe("Monthly HOA fee in USD."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const tier = await currentTier(ctx);
    const mortgage = computeMortgage(input);

    // AI commentary is best-effort; on failure we still return the numbers.
    const ai = await internalCall<{ insights?: string; response?: string }>(
      "calculator-insights",
      { buyingPower: {}, mortgage },
      ctx,
    );
    const commentary = ai.ok
      ? ((ai.data as { insights?: string; response?: string })?.insights
          ?? (ai.data as { response?: string })?.response
          ?? "")
      : "";

    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "ok", latencyMs: Date.now() - started });
    const summary =
      `Estimated total monthly payment: $${mortgage.totalMonthlyPayment.toLocaleString()} ` +
      `(P&I $${mortgage.monthlyPI.toLocaleString()}, tax $${mortgage.monthlyPropertyTax.toLocaleString()}, ` +
      `insurance $${mortgage.monthlyInsurance.toLocaleString()}` +
      (mortgage.monthlyPMI ? `, PMI $${mortgage.monthlyPMI.toLocaleString()}` : "") +
      (mortgage.hoaMonthly ? `, HOA $${mortgage.hoaMonthly.toLocaleString()}` : "") +
      `).`;
    return {
      content: [
        { type: "text", text: summary },
        ...(commentary ? [{ type: "text" as const, text: commentary }] : []),
        { type: "text", text: JSON.stringify(mortgage, null, 2) },
      ],
      structuredContent: { mortgage, commentary },
    };
  },
});