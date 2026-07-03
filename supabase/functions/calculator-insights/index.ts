import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Auth + credits in one call. Rejects unauthenticated callers with 401.
    // Previously calculator-insights was JWT-protected at the Supabase gateway
    // but didn't consume credits — free users got unlimited per-property AI
    // analyses. See homelens_public_endpoints_fix_prompt.md P0-5.
    const credits = await precheckAiCredits(req, 'calculator-insights');
    if (!credits.allowed && credits.response) return credits.response;

    const { buyingPower, mortgage } = await req.json();

    const prompt = `You are a U.S. real estate and mortgage advisor. Analyze the following financial data and provide clear, actionable insights. You can analyze each calculator independently OR provide a combined assessment if both are filled.

${buyingPower && buyingPower.annualIncome > 0 ? `
BUYING POWER ANALYSIS:
- Annual Income: $${buyingPower.annualIncome?.toLocaleString() || '0'}
- Monthly Debts: $${buyingPower.monthlyDebts?.toLocaleString() || '0'}
- Current DTI Ratio: ${buyingPower.actualDTI}%
- Down Payment Available: $${buyingPower.downPaymentAvailable?.toLocaleString() || '0'}
- Estimated Buying Power: $${buyingPower.estimatedBuyingPower?.toLocaleString() || '0'}
- Max Affordable Monthly Payment: $${buyingPower.maxAffordablePayment?.toLocaleString() || '0'}
` : ''}

${mortgage && mortgage.homePrice > 0 ? `
MORTGAGE CALCULATION (PITI):
- Home Price: $${mortgage.homePrice?.toLocaleString() || '0'}
- Down Payment: $${mortgage.downPayment?.toLocaleString() || '0'} (${mortgage.downPaymentPercent}%)
- Loan Amount: $${mortgage.loanAmount?.toLocaleString() || '0'}
- Interest Rate: ${mortgage.interestRate}%
- Loan Term: ${mortgage.loanTerm} years
- Monthly P&I: $${mortgage.monthlyPI?.toLocaleString() || '0'}
- Monthly Property Tax: $${mortgage.monthlyPropertyTax?.toLocaleString() || '0'} (${mortgage.propertyTaxRate}% annually)
- Monthly Insurance: $${mortgage.monthlyInsurance?.toLocaleString() || '0'}
- Monthly HOA: $${mortgage.hoaMonthly?.toLocaleString() || '0'}
${mortgage.monthlyPMI > 0 ? `- Monthly PMI: $${mortgage.monthlyPMI?.toLocaleString() || '0'} (${mortgage.pmiRate}%)` : ''}
- TOTAL Monthly Payment: $${mortgage.totalMonthlyPayment?.toLocaleString() || '0'}
${mortgage.points > 0 ? `- Points: ${mortgage.points}%` : ''}
${mortgage.closingCosts > 0 ? `- Closing Costs: $${mortgage.closingCosts?.toLocaleString() || '0'}` : ''}
` : ''}

Provide insights in bullet-point format (4-8 bullets depending on available data):

${buyingPower && buyingPower.annualIncome > 0 ? `
💵 BUYING POWER INSIGHTS:
- Assess the DTI ratio (${buyingPower.actualDTI}%) - Is it healthy? (Under 30% is excellent, 30-43% is acceptable, above 43% is risky)
- Evaluate their estimated buying power of $${buyingPower.estimatedBuyingPower?.toLocaleString() || '0'} based on their down payment
- Provide Conservative, Standard, and Aggressive spending capacity estimates (10%, 20%, 30% of disposable income)
- Provide actionable recommendations to improve buying power if needed
` : ''}

${mortgage && mortgage.homePrice > 0 ? `
🏡 MORTGAGE ANALYSIS:
- Break down what makes up the monthly payment (P&I, taxes, insurance, HOA, PMI)
- Is this a manageable payment for most homebuyers?
${mortgage.downPaymentPercent < 20 ? `- Note that PMI is required (down payment is ${mortgage.downPaymentPercent}% - less than 20%)` : '- Good: No PMI needed (down payment ≥ 20%)'}
- Compare interest rate (${mortgage.interestRate}%) to current market averages
- Mention if FHA, VA, or USDA might be better loan options
` : ''}

${buyingPower && buyingPower.annualIncome > 0 && mortgage && mortgage.homePrice > 0 ? `
🔀 COMBINED ANALYSIS:
- Compare the mortgage payment ($${mortgage.totalMonthlyPayment?.toLocaleString()}) to max affordable payment ($${buyingPower.maxAffordablePayment?.toLocaleString()})
- Is this mortgage affordable based on their buying power?
- Calculate housing expense ratio: What % of monthly income goes to this payment?
- Provide specific recommendations based on affordability gap (if any)
` : ''}

Requirements:
- Use bullet points (one per line, starting with "-")
- Be specific and data-driven
- Professional yet friendly tone
- Focus on actionable insights
- Analyze calculators independently when only partial data is provided
- For mortgage analysis, explain PITI components and affordability`;

    const aiResult = await callAiGateway([
      { role: 'system', content: `You are a U.S. mortgage and real estate financial advisor.

Response style:
- Open with a clear verdict (affordable / stretched / risky, or the headline number) in the first sentence — no preambles, no restating inputs, no ambiguous "it depends" openers.
- Lead with the numbers and conclusions that change the user's decision (affordability, monthly cost, risk).
- Keep it scannable: short paragraphs, flat bullets (max 1 level of nesting), no tables unless comparing 3+ scenarios.
- Prefer bullets when they improve scanability — use a flat bullet list for 3+ supporting factors; use prose for 1–2 connected points or the verdict sentence.
- Conciseness: cut filler ~15–20%. Every line must affect a decision; no transitional padding or recap.
- Separate assumptions from the main answer when they matter.
- Include a "next variable to test" only when it materially helps the decision — skip generic next-step suggestions.
- Skip generic market commentary and filler.` },
      { role: 'user', content: prompt }
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
    console.error('Error in calculator-insights function:', error);
    return errorResponse(getErrorMessage(error));
  }
})(req)));
