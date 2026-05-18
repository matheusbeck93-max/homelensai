import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage, handleAiGatewayError } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';

const log = createLogger('ai-search');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    const { query, categories } = await req.json();
    const LOVABLE_API_KEY = requireEnv('LOVABLE_API_KEY');
    const authHeader = req.headers.get('Authorization');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user profile for personalization
    let userProfile = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        userProfile = profile;
      }
    }

    // Build context from user profile
    let profileContext = '';
    if (userProfile) {
      const prefs = [];
      if (userProfile.budget_min && userProfile.budget_max) {
        prefs.push(`Budget: $${userProfile.budget_min.toLocaleString()} - $${userProfile.budget_max.toLocaleString()}`);
      }
      if (userProfile.property_types && userProfile.property_types.length > 0) {
        prefs.push(`Preferred property types: ${userProfile.property_types.join(', ')}`);
      }
      if (userProfile.location_preferences && userProfile.location_preferences.length > 0) {
        prefs.push(`Preferred locations: ${userProfile.location_preferences.join(', ')}`);
      }
      if (userProfile.buyer_type) {
        prefs.push(`Buyer type: ${userProfile.buyer_type}`);
      }
      if (userProfile.risk_level) {
        prefs.push(`Risk tolerance: ${userProfile.risk_level}`);
      }
      if (prefs.length > 0) {
        profileContext = `\n\nUser Profile Preferences:\n${prefs.join('\n')}\n\nApply these preferences intelligently to the search. If the user's query conflicts with their profile, prioritize their query.`;
      }
    }

    // Parse natural language query with AI
    const systemPrompt = `You are a property search query parser for US real estate. Convert natural language searches into structured filters.
${categories && categories.length > 0 ? `\nUser context: ${categories.join(', ')}. Tailor the search based on:
- first-time-buyer: Focus on move-in ready homes, FHA-eligible, lower price ranges, good school districts
- investor: Focus on ROI, rental potential, fixer-uppers, multi-family
- mortgage-calculator: Prioritize properties with good financing potential, standard loans
- pre-approval: Include pre-approval friendly properties, competitive rates, VA/FHA eligible` : ''}${profileContext}

Extract and return ONLY valid JSON (no markdown) with these fields:
- price_min (number)
- price_max (number)
- beds_min (number)
- baths_min (number)
- city (string)
- state (string, 2-letter code)
- property_type (string: "condo", "townhome", "single-family", "multi-family")
- hoa_max (number, optional)
- commute_max_minutes (number, optional)

Example: "3-bedroom homes under $650k in Arlington VA" -> 
{"price_max": 650000, "beds_min": 3, "city": "Arlington", "state": "VA"}

If user profile preferences exist and user query doesn't specify certain filters, apply profile defaults intelligently.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
      }),
    });

    const gatewayError = handleAiGatewayError(aiResponse);
    if (gatewayError) return gatewayError;

    if (!aiResponse.ok) {
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    await deductAiCredits(credits, aiData?.usage);
    let content = aiData.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsedFilters = JSON.parse(content);
    log.step('Parsed filters', parsedFilters);

    // Generate mock properties based on parsed filters
    const city = parsedFilters.city || 'Default City';
    const state = parsedFilters.state || 'FL';
    const maxPrice = parsedFilters.price_max || 1000000;
    const minBeds = parsedFilters.beds_min || 2;
    
    const mockProperties = [
      { id: "1", address: "123 Main Street", city, state, zip: "22201", price: Math.min(maxPrice * 0.7, 350000), beds: minBeds, baths: 2, sqft: 1800, image_urls: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"], description: "Beautiful family home with modern updates", condition: "active", status: "active", externalLink: null, year_built: 2010, lot_size: 5000 },
      { id: "2", address: "456 Oak Avenue", city, state, zip: "22202", price: Math.min(maxPrice * 0.85, 425000), beds: minBeds + 1, baths: 2.5, sqft: 2200, image_urls: ["https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800"], description: "Spacious home with pool and large backyard", condition: "active", status: "active", externalLink: null, year_built: 2015, lot_size: 7500 },
      { id: "3", address: "789 Pine Road", city, state, zip: "22203", price: Math.min(maxPrice * 0.6, 285000), beds: minBeds, baths: 2, sqft: 1400, image_urls: ["https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800"], description: "Cozy starter home, move-in ready", condition: "active", status: "active", externalLink: null, year_built: 2008, lot_size: 4000 },
      { id: "4", address: "321 Elm Street", city, state, zip: "22204", price: Math.min(maxPrice * 0.95, 550000), beds: minBeds + 2, baths: 3, sqft: 3000, image_urls: ["https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"], description: "Luxury home with high-end finishes", condition: "active", status: "active", externalLink: null, year_built: 2020, lot_size: 8000 },
      { id: "5", address: "567 Maple Drive", city, state, zip: "22205", price: Math.min(maxPrice * 0.5, 195000), beds: minBeds, baths: 1, sqft: 1100, image_urls: ["https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800"], description: "Investment opportunity, needs updates", condition: "active", status: "active", externalLink: null, year_built: 2005, lot_size: 3500 },
      { id: "6", address: "890 Cedar Lane", city, state, zip: "22206", price: Math.min(maxPrice * 0.75, 395000), beds: minBeds + 1, baths: 2.5, sqft: 2100, image_urls: ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"], description: "Modern townhouse in great neighborhood", condition: "active", status: "active", externalLink: null, year_built: 2018, lot_size: 2500 },
      { id: "7", address: "234 Birch Court", city, state, zip: "22207", price: Math.min(maxPrice * 0.65, 315000), beds: minBeds, baths: 2, sqft: 1650, image_urls: ["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800"], description: "Charming single-family home", condition: "active", status: "active", externalLink: null, year_built: 2012, lot_size: 5500 },
      { id: "8", address: "678 Willow Way", city, state, zip: "22208", price: Math.min(maxPrice * 0.9, 475000), beds: minBeds + 1, baths: 3, sqft: 2500, image_urls: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"], description: "Updated home with open floor plan", condition: "active", status: "active", externalLink: null, year_built: 2016, lot_size: 6500 },
    ];

    const properties = mockProperties.filter(prop => {
      if (parsedFilters.price_max && prop.price > parsedFilters.price_max) return false;
      if (parsedFilters.price_min && prop.price < parsedFilters.price_min) return false;
      if (parsedFilters.beds_min && prop.beds < parsedFilters.beds_min) return false;
      if (parsedFilters.baths_min && prop.baths < parsedFilters.baths_min) return false;
      return true;
    });

    log.step(`Generated ${properties.length} mock properties`);

    if (properties.length === 0) {
      return jsonResponse({ 
        properties: [], 
        filters: parsedFilters,
        message: 'No properties found matching your criteria. Please try adjusting your search parameters.'
      });
    }

    return jsonResponse({ properties, filters: parsedFilters });
  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
});
