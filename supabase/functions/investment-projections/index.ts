import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { property, portfolioData, years = 20 } = await req.json();

    if (!property || !portfolioData) {
      return new Response(
        JSON.stringify({ error: 'Property and portfolio data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate investment analyst. Return only valid JSON, no markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let projectionsText = aiData.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    projectionsText = projectionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const projections = JSON.parse(projectionsText);

    return new Response(
      JSON.stringify(projections),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Investment projections error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate projections';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
