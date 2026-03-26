import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const { property, portfolioData, years = 20 } = await req.json();

    if (!property || !portfolioData) {
      return validationError('Property and portfolio data required');
    }

    // Calculate initial metrics
    const loanAmount = portfolioData.purchase_price * (1 - portfolioData.down_payment_pct / 100);
    const monthlyRate = portfolioData.interest_rate_pct / 100 / 12;
    const numPayments = portfolioData.loan_term_years * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                           (Math.pow(1 + monthlyRate, numPayments) - 1);

    const prompt = `As a real estate investment analyst, create a detailed ${years}-year projection for this property investment.

Property Details:
- Address: ${property.address}, ${property.city}, ${property.state}
- Purchase Price: $${portfolioData.purchase_price.toLocaleString()}
- Down Payment: ${portfolioData.down_payment_pct}% ($${(portfolioData.purchase_price * portfolioData.down_payment_pct / 100).toLocaleString()})
- Loan Amount: $${loanAmount.toLocaleString()}
- Interest Rate: ${portfolioData.interest_rate_pct}%
- Loan Term: ${portfolioData.loan_term_years} years
- Monthly Rent: $${portfolioData.monthly_rent.toLocaleString()}
- Monthly Expenses: $${portfolioData.monthly_expenses.toLocaleString()}
- Monthly Mortgage Payment: $${monthlyPayment.toFixed(2)}

Create year-by-year projections (Years 1, 5, 10, 15, 20) with:

1. Property Value Appreciation (realistic 3-4% annual appreciation for this market)
2. Equity Position (mortgage principal paid down + appreciation)
3. Annual Cash Flow (rent minus all expenses including vacancy, considering 2-3% annual rent increases)
4. Cumulative Cash Flow (total cash flow over time)
5. Total Return on Investment (equity + cumulative cash flow vs initial investment)

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "projections": [
    {
      "year": 1,
      "propertyValue": number,
      "equityPosition": number,
      "annualCashFlow": number,
      "cumulativeCashFlow": number,
      "totalROI": number
    }
  ],
  "assumptions": {
    "appreciationRate": number,
    "rentGrowthRate": number,
    "vacancyRate": number,
    "expenseGrowthRate": number
  },
  "summary": {
    "totalAppreciation": number,
    "totalEquityGain": number,
    "totalCashFlow": number,
    "finalROI": number,
    "averageAnnualReturn": number
  }
}`;

    const aiResult = await callAiGateway(
      [
        { role: 'system', content: 'You are a real estate investment analyst. Return only valid JSON, no markdown formatting.' },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.7 }
    );

    if ('error' in aiResult) return aiResult.error;

    let projectionsText = aiResult.result.message.trim();
    
    // Remove markdown code blocks if present
    projectionsText = projectionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const projections = JSON.parse(projectionsText);

    return jsonResponse(projections);

  } catch (error) {
    console.error('Investment projections error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
