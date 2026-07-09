import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

type BrrrrInputs = {
  purchasePrice?: number;
  closingCosts?: number;
  rehabBudget?: number;
  holdingMonths?: number;
  monthlyHoldingCost?: number;
  arv?: number;
  refiLtvPct?: number;
  refiRate?: number;
  refiTermYears?: number;
  monthlyRent?: number;
  monthlyOpEx?: number;
};

type BrrrrResults = {
  allInCost?: number;
  refiLoanAmount?: number;
  cashLeftInDeal?: number;
  cashRecycled?: number;
  monthlyPI?: number;
  monthlyCashFlow?: number;
  annualCashFlow?: number;
  cashOnCashPct?: number | null;
  equityCreated?: number;
};

const fmt = (n: number | undefined | null) =>
  typeof n === 'number' && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : 'N/A';
const pct = (n: number | undefined | null) =>
  typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}%` : 'N/A';

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req, 'brrrr-insights');
    if (!credits.allowed && credits.response) return credits.response;

    const { inputs, results } = (await req.json()) as {
      inputs: BrrrrInputs;
      results: BrrrrResults;
    };

    const prompt = `You are a U.S. real estate investment advisor. Analyze this BRRRR (Buy, Rehab, Rent, Refinance, Repeat) deal.

DEAL INPUTS:
- Purchase price: ${fmt(inputs.purchasePrice)}
- Closing costs: ${fmt(inputs.closingCosts)}
- Rehab budget: ${fmt(inputs.rehabBudget)}
- Holding period: ${inputs.holdingMonths ?? 0} months at ${fmt(inputs.monthlyHoldingCost)}/month
- After-Repair Value (ARV): ${fmt(inputs.arv)}
- Refi LTV: ${pct(inputs.refiLtvPct)}
- Refi rate: ${pct(inputs.refiRate)} over ${inputs.refiTermYears ?? 30} years
- Monthly rent: ${fmt(inputs.monthlyRent)}
- Monthly operating expenses: ${fmt(inputs.monthlyOpEx)}

CALCULATED RESULTS:
- All-in cost: ${fmt(results.allInCost)}
- Refi loan amount (${pct(inputs.refiLtvPct)} of ARV): ${fmt(results.refiLoanAmount)}
- Capital recycled at refi: ${fmt(results.cashRecycled)}
- Cash left in deal after refi: ${fmt(results.cashLeftInDeal)}
- Equity created (ARV − all-in): ${fmt(results.equityCreated)}
- Monthly P&I on refi: ${fmt(results.monthlyPI)}
- Monthly cash flow (rent − opex − P&I): ${fmt(results.monthlyCashFlow)}
- Annual cash flow: ${fmt(results.annualCashFlow)}
- Cash-on-cash return after refi: ${pct(results.cashOnCashPct)}

Deliver an answer-first BRRRR read:
- Open with a one-line verdict (Strong / Marginal / Weak / Rescue-only) tied to the numbers.
- 4-6 flat bullets covering: ARV realism vs all-in, capital recycled vs left in deal, monthly cash flow adequacy (aim ≥ $200/door), cash-on-cash after refi (≥ 8% strong, 4-8% marginal, < 4% weak), and 2-3 concrete next steps (levers to pull, comps/inspections to validate).
- No preambles, no restating every input, no generic disclaimers.`;

    const aiResult = await callAiGateway([
      {
        role: 'system',
        content: `You are a U.S. real estate investment advisor specializing in the BRRRR strategy.

Response style:
- Open with a clear verdict (Strong / Marginal / Weak / Rescue-only) in the first sentence — no preambles.
- Lead with numbers that change the decision (cash-on-cash, capital left in deal, cash flow).
- Flat bullets, short sentences, no tables.
- Cut filler ~15-20%. Every line must affect a decision.
- Skip generic market commentary.`,
      },
      { role: 'user', content: prompt },
    ], credits.userId ? {
      router: {
        surface: 'artifact_generation',
        userId: credits.userId,
        tier: credits.tier === 'unlimited' ? 'investor' as const : (credits.tier === 'paid' ? 'buyer' as const : 'free' as const),
      },
    } : {});

    if ('error' in aiResult) return aiResult.error;

    await deductAiCredits(credits, aiResult.result.usage);
    return jsonResponse({ insights: aiResult.result.message });
  } catch (error) {
    console.error('Error in brrrr-insights function:', error);
    return errorResponse(getErrorMessage(error));
  }
})(req)));