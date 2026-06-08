import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage, handleAiGatewayError } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { callAiGateway, type AiMessage } from '../_shared/ai-gateway.ts';
import type { Tier } from '../_shared/ai/types.ts';

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

    // AI call below — gate on credits. Property-search branch above does not
    // touch the model, so it skips credit accounting intentionally.
    const credits = await precheckAiCredits(req);
    if (!credits.allowed && credits.response) return credits.response;

    // Resolve user + tier for the budget-aware router.
    let userId: string | undefined;
    let tier: Tier = 'free';
    try {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (authHeader.startsWith('Bearer ')) {
        const svc = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await svc.auth.getUser();
        if (user) {
          userId = user.id;
          const { data: profile } = await svc
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.id)
            .maybeSingle();
          const status = (profile as any)?.subscription_status;
          if (status === 'investor' || status === 'premium') tier = 'investor';
          else if (status === 'buyer' || status === 'paid') tier = 'buyer';
        }
      }
    } catch (_) { /* fall through as free/anonymous */ }

    const systemPrompt = `You are a U.S. real estate decision advisor.

Response style — adapt to question type:

SIMPLE FACTUAL questions (definitions, "what is X", quick facts):
- Answer in 1–3 sentences. No headings, no bullets, no follow-ups, no "next steps".
- Example — Q: "What is PMI?" → A: "PMI (Private Mortgage Insurance) is a monthly fee lenders charge when your down payment is less than 20%. It protects the lender, not you, and typically costs 0.3–1.5% of the loan per year. It drops off automatically once you reach 22% equity."

DECISION-BASED questions ("should I", "is it better to", affordability, fit):
- First sentence = clear yes/no, "likely yes/no", or the recommended choice. No ambiguous openers like "It depends" or "There are several factors".
- Then the 2–4 factors that drive that conclusion, with specific numbers when possible.
- End with a takeaway only when it adds real value.

Universal rules:
- No preambles ("Great question", "Sure!"). Never restate the user's question.
- Lead with location- or situation-specific info before generic context.
- Relevance filter: include only what affects cost, risk, eligibility, fit, or the next decision.
- Short paragraphs, flat bullets (max 1 level). Tables only for 3+ item comparisons.
- Conciseness: cut filler ~15–20%. Every sentence must add information; no transitional padding or recap.
- Prefer bullets when they improve scanability — use a flat bullet list for 3+ supporting points; use prose for 1–2 connected points or the opening verdict. Never bullet simple factual answers.
- Skip "next steps" / follow-up suggestions by default — include them only when they materially help the user act.
- Personalization: use saved preferences only when they sharpen the answer; never echo the profile back; never force preferences into narrow factual questions.
- Tone: professional, confident, natural — sharp advisor, not blog writer.`;

    const aiMessages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    const out = await callAiGateway(aiMessages, {
      model: 'google/gemini-2.5-flash',
      router: userId ? { surface: 'general_chat', userId, tier } : undefined,
    });
    if ('error' in out) return out.error;
    await deductAiCredits(credits, out.result.usage);
    const assistantResponse = out.result.message;

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
