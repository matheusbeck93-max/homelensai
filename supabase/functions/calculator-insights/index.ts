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

    const prompt = `You are a real estate investment advisor. Analyze the following financial data and provide clear, actionable insights in concise bullet-point format:

Financial Summary:
- Property Price: $${financialSummary.propertyPrice?.toLocaleString() || '0'}
- Down Payment: $${financialSummary.downPaymentAmount?.toLocaleString() || '0'}
- Loan Amount: $${financialSummary.loanAmount?.toLocaleString() || '0'}
- Total Acquisition Cost: $${financialSummary.totalAcquisition?.toLocaleString() || '0'}
- Monthly Mortgage Payment: $${financialSummary.monthlyMortgage?.toLocaleString() || '0'}
- Total Monthly Cost: $${financialSummary.totalMonthlyCost?.toLocaleString() || '0'}
${financialSummary.monthlyCashFlow !== null && financialSummary.monthlyCashFlow !== undefined ? `- Monthly Cash Flow: $${financialSummary.monthlyCashFlow.toLocaleString()}` : ''}
${financialSummary.annualROI !== null && financialSummary.annualROI !== undefined ? `- Annual ROI: ${financialSummary.annualROI.toFixed(2)}%` : ''}
${financialSummary.paybackPeriod !== null && financialSummary.paybackPeriod !== undefined && financialSummary.paybackPeriod < 100 ? `- Payback Period: ${financialSummary.paybackPeriod.toFixed(1)} years` : ''}

Buying Power (${buyingPower.scenario || 'Moderate'} Scenario - ${buyingPower.dtiRatio || 30}% DTI):
- Annual Income: $${buyingPower.annualIncome?.toLocaleString() || '0'}
- Monthly Debts: $${buyingPower.monthlyDebts?.toLocaleString() || '0'}
- Down Payment Available: $${buyingPower.downPaymentAvailable?.toLocaleString() || '0'}
- Maximum Purchase Price: $${buyingPower.maxPurchasePrice?.toLocaleString() || '0'}
- Maximum Loan Amount: $${buyingPower.maxLoanAmount?.toLocaleString() || '0'}
- Maximum Monthly Payment: $${buyingPower.maxMonthlyPayment?.toLocaleString() || '0'}

Provide insights in the following bullet-point format (4-6 bullet points total):
- First bullet: DTI ratio and whether it's within a healthy range
- Second bullet: Estimated purchase power based on the selected scenario (${buyingPower.scenario || 'Moderate'})
- Third bullet: 2-3 specific, actionable recommendations (e.g., down payment tips, financing advice, market conditions)

Requirements:
- Use bullet points (one per line, starting with "-")
- Keep each bullet concise (1-2 sentences max)
- Professional yet friendly tone
- Focus on actionable insights
- Include specific numbers from the data

Example format:
- Your DTI ratio is X%, which is [assessment].
- With an annual income of $X, your estimated purchase power is around $X ([Scenario] scenario).
- [Specific recommendation based on the data].
- [Additional recommendation or consideration].`;

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
