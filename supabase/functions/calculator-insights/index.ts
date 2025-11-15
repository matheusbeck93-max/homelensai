import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buyingPower, mortgage } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a knowledgeable U.S. mortgage and real estate financial advisor providing clear, actionable insights.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error('Failed to generate insights');
    }

    const data = await response.json();
    const insights = data.choices[0].message.content;

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calculator-insights function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
