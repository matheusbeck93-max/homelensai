import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage, handleAiGatewayError } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('property-assistant');

// Input validation schema
const assistantRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  categories: z.array(z.string()).optional(),
  properties: z.array(z.any()).optional(),
  marketSnapshot: z.any().optional(),
});

// Detect if query is a property search - enhanced detection
function isPropertySearch(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Strong property search indicators
  const strongKeywords = /(find|search|show|list|looking for|want to|need|get|buy)\s+(a|an|me|some)?\s*(house|home|property|apartment|condo|townhouse|properties|homes|houses)/i;
  const bedroomPattern = /\d+\s*(bed|bedroom|br)/i;
  const locationPattern = /(in|near|around|at)\s+[A-Z][a-z]+/i;
  const pricePattern = /(\$|under|up to|below|max|budget)\s*\d+/i;
  
  // If it has strong property keywords + location, it's definitely a property search
  if (strongKeywords.test(text) && locationPattern.test(text)) return true;
  
  // If it has bedrooms + location, it's definitely a property search
  if (bedroomPattern.test(text) && locationPattern.test(text)) return true;
  
  // If it has price + location, likely a property search
  if (pricePattern.test(text) && locationPattern.test(text)) return true;
  
  return false;
}

// Extract search parameters from query
function extractSearchParams(query: string) {
  const bedsMatch = query.match(/(\d+)\s*(bed|bedroom)/i);
  const beds = bedsMatch ? parseInt(bedsMatch[1]) : undefined;

  const priceMatch = query.match(/\$?\s?(\d+(?:[,.]\d{3})*)\s?(M|k)?/i);
  let maxPrice = undefined;
  if (priceMatch) {
    const num = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (priceMatch[2]?.toLowerCase() === 'm') maxPrice = num * 1000000;
    else if (priceMatch[2]?.toLowerCase() === 'k') maxPrice = num * 1000;
    else maxPrice = num;
  }

  const locationMatch = query.match(/(?:in|near|around|at)\s+([A-Za-z0-9\s,]+)(?=$|\.)/i);
  let location = "";

  if (locationMatch) {
    location = locationMatch[1]
      .trim()
      .replace(/\s+/g, " ")
      .replace(/,$/, "");
  }

  return { beds, maxPrice, location };
}

// Build real property search URLs
function buildPropertyLinks(query: string) {
  const { beds, maxPrice, location } = extractSearchParams(query);
  const links = [];

  // Zillow
  const zillowLocation = location.replace(/\s+/g, '-').replace(',', '');
  
  const zillowStateObj: any = {
    pagination: {},
    mapBounds: {},
    filterState: {}
  };

  if (beds) zillowStateObj.filterState.beds = { min: beds };
  if (maxPrice) zillowStateObj.filterState.price = { max: maxPrice };

  let zillowUrl = `https://www.zillow.com/homes/${zillowLocation}_rb/?searchQueryState=${encodeURIComponent(
    JSON.stringify(zillowStateObj)
  )}`;

  links.push({
    source: "Zillow",
    url: zillowUrl,
    title:
      `${beds ? beds + " bedroom" : ""} ${location ? "house in " + location : "properties"}${
        maxPrice
          ? " up to $" +
            (maxPrice / 1000000 >= 1
              ? maxPrice / 1000000 + "M"
              : maxPrice / 1000 + "k")
          : ""
      }`,
  });

  // Realtor.com
  const realtorLocation = location.replace(/\s+/g, "_").replace(",", "");
  let realtorUrl = `https://www.realtor.com/realestateandhomes-search/${realtorLocation}`;
  const realtorParams: string[] = [];
  if (beds) realtorParams.push(`beds-${beds}`);
  if (maxPrice) realtorParams.push(`price-na-${maxPrice}`);
  if (realtorParams.length) realtorUrl += "/" + realtorParams.join("/");
  links.push({
    source: "Realtor.com",
    url: realtorUrl,
    title:
      `${beds ? beds + " bedroom" : ""} ${location ? "house in " + location : "properties"}${
        maxPrice
          ? " up to $" +
            (maxPrice / 1000000 >= 1
              ? maxPrice / 1000000 + "M"
              : maxPrice / 1000 + "k")
          : ""
      }`,
  });

  // Redfin
  const redfinLocation = location.replace(/\s+/g, "-").replace(",", "");
  let redfinUrl = `https://www.redfin.com/${redfinLocation}/filter/`;
  const redfinParams: string[] = [];
  if (beds) redfinParams.push(`min-beds=${beds}`);
  if (maxPrice) redfinParams.push(`max-price=${maxPrice}`);
  if (redfinParams.length) redfinUrl += redfinParams.join(",");
  links.push({
    source: "Redfin",
    url: redfinUrl,
    title:
      `${beds ? beds + " bedroom" : ""} ${location ? "house in " + location : "properties"}${
        maxPrice
          ? " up to $" +
            (maxPrice / 1000000 >= 1
              ? maxPrice / 1000000 + "M"
              : maxPrice / 1000 + "k")
          : ""
      }`,
  });

  return links;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const validationResult = assistantRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return validationError('Invalid input parameters', validationResult.error.errors);
    }
    
    const { query, categories, properties, marketSnapshot } = validationResult.data;
    
    if (isPropertySearch(query)) {
      const links = buildPropertyLinks(query);
      return new Response(
        JSON.stringify({ links }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a U.S. real estate expert advisor." },
          { role: "user", content: query },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI API error");
    }

    const aiData = await response.json();
    const assistantResponse = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
