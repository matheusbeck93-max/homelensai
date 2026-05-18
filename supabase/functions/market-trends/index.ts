import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const log = createLogger('market-trends');

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

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req, 'market-trends');
    if (!credits.allowed && credits.response) return credits.response;

    const { location, force_refresh = false } = await req.json();

    if (!location || typeof location !== 'string') {
      return validationError('Location is required');
    }

    log.info('Market trends request for:', location);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      log.info('No Perplexity API key, returning fallback data');
      return jsonResponse(generateFallbackData(location));
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
          log.info('Returning cached trends data');
          return jsonResponse(cached.results);
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

    log.info('Calling Perplexity API...');
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'You are a real estate market analyst. Provide accurate, data-driven market trends. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      log.error('Perplexity API error:', perplexityResponse.status, errorText);
      return jsonResponse(generateFallbackData(location));
    }

    const perplexityData = await perplexityResponse.json();
    log.info('Perplexity response received');

    const content = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];

    let parsedData: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      log.error('Failed to parse Perplexity response:', parseError);
      return jsonResponse(generateFallbackData(location));
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
        ttl_minutes: 720,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'normalized_query,source'
      });

    log.info('Market trends data cached');

    return jsonResponse(result);

  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
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
