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

    const prompt = `You are a real estate investment advisor. Analyze the following financial data and provide clear, actionable insights. You can analyze each segment independently OR provide an overall assessment if all data is provided.

${financialSummary.propertyPrice > 0 ? `
PROPERTY & INVESTMENT SCENARIO:
- Property: ${buyingPower.propertyType || 'N/A'} in ${buyingPower.propertyLocation || 'location not specified'}
- Property Price: $${financialSummary.propertyPrice?.toLocaleString() || '0'}
- Down Payment: $${financialSummary.downPaymentAmount?.toLocaleString() || '0'}
- Loan Amount: $${financialSummary.loanAmount?.toLocaleString() || '0'}
- Total Acquisition Cost: $${financialSummary.totalAcquisition?.toLocaleString() || '0'}
- Monthly Mortgage Payment: $${financialSummary.monthlyMortgage?.toLocaleString() || '0'}
- Total Monthly Cost: $${financialSummary.totalMonthlyCost?.toLocaleString() || '0'}
${financialSummary.monthlyCashFlow !== null && financialSummary.monthlyCashFlow !== undefined ? `- Monthly Cash Flow: $${financialSummary.monthlyCashFlow.toLocaleString()}` : ''}
${financialSummary.annualROI !== null && financialSummary.annualROI !== undefined ? `- Annual ROI: ${financialSummary.annualROI.toFixed(2)}%` : ''}
${financialSummary.paybackPeriod !== null && financialSummary.paybackPeriod !== undefined && financialSummary.paybackPeriod < 100 ? `- Payback Period: ${financialSummary.paybackPeriod.toFixed(1)} years` : ''}
` : ''}

${buyingPower.annualIncome > 0 ? `
BUYING POWER ANALYSIS:
- Annual Income: $${buyingPower.annualIncome?.toLocaleString() || '0'}
- Monthly Debts: $${buyingPower.monthlyDebts?.toLocaleString() || '0'}
- Current DTI Ratio: ${buyingPower.actualDTI}%
- Down Payment Available: $${buyingPower.downPaymentAvailable?.toLocaleString() || '0'}
- Estimated Buying Power: $${buyingPower.estimatedBuyingPower?.toLocaleString() || '0'}
- Max Affordable Monthly Payment: $${buyingPower.maxAffordablePayment?.toLocaleString() || '0'}
` : ''}

Provide insights in bullet-point format (4-8 bullets depending on available data):

${buyingPower.annualIncome > 0 ? `
BUYING POWER INSIGHTS:
- Assess the DTI ratio (${buyingPower.actualDTI}%) - Is it healthy? (Under 30% is excellent, 30-43% is acceptable, above 43% is risky)
- Evaluate their estimated buying power of $${buyingPower.estimatedBuyingPower?.toLocaleString() || '0'} based on their down payment
- Provide actionable recommendations to improve buying power if needed
` : ''}

${financialSummary.propertyPrice > 0 && buyingPower.propertyLocation ? `
MARKET VALUATION INSIGHTS (CRITICAL - Include local market context):
- Research and provide insights on ${buyingPower.propertyLocation} market conditions
- Is $${financialSummary.propertyPrice?.toLocaleString()} reasonable for a ${buyingPower.propertyType} in this area?
- Compare to typical market prices and trends in ${buyingPower.propertyLocation}
- Mention any market factors (appreciation trends, inventory levels, demand)
` : ''}

${financialSummary.propertyPrice > 0 && buyingPower.annualIncome > 0 ? `
COMBINED ANALYSIS:
- Compare the property price ($${financialSummary.propertyPrice?.toLocaleString()}) against their buying power ($${buyingPower.estimatedBuyingPower?.toLocaleString()})
- Is this property within their budget? If not, by how much?
- Provide specific recommendations based on the gap (if any)
` : ''}

${financialSummary.monthlyCashFlow !== null && financialSummary.monthlyCashFlow !== undefined ? `
INVESTMENT ANALYSIS:
- Evaluate the investment potential with ${financialSummary.monthlyCashFlow >= 0 ? 'positive' : 'negative'} cash flow of $${financialSummary.monthlyCashFlow?.toLocaleString()}
- Assess the ${financialSummary.annualROI?.toFixed(2)}% ROI - is this competitive?
- Comment on the payback period and long-term potential
` : ''}

Requirements:
- Use bullet points (one per line, starting with "-")
- Be specific and data-driven
- Professional yet friendly tone
- Focus on actionable insights
- ALWAYS include market reasoning when property location is provided
- Analyze segments independently when only partial data is provided`;

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
