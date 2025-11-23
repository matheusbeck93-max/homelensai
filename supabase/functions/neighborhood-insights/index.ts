import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NeighborhoodRequest {
  address: string;
  city: string;
  state: string;
  zip: string;
}

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, city, state, zip } = await req.json() as NeighborhoodRequest;

    console.log('Fetching neighborhood insights for:', { address, city, state, zip });

    // For now, generate comprehensive mock data based on location
    // In production, this would call multiple APIs:
    // - GreatSchools API for school ratings
    // - Walk Score API for walkability
    // - Crime Data APIs for safety statistics
    // - Google Places/Yelp for amenities

    const insights: NeighborhoodInsights = generateMockInsights(city, state, zip);

    return new Response(
      JSON.stringify({ insights }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in neighborhood-insights function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateMockInsights(city: string, state: string, zip: string): NeighborhoodInsights {
  // Generate realistic mock data based on location
  // Using ZIP code to create consistent but varied data
  const zipNum = parseInt(zip) || 22206;
  const seed = zipNum % 100;

  // Walk score varies by urban density
  const walkScore = 45 + (seed % 50);
  const transitScore = 35 + (seed % 60);
  const bikeScore = 40 + (seed % 55);

  // Crime rate inversely correlates with median income
  const crimeRate = Math.max(10, 50 - (seed % 35));
  const overallRating = crimeRate < 20 ? 'Low Crime' : crimeRate < 35 ? 'Moderate Crime' : 'Above Average Crime';

  // Demographics vary by location
  const medianIncome = 55000 + (seed * 1000);
  const population = 8000 + (seed * 200);

  return {
    schools: [
      {
        name: `${city} Elementary School`,
        type: 'Elementary',
        rating: 7 + (seed % 3),
        distance: 0.5 + (seed % 10) / 10,
        grades: 'K-5',
      },
      {
        name: `${city} Middle School`,
        type: 'Middle',
        rating: 6 + (seed % 4),
        distance: 0.8 + (seed % 15) / 10,
        grades: '6-8',
      },
      {
        name: `${state} High School`,
        type: 'High',
        rating: 8 + (seed % 2),
        distance: 1.2 + (seed % 20) / 10,
        grades: '9-12',
      },
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
      categories: {
        violent: crimeRate * 0.3,
        property: crimeRate * 0.5,
        other: crimeRate * 0.2,
      },
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
