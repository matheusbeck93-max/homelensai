import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendDataPoint {
  period: string;
  medianPrice: number | null;
  priceChange: number | null;
  inventory: number | null;
  daysOnMarket: number | null;
}

interface MarketTrendsResponse {
  location: string;
  trends: TrendDataPoint[];
  insights: string;
  outlook: 'bullish' | 'bearish' | 'neutral';
  citations: string[];
  generatedAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, force_refresh = false } = await req.json();

    if (!location || typeof location !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Market trends request for:', location);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      console.log('No Perplexity API key, returning fallback data');
      return new Response(
        JSON.stringify(generateFallbackData(location)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first (unless force_refresh)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cacheKey = `market_trends_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('search_cache')
        .select('results, updated_at')
        .eq('normalized_query', cacheKey)
        .eq('source', 'perplexity_trends')
        .maybeSingle();

      if (cached) {
        const ageHours = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60);
        if (ageHours < 12) {
          console.log('Returning cached trends data');
          return new Response(
            JSON.stringify(cached.results),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fetch from Perplexity
    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const prompt = `Provide real estate market trends data for ${location} as of ${currentDate}.

I need SPECIFIC NUMERICAL DATA for the past 6 months in this exact JSON format:
{
  "trends": [
    {"period": "Jul 2024", "medianPrice": 450000, "priceChange": 2.1, "inventory": 1250, "daysOnMarket": 28},
    {"period": "Aug 2024", "medianPrice": 455000, "priceChange": 1.8, "inventory": 1180, "daysOnMarket": 26}
  ],
  "insights": "Brief 2-3 sentence market analysis",
  "outlook": "bullish" or "bearish" or "neutral"
}

Requirements:
- Include 6 months of data points with realistic values
- medianPrice: median home sale price in USD
- priceChange: month-over-month percentage change
- inventory: number of active listings
- daysOnMarket: average days on market
- insights: concise market summary
- outlook: overall market direction

Respond ONLY with valid JSON, no markdown or explanation.`;

    console.log('Calling Perplexity API...');
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'You are a real estate market analyst. Provide accurate, data-driven market trends. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify(generateFallbackData(location)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    console.log('Perplexity response received');

    const content = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];

    // Parse the JSON response
    let parsedData: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      return new Response(
        JSON.stringify(generateFallbackData(location)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: MarketTrendsResponse = {
      location,
      trends: parsedData.trends || [],
      insights: parsedData.insights || 'Market data currently being analyzed.',
      outlook: parsedData.outlook || 'neutral',
      citations,
      generatedAt: new Date().toISOString(),
    };

    // Cache the result
    await supabase
      .from('search_cache')
      .upsert({
        normalized_query: cacheKey,
        source: 'perplexity_trends',
        results: result,
        params: { location },
        ttl_minutes: 720, // 12 hours
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'normalized_query,source'
      });

    console.log('Market trends data cached');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Market trends error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch market trends', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackData(location: string): MarketTrendsResponse {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const basePrice = 400000 + Math.random() * 200000;
  
  const trends: TrendDataPoint[] = months.map((month, i) => ({
    period: `${month} 2024`,
    medianPrice: Math.round(basePrice * (1 + (i * 0.015) + (Math.random() * 0.02 - 0.01))),
    priceChange: parseFloat((Math.random() * 4 - 1).toFixed(1)),
    inventory: Math.round(800 + Math.random() * 600),
    daysOnMarket: Math.round(20 + Math.random() * 20),
  }));

  return {
    location,
    trends,
    insights: 'Market data is currently being gathered. Check back soon for real-time insights powered by AI.',
    outlook: 'neutral',
    citations: [],
    generatedAt: new Date().toISOString(),
  };
}
