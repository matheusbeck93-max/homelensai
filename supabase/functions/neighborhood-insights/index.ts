import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';

const log = createLogger('neighborhood-insights');

interface School {
  name: string;
  type: string;
  rating: number;
  distance: number;
  grades: string;
}

interface Amenity {
  name: string;
  type: string;
  distance: number;
  rating?: number;
}

interface NeighborhoodInsights {
  schools: School[];
  walkScore: {
    score: number;
    description: string;
    transitScore?: number;
    bikeScore?: number;
  };
  crimeData: {
    overallRating: string;
    crimeRate: number;
    comparison: string;
    categories: {
      violent: number;
      property: number;
      other: number;
    };
  };
  amenities: {
    restaurants: Amenity[];
    parks: Amenity[];
    shopping: Amenity[];
    transit: Amenity[];
  };
  demographics: {
    population: number;
    medianIncome: number;
    medianAge: number;
    homeownershipRate: number;
  };
  aiSummary?: string;
  citations?: string[];
  lastUpdated?: string;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req, 'neighborhood-insights');
    if (!credits.allowed && credits.response) return credits.response;

    const { address, city, state, zip } = await req.json();
    const location = `${address}, ${city}, ${state} ${zip}`;

    log.info('Fetching insights for:', location);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!PERPLEXITY_API_KEY) {
      log.info('No Perplexity API key, using fallback data');
      const insights = generateFallbackInsights(city, state, zip);
      return jsonResponse({ insights, source: 'fallback' });
    }

    // Use Perplexity to get real-time neighborhood data
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
            content: `You are a real estate research assistant. Provide accurate, up-to-date neighborhood information. Always respond with valid JSON matching the exact schema provided. Be precise with numbers and ratings.`
          },
          {
            role: 'user',
            content: `Research the neighborhood at ${location} and provide comprehensive insights. Include:

1. SCHOOLS: Find the 3-4 nearest public schools (elementary, middle, high). Include actual school names, their GreatSchools ratings (1-10), approximate distance, and grade levels served.

2. SAFETY: Research crime statistics for this ZIP code (${zip}). Provide crime index (national average is 50), breakdown by violent/property crime percentages, and comparison to national average.

3. WALKABILITY: Estimate Walk Score (0-100), Transit Score, and Bike Score based on the area's characteristics.

4. AMENITIES: List 3-4 actual nearby restaurants/cafes, parks, shopping centers, and transit options with approximate distances.

5. DEMOGRAPHICS: Provide population, median household income, median age, and homeownership rate for this area.

Respond ONLY with valid JSON in this exact format:
{
  "schools": [{"name": "string", "type": "Elementary|Middle|High", "rating": number, "distance": number, "grades": "string"}],
  "walkScore": {"score": number, "description": "string", "transitScore": number, "bikeScore": number},
  "crimeData": {"overallRating": "Low Crime|Moderate Crime|Above Average Crime", "crimeRate": number, "comparison": "string", "categories": {"violent": number, "property": number, "other": number}},
  "amenities": {
    "restaurants": [{"name": "string", "type": "string", "distance": number, "rating": number}],
    "parks": [{"name": "string", "type": "string", "distance": number}],
    "shopping": [{"name": "string", "type": "string", "distance": number}],
    "transit": [{"name": "string", "type": "string", "distance": number}]
  },
  "demographics": {"population": number, "medianIncome": number, "medianAge": number, "homeownershipRate": number},
  "summary": "A 2-3 sentence summary of this neighborhood's key highlights and considerations for homebuyers."
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!perplexityResponse.ok) {
      log.error('Perplexity API error:', perplexityResponse.status);
      const insights = generateFallbackInsights(city, state, zip);
      return jsonResponse({ insights, source: 'fallback' });
    }

    const perplexityData = await perplexityResponse.json();
    log.info('Perplexity response received');

    const content = perplexityData.choices?.[0]?.message?.content || '';
    const citations = perplexityData.citations || [];

    // Parse the JSON response
    let parsedInsights: NeighborhoodInsights;
    try {
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      const rawData = JSON.parse(jsonStr.trim());
      
      parsedInsights = {
        schools: rawData.schools || [],
        walkScore: rawData.walkScore || { score: 50, description: 'Somewhat Walkable' },
        crimeData: rawData.crimeData || { overallRating: 'Moderate Crime', crimeRate: 50, comparison: 'Average', categories: { violent: 15, property: 25, other: 10 } },
        amenities: rawData.amenities || { restaurants: [], parks: [], shopping: [], transit: [] },
        demographics: rawData.demographics || { population: 10000, medianIncome: 60000, medianAge: 38, homeownershipRate: 65 },
        aiSummary: rawData.summary || '',
        citations: citations,
        lastUpdated: new Date().toISOString(),
      };

      log.info('Successfully parsed Perplexity data');
    } catch (parseError) {
      log.error('Failed to parse Perplexity response:', parseError);
      log.info('Raw content:', content.substring(0, 500));
      
      parsedInsights = generateFallbackInsights(city, state, zip);
      parsedInsights.aiSummary = content.substring(0, 500);
    }

    return jsonResponse({ insights: parsedInsights, source: 'perplexity' });

  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
});

function generateFallbackInsights(city: string, state: string, zip: string): NeighborhoodInsights {
  const zipNum = parseInt(zip) || 22206;
  const seed = zipNum % 100;

  const walkScore = 45 + (seed % 50);
  const transitScore = 35 + (seed % 60);
  const bikeScore = 40 + (seed % 55);

  const crimeRate = Math.max(10, 50 - (seed % 35));
  const overallRating = crimeRate < 20 ? 'Low Crime' : crimeRate < 35 ? 'Moderate Crime' : 'Above Average Crime';

  const medianIncome = 55000 + (seed * 1000);
  const population = 8000 + (seed * 200);

  return {
    schools: [
      { name: `${city} Elementary School`, type: 'Elementary', rating: 7 + (seed % 3), distance: 0.5 + (seed % 10) / 10, grades: 'K-5' },
      { name: `${city} Middle School`, type: 'Middle', rating: 6 + (seed % 4), distance: 0.8 + (seed % 15) / 10, grades: '6-8' },
      { name: `${state} High School`, type: 'High', rating: 8 + (seed % 2), distance: 1.2 + (seed % 20) / 10, grades: '9-12' },
    ],
    walkScore: {
      score: walkScore,
      description: walkScore >= 70 ? 'Very Walkable' : walkScore >= 50 ? 'Somewhat Walkable' : 'Car-Dependent',
      transitScore,
      bikeScore,
    },
    crimeData: {
      overallRating,
      crimeRate,
      comparison: `${Math.abs(50 - crimeRate)}% ${crimeRate < 50 ? 'lower' : 'higher'} than national average`,
      categories: { violent: Math.round(crimeRate * 0.3), property: Math.round(crimeRate * 0.5), other: Math.round(crimeRate * 0.2) },
    },
    amenities: {
      restaurants: [
        { name: 'Local Bistro', type: 'Restaurant', distance: 0.3, rating: 4.5 },
        { name: 'Coffee House', type: 'Cafe', distance: 0.4, rating: 4.3 },
        { name: 'Family Diner', type: 'Restaurant', distance: 0.6, rating: 4.1 },
      ],
      parks: [
        { name: `${city} Community Park`, type: 'Park', distance: 0.4 },
        { name: 'Recreation Center', type: 'Recreation', distance: 0.7 },
      ],
      shopping: [
        { name: 'Grocery Store', type: 'Grocery', distance: 0.5 },
        { name: 'Shopping Center', type: 'Shopping', distance: 0.8 },
        { name: 'Pharmacy', type: 'Health', distance: 0.3 },
      ],
      transit: [
        { name: 'Bus Stop', type: 'Bus', distance: 0.2 },
        { name: 'Metro Station', type: 'Metro', distance: 0.9 },
      ],
    },
    demographics: {
      population,
      medianIncome,
      medianAge: 35 + (seed % 15),
      homeownershipRate: 55 + (seed % 35),
    },
  };
}
