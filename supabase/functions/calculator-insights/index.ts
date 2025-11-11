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
    const { financialSummary, buyingPower } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `You are a real estate investment advisor. Analyze the following financial data and provide clear, actionable insights in 3-4 paragraphs:

Financial Summary:
- Property Price: $${financialSummary.propertyPrice.toLocaleString()}
- Down Payment: $${financialSummary.downPaymentAmount.toLocaleString()}
- Loan Amount: $${financialSummary.loanAmount.toLocaleString()}
- Total Acquisition Cost: $${financialSummary.totalAcquisition.toLocaleString()}
- Monthly Mortgage Payment: $${financialSummary.monthlyMortgage.toLocaleString()}
- Total Monthly Cost: $${financialSummary.totalMonthlyCost.toLocaleString()}
${financialSummary.monthlyCashFlow !== null ? `- Monthly Cash Flow: $${financialSummary.monthlyCashFlow.toLocaleString()}` : ''}
${financialSummary.annualROI !== null ? `- Annual ROI: ${financialSummary.annualROI.toFixed(2)}%` : ''}
${financialSummary.paybackPeriod !== null && financialSummary.paybackPeriod < 100 ? `- Payback Period: ${financialSummary.paybackPeriod.toFixed(1)} years` : ''}

Buying Power:
- Annual Income: $${buyingPower.annualIncome.toLocaleString()}
- Monthly Debts: $${buyingPower.monthlyDebts.toLocaleString()}
- Down Payment Available: $${buyingPower.downPaymentAvailable.toLocaleString()}
- Maximum Purchase Price: $${buyingPower.maxPurchasePrice.toLocaleString()}
- Maximum Loan Amount: $${buyingPower.maxLoanAmount.toLocaleString()}
- Maximum Monthly Payment: $${buyingPower.maxMonthlyPayment.toLocaleString()}

Provide:
1. An assessment of whether this property fits within their buying power
2. Analysis of the investment viability (cash flow, ROI, risks)
3. Key considerations and recommendations
4. Potential red flags or opportunities

Keep it concise but informative. Write in a professional yet friendly tone.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a knowledgeable real estate investment advisor providing clear, actionable insights.' },
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
