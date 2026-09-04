import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { callAiGateway } from '../_shared/ai-gateway.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('ai-search');

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    const { query, categories } = await req.json();
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

    const aiResult = await callAiGateway(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      credits.userId ? {
        router: {
          surface: 'general_chat',
          userId: credits.userId,
          tier: credits.tier === 'unlimited' ? 'investor' as const : (credits.tier === 'paid' ? 'buyer' as const : 'free' as const),
        },
      } : {},
    );
    if ('error' in aiResult) return aiResult.error;
    await deductAiCredits(credits, aiResult.result.usage);
    let content = aiResult.result.message;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsedFilters = JSON.parse(content);
    log.step('Parsed filters', parsedFilters);

    // Resolve real listings via the live listing search (no mock inventory).
    const location = [parsedFilters.city, parsedFilters.state].filter(Boolean).join(', ').trim();

    if (!location) {
      return jsonResponse({
        properties: [],
        filters: parsedFilters,
        message: 'Tell me a city and state to search (for example "3-bed homes under $650k in Arlington, VA"), or paste a Zillow, Redfin or Realtor.com listing link and I will analyze that property.',
      });
    }

    const propTypeMap: Record<string, string> = {
      'single-family': 'house',
      house: 'house',
      condo: 'condo',
      townhome: 'townhome',
      'multi-family': 'multi',
    };

    const searchBody: Record<string, unknown> = {
      query,
      location,
      ...(parsedFilters.price_min ? { price_min: parsedFilters.price_min } : {}),
      ...(parsedFilters.price_max ? { price_max: parsedFilters.price_max } : {}),
      ...(parsedFilters.beds_min ? { beds_min: parsedFilters.beds_min } : {}),
      ...(parsedFilters.baths_min ? { baths_min: parsedFilters.baths_min } : {}),
      ...(propTypeMap[parsedFilters.property_type] ? { prop_type: propTypeMap[parsedFilters.property_type] } : {}),
    };

    let listings: any[] = [];
    let searchStatus = 'unavailable';
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/search-listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(searchBody),
      });
      const payload = await res.json();
      listings = Array.isArray(payload?.listings) ? payload.listings : [];
      searchStatus = payload?.status ?? (listings.length > 0 ? 'ok' : 'unavailable');
    } catch (searchError) {
      log.error('search-listings call failed', searchError);
    }

    const properties = listings.map((l: any) => ({
      id: l.zpid ? `zpid-${l.zpid}` : l.id,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      price: l.price,
      beds: l.bedrooms,
      baths: l.bathrooms,
      sqft: l.sqft,
      image_urls: l.photos?.length ? l.photos : (l.imageUrl ? [l.imageUrl] : []),
      description: null,
      condition: l.status ?? 'active',
      status: l.status ?? 'active',
      externalLink: l.externalUrl ?? null,
      latitude: l.latitude,
      longitude: l.longitude,
      zestimate: l.zestimate,
      rentZestimate: l.rentZestimate,
      source: 'zillow',
    }));

    log.step(`Returning ${properties.length} live listings`, { status: searchStatus });

    if (properties.length === 0) {
      return jsonResponse({
        properties: [],
        filters: parsedFilters,
        message: searchStatus === 'ok'
          ? 'No live listings matched those criteria. Try widening the price range or area, or paste a listing link and I will analyze that property.'
          : 'Live listing data is unavailable right now. Try again shortly, or paste a Zillow, Redfin or Realtor.com listing link and I will analyze that property.',
      });
    }

    return jsonResponse({ properties, filters: parsedFilters, source: 'zillow' });
  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
})(req)));
