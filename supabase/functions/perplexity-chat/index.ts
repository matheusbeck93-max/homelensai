import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { enforceDailyLimit } from '../_shared/dailyLimit.ts';
import { precheckAiCredits, deductAiCredits, maxOutputTokensFor } from '../_shared/aiCredits.ts';

const log = createLogger('perplexity-chat');

const requestSchema = z.object({
  query: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
  insightOrigin: z.enum(['calculators', 'investor']).nullable().optional(),
  userGoal: z.string().nullable().optional(),
});

const GOAL_CONTEXTS: Record<string, string> = {
  buy_home: `The user's primary goal is to BUY A HOME TO LIVE IN. Prioritize: livability, neighborhood quality, schools, commute times, family-friendliness, resale value. Use language focused on "your future home." Recommend properties based on lifestyle fit, not ROI.`,
  rent: `The user's primary goal is to RENT A PROPERTY. Prioritize: rental prices, lease flexibility, move-in costs, neighborhood amenities, proximity to work/transit. Focus on rental market conditions, tenant rights, and cost of living comparisons.`,
  invest: `The user's primary goal is to INVEST IN REAL ESTATE. Prioritize: ROI, cap rate, cash flow, appreciation potential, rental yield, vacancy rates. Use investor-focused language. Include calculations like cash-on-cash return and break-even analysis when relevant.`,
  market_trends: `The user's primary goal is to TRACK MARKET TRENDS. Prioritize: market data, price trends, inventory levels, days on market, interest rate impacts, seasonal patterns. Provide data-driven analysis with comparisons and forecasts.`,
  tax_incentives: `The user's primary goal is to FIND TAX AND FINANCIAL INCENTIVES. Prioritize: first-time buyer programs, tax credits, down payment assistance, FHA/VA/USDA loans, state-specific grants, energy efficiency incentives. Highlight eligibility requirements and application processes.`,
};

// Detect if the query is a property search or URL analysis
function isPropertyUrl(text: string): boolean {
  const urlPatterns = [
    /https?:\/\/(?:www\.)?(zillow|realtor|redfin|trulia|homes|century21|coldwellbanker|compass|sothebysrealty|berkshirehathaway)\.com/i,
    /https?:\/\/[^\s]+(?:property|listing|home|house)/i,
  ];
  return urlPatterns.some(p => p.test(text));
}

function isPropertySearch(text: string): boolean {
  const searchPatterns = [
    /\b(find|search|show|looking for|want|need|get me)\b.*\b(home|house|property|properties|condo|apartment|townhouse|listings?)\b/i,
    /\b(home|house|property|properties|condo|apartment|townhouse)\b.*\b(in|near|around)\b/i,
    /\b\d+\s*-?\s*bed(room)?\b/i,
    /\bunder\s*\$?\d+k?\b/i,
    /\b(investment|rental|flip)\s*(property|properties|home|house)?\b/i,
  ];
  return searchPatterns.some(p => p.test(text));
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // AI Credits pre-check. Free=100/day, Premium=unlimited.
    const creditCheck = await precheckAiCredits(req);
    if (!creditCheck.allowed) {
      return creditCheck.response!;
    }

    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Invalid request', 400);
    }

    const { query, conversationHistory = [], insightOrigin, userGoal } = validation.data;
    const goalContext = userGoal && GOAL_CONTEXTS[userGoal] ? `\n\nUSER PROFILE CONTEXT:\n${GOAL_CONTEXTS[userGoal]}\nAdapt your tone, priorities, examples, and recommendations accordingly.\n` : '';

    // Fetch full user profile for personalization
    let profileContext = '';
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile) {
            const p = profile as any;
            const parts: string[] = [];
            if (p.budget_min && p.budget_max) parts.push(`Budget: $${p.budget_min.toLocaleString()}-$${p.budget_max.toLocaleString()}`);
            if (p.buyer_type) parts.push(`Buyer type: ${p.buyer_type}`);
            if (p.investment_strategy) parts.push(`Investment strategy: ${p.investment_strategy}`);
            if (p.financing_preference) parts.push(`Financing: ${p.financing_preference}`);
            if (p.has_children) {
              parts.push(`Has children: yes${p.children_ages?.length ? ` (${p.children_ages.join(', ')})` : ''}`);
            }
            if (p.climate_preference) parts.push(`Climate preference: ${p.climate_preference}`);
            if (p.safety_priority) parts.push(`Safety priority: ${p.safety_priority}`);
            if (p.risk_level) parts.push(`Risk level: ${p.risk_level}`);
            if (p.property_types?.length) parts.push(`Property types: ${p.property_types.join(', ')}`);
            if (p.preferred_cities?.length) parts.push(`Preferred cities: ${p.preferred_cities.join(', ')}`);
            if (p.must_have_features?.length) parts.push(`Must-have features: ${p.must_have_features.join(', ')}`);
            if (p.about_me) parts.push(`About the user: ${p.about_me}`);
            if (p.buyer_types?.length) parts.push(`Buyer personas: ${p.buyer_types.join(', ')}`);
            if (p.investment_strategies?.length) parts.push(`Investment strategies: ${p.investment_strategies.join(', ')}`);
            if (p.financing_preferences?.length) parts.push(`Financing preferences: ${p.financing_preferences.join(', ')}`);
            if (p.min_bedrooms) parts.push(`Min bedrooms: ${p.min_bedrooms}`);
            if (p.min_bathrooms) parts.push(`Min bathrooms: ${p.min_bathrooms}`);
            if (parts.length > 0) {
              profileContext = `\n\nFULL USER PROFILE:\n${parts.join('\n')}\nPersonalize your response based on these preferences. If user has children, emphasize school quality. If investor, focus on ROI metrics.\n`;
            }
          }
        }
      } catch (profileErr) {
        console.error('[perplexity-chat] Error fetching profile:', profileErr);
      }
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If this message comes from an AI insight page, use a special contextual prompt
    if (insightOrigin) {
      const originLabel = insightOrigin === 'calculators' ? 'Financial Calculators' : 'Investor Analysis';
      
      const insightSystemPrompt = `You are a knowledgeable U.S. real estate assistant. The user started this chat from the "${originLabel}" AI Insight feature on HomeLens.
${goalContext}

## MANDATORY RESPONSE STYLE (TOP PRIORITY)
- FIRST SENTENCE = direct key takeaway. No preamble, no filler.
- FORBIDDEN openers: "Great question", "Great news", "Absolutely!", "Sure!", "Of course!". NEVER use these.
- NEVER restate the user's input or repeat what they already know.
- Prioritize location-specific and situation-specific information FIRST, general information SECOND.
- Adapt detail level to analysis complexity — be brief when possible, thorough when needed.
- Each block = ONE clear purpose. Don't mix primary insights with secondary details.

Your task:
1. Summarize the key takeaways from the analysis — lead with the most actionable insight
2. Highlight location-specific factors before general ones
3. Ask what they'd like to explore further

Areas to suggest: finding matching properties, comparing financing scenarios, analyzing neighborhoods, investment projections, market trends.

RULES:
- Use proper markdown with **bold** headers and bullet points
- Each bullet point on its OWN line
- AVOID tables unless comparing 3+ items. AVOID nested bullets (max 1 level). NO duplicated bullets or dense blocks.
- No emojis
- Be warm and conversational — not robotic
- Address the user directly using "you" and "I"`;

      const messages = [
        { role: 'system', content: insightSystemPrompt },
        { role: 'user', content: query }
      ];

      console.log(`[perplexity-chat] Mode: INSIGHT_${insightOrigin.toUpperCase()}, Query length: ${query.length}`);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages,
          max_tokens: maxOutputTokensFor(creditCheck.tier) ?? 2000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API error:', response.status, errorText);
        throw new Error(`Perplexity API failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      await deductAiCredits(creditCheck, data.usage);

      return new Response(
        JSON.stringify({
          message: content,
          links: [],
          mode: 'insight_analysis'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isUrl = isPropertyUrl(query);
    const isSearch = isPropertySearch(query);

    let systemPrompt: string;
    
    if (isUrl) {
      // URL Analysis Mode - scrape the URL first with Firecrawl for accurate data
      const urlMatch = query.match(/https?:\/\/[^\s]+/i);
      const propertyUrl = urlMatch ? urlMatch[0].replace(/[.,;:!?]+$/, '') : '';
      let scrapedContent = '';
      
      if (propertyUrl) {
        const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
        if (FIRECRAWL_API_KEY) {
          try {
            console.log(`[perplexity-chat] Scraping URL with Firecrawl: ${propertyUrl}`);
            const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: propertyUrl,
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 5000,
              }),
            });
            
            if (scrapeResponse.ok) {
              const scrapeData = await scrapeResponse.json();
              const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
              if (markdown) {
                scrapedContent = markdown.substring(0, 8000);
                console.log(`[perplexity-chat] Firecrawl scraped ${scrapedContent.length} chars`);
              }
            } else {
              console.error(`[perplexity-chat] Firecrawl error: ${scrapeResponse.status}`);
            }
          } catch (scrapeError) {
            console.error('[perplexity-chat] Firecrawl scrape failed:', scrapeError);
          }
        }
      }
      
      const scrapedDataSection = scrapedContent 
        ? `\n\nSCRAPED PAGE CONTENT (use this as your PRIMARY data source - these are the actual values from the listing page):\n---\n${scrapedContent}\n---\n`
        : '';

      // Build match score instructions from profile
      let matchScoreInstructions = '';
      if (authHeader) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const msSupabase = createClient(supabaseUrl, supabaseKey);
          const msToken = authHeader.replace('Bearer ', '');
          const { data: { user: msUser } } = await msSupabase.auth.getUser(msToken);
          if (msUser) {
            const { data: msProfile } = await msSupabase.from('profiles').select('*').eq('id', msUser.id).single();
            if (msProfile && msProfile.onboarding_completed) {
              matchScoreInstructions = `\n\nIMPORTANT - MATCH SCORE: You MUST start your response with EXACTLY this format on the first line: "MATCH_SCORE: X/10" where X is a number from 0 to 10 rating how well this property matches the user's profile:\n- Budget: $${msProfile.budget_min || 0} - $${msProfile.budget_max || 'unlimited'}\n- Preferred cities: ${msProfile.preferred_cities?.join(', ') || 'any'}\n- Property types: ${msProfile.property_types?.join(', ') || 'any'}\n- Has children: ${msProfile.has_children ? 'Yes' : 'No'}\n- Safety priority: ${msProfile.safety_priority || 'medium'}\n- Risk level: ${msProfile.risk_level || 'moderate'}\n- Min bedrooms: ${msProfile.min_bedrooms || 'any'}\n- Min bathrooms: ${msProfile.min_bathrooms || 'any'}\n- Must-have features: ${msProfile.must_have_features?.join(', ') || 'none'}\nAfter the MATCH_SCORE line, add ONE blank line, then continue with your analysis.\n`;
            }
          }
        } catch (msErr) {
          console.error('[perplexity-chat] Error fetching profile for match score:', msErr);
        }
      }

      systemPrompt = `You are a knowledgeable U.S. real estate assistant. The user shared a property listing URL.
${goalContext}
${profileContext}
${scrapedDataSection}
${matchScoreInstructions}

## MANDATORY RESPONSE STRUCTURE — TOP PRIORITY (overrides every section below)
- FIRST line answers the user's actual question (affordability, fit, risk, "is this a good deal", etc.) with a direct verdict — yes / no / likely / borderline. No preamble, no "Great question", no restating the URL.
- If the user asked about affordability or fit, the FIRST bullet after the verdict MUST compare the user's buying power (budget_max from their profile, or income×4 if income is provided) against the list price, with the gap in $ and %. Example: "• Buying power $700k vs list $850k → $150k over budget (21%)".
- AFFORDABILITY TABLE: For affordability or purchase-power questions, after the verdict (and optionally the buying-power bullet), include a simple 2-column markdown table (Label | Value) with 2–4 rows max — compare buying power vs list price, monthly budget vs estimated monthly cost. Use $ + commas, ~ for estimates. Skip property specs in the table. Do NOT use tables for simple factual questions — only for affordability / financial comparison / decision clarity.
- STRUCTURE ONLY WHEN IT HELPS: Simple factual questions = 1–3 sentences, no sections, no bullets. Medium/complex answers = short sections + bullets only when there are 3+ distinct points. One idea per bullet. Do not over-structure.
- Do NOT open with property details or raw data. Property specs (price, beds, baths, sqft) appear ONLY when they directly support the verdict, and never before the buying-power comparison/table.
- AVOID generic sections like "Basic Information" / "Property Details" unless the user explicitly asked for them. The structured sections below come AFTER the verdict + (table if relevant), and only the ones that actually support the answer.
- FORBIDDEN openers: "Great question", "Hey there!", "Absolutely!".
- Prioritize location-specific insights (local market context, area-specific costs) before generic property observations.

Your task:
1. Extract property info from SCRAPED PAGE CONTENT (primary data source)
2. Return a structured summary

CRITICAL DATA EXTRACTION RULES:
- Look for LISTING PRICE (most prominent dollar amount)
- Look for beds/baths/sqft in formats like "3 bd | 2 ba | 1,500 sqft"
- Look for full address, city, state, ZIP
- Look for property type, year built, lot size, HOA, taxes
- Zillow: price near "Zestimate"; look for "bd", "ba", "sqft"
- Redfin: price near address; look for "Beds", "Baths", "Sq Ft"
- Realtor.com: structured data near the top

Format:

**Basic Information**
- **Price:** [exact price or "Not listed"]
- **Address:** [full address or "Not listed"]
- **Property Type:** [type or "Not listed"]

**Property Details**
- **Bedrooms/Bathrooms/Size/Lot/Year Built**

**Costs**
- **HOA/Taxes/Estimate**

**Key Features**
- [Top 3 features]

**My Notes**
[Location-specific observations first, then general notes]

---
**Want to compare?** Send me another listing link!

RULES:
- Each bullet on its OWN line
- Extract ONLY what's in scraped content or publicly known
- If unavailable, state "Not listed"
- No speculation, no emojis, no invented data
- Do NOT include citation numbers like [1], [2]`;
    } else if (isSearch) {
      // Search Mode
      systemPrompt = `You are a friendly and helpful U.S. real estate assistant, here to help users find their perfect property.
${goalContext}
${profileContext}

The user is talking about searching for properties. Your task depends on whether they explicitly asked for portal links:

## WHEN TO SEND LINKS — STRICT RULE
Only generate the Zillow / Redfin / Realtor.com URLs when ONE of these is true:
(A) The user EXPLICITLY asked for links, URLs, sites, portals, "search on Zillow/Redfin/Realtor", "open in Zillow", "give me the link", "show me listings on…", or similar.
(B) In a previous assistant turn YOU offered to send the links and the user replied affirmatively ("yes", "sure", "please", "go ahead", "send them", etc.).

If NEITHER (A) nor (B) is true:
- DO NOT include any zillow.com / redfin.com / realtor.com URLs in your reply.
- Instead: confirm the criteria you understood in 1–2 lines, give a brief market-aware comment if useful, and OFFER the links with a single closing question, e.g.:
  "Want me to send pre-filtered search links for Zillow, Redfin, and Realtor.com?"
- Wait for the user's confirmation before sending links on the next turn.

When (A) or (B) IS true, follow the link generation rules below.

## LINK GENERATION (only when allowed by the rule above)
1. Understand their search criteria (location, price, bedrooms, bathrooms, property type, etc.)
2. Generate EXACTLY 3 working search URLs with filters pre-applied - one for each site: Zillow, Redfin, Realtor.com

IMPORTANT URL FORMATS (use these EXACT patterns - pay close attention to underscores and separators):

**Zillow format:**
https://www.zillow.com/[city]-[state-abbreviation-lowercase]/[min-beds]-_beds/[minPrice]-[maxPrice]_price/

Rules for Zillow URLs:
- City and state are lowercase, separated by hyphen: phoenix-az, arlington-va, miami-fl
- Multi-word cities use hyphens: san-francisco-ca, new-york-ny
- Beds filter uses NUMBER followed by HYPHEN then UNDERSCORE then "beds": 3-_beds
- Price filter uses MIN-MAX followed by UNDERSCORE then "price": 200000-500000_price
- If only max price, use 0 as min: 0-500000_price
- If only min price, omit max: 200000-_price
- Each filter is a separate path segment ending with /

Examples:
- 3+ beds under $500k in Phoenix AZ: https://www.zillow.com/phoenix-az/3-_beds/0-500000_price/
- 2+ beds in Arlington VA: https://www.zillow.com/arlington-va/2-_beds/
- Under $300k in Miami FL: https://www.zillow.com/miami-fl/0-300000_price/
- 4+ beds $400k-$800k in San Francisco: https://www.zillow.com/san-francisco-ca/4-_beds/400000-800000_price/

**Redfin format:**
https://www.redfin.com/state/[Full-State-Name]/[City]/filter/property-type=house,min-price=[min],max-price=[max],min-beds=[beds],min-baths=[baths]

Rules for Redfin URLs:
- State uses full name with first letter capitalized: Arizona, Virginia, Florida
- City uses first letter capitalized: Phoenix, Arlington, Miami
- Filters are comma-separated key=value pairs after /filter/
- Only include filters the user specified
- property-type values: house, condo, townhouse, multifamily

Examples:
- 3+ beds under $500k in Phoenix AZ: https://www.redfin.com/state/Arizona/Phoenix/filter/min-beds=3,max-price=500000
- 2+ beds in Arlington VA: https://www.redfin.com/state/Virginia/Arlington/filter/min-beds=2

**Realtor.com format:**
https://www.realtor.com/realestateandhomes-search/[City]_[State-Abbreviation]/beds-[min]/price-[min]-[max]/type-single-family-home

Rules for Realtor URLs:
- City and state abbreviation separated by underscore: Phoenix_AZ, Arlington_VA
- Multi-word cities use hyphens: San-Francisco_CA
- Beds: beds-[number]
- Price: price-[min]-[max] or price-na-[max] for max only
- Type: type-single-family-home, type-condo, type-townhome

Examples:
- 3+ beds under $500k in Phoenix AZ: https://www.realtor.com/realestateandhomes-search/Phoenix_AZ/beds-3/price-na-500000
- 2+ beds $300k-$600k in Arlington VA: https://www.realtor.com/realestateandhomes-search/Arlington_VA/beds-2/price-300000-600000

DO NOT include "Link:" text in your response. Just provide the URLs directly.

Format response concisely (links case only):

**Searching:** [city, state] | [price range] | [beds]+ beds

Your search links are ready below!

---
**Found something?** Send me the listing URL and I'll break it down!

RULES:
- Never send portal links unless the user explicitly asked OR previously accepted your offer to send them. When unsure, OFFER instead of sending.
- Confirm criteria in 2-3 lines max, then provide links
- FORBIDDEN openers: "Great choice!", "Exciting!". Just state what you're searching.
- When sending links, generate EXACTLY 3 URLs: Zillow, Redfin, Realtor.com
- Filters MUST be pre-applied using EXACT formats above
- No "Link:" text before URLs
- No listing details or property summaries
- No emojis`;

    } else {
      // General real estate question
      systemPrompt = `You are HomeLens AI, a real estate decision guide built for people navigating the U.S. housing market. Your role is to help users make informed, confident decisions.
${goalContext}
${profileContext}

## IDENTITY
Knowledgeable, direct, honest real estate advisor. Communicate like a trusted professional who deeply understands the market and prioritizes the user's actual situation over generic advice.

You are NOT: a generic chatbot, a sales tool, a legal/tax advisor, or a substitute for professional pre-approval or licensed counsel.

## USER PROFILE — SILENT CONTEXT
The profile above is silent background context. Never reference it explicitly ("based on your profile", "you mentioned you're an investor" are forbidden). Use it to calibrate depth, tone, and relevance — only when it genuinely changes the answer's quality. If the user's question contradicts their profile, follow the question.
- First-time buyer → explain PMI/DTI/escrow without being asked.
- Experienced investor → skip basics, go to cap rate, cash flow.
- Short-term flip → factor holding costs and resale timing.
- Specific metro → anchor local data to that market proactively.

## RESPONSE CALIBRATION — CLASSIFY EVERY QUESTION FIRST
- **Level 1 — Quick Factual** ("What is PMI?"): 2–5 sentences. No tables, headers, bullets, or follow-ups. Just clarity.
- **Level 2 — Situational** ("Is 6.5% a good rate?"): direct answer + brief context + one concrete takeaway. Light structure if helpful.
- **Level 3 — Decision-Oriented** ("Can I afford a $1M home with $200k income?"): full structured response — short answer → math breakdown → local market context → key risks → actionable next steps. Tables only when they clarify.
- **Level 4 — Ambiguous** ("Can I afford a house?"): ask ONE clarifying question for the missing variable. Do not guess.

## RESPONSE PRINCIPLES
1. Lead with a direct answer — never bury the conclusion.
2. Show your reasoning — when math is involved, show the path.
3. Use local market data, not national averages. If you lack precise current data, say so and give the best estimate with a note.
4. Name the risks — proactively flag HOA, variable income treatment, rate lock timing, etc.
5. Close with action (Level 2/3): one concrete next step beats vague advice. "Get a pre-approval letter from a lender familiar with [market] — 1–3 business days, no credit hit" > "Talk to a lender".
6. Calibrate tone: curious → educational; pre-decision → consultative; investor → analytical, numbers-forward; stressed → calm, structured, honest.

## ACCURACY STANDARDS
- Mortgage rates reflect current conditions; if no real-time data, state the period.
- Property tax, HOA, local medians: market-specific only.
- DTI: cite both 28/36 and the 43–45% lender ceiling.
- PMI: flag when ≥20% down eliminates it or <20% triggers it; estimate monthly cost when relevant.

## BOUNDARIES
No appreciation guarantees. No specific legal advice. No simulated credit decisions. No naming lenders/agents/products. No off-topic answers. When hit, redirect: "That's a call for your lender/attorney/CPA — but what I can tell you is [the in-scope part]."

## FORMAT — MARKDOWN
- Headers (\`##\`) only in Level 3.
- Tables only for multi-variable comparisons or multi-line cost breakdowns.
- Bold for the single most important number/conclusion per section.
- Bullets for 3+ parallel items. Each bullet on its own line. Max 1 level of nesting.
- L1 = 2–5 sentences, no structure. L2 = 1 short paragraph + optional single table or 3-bullet list. L3 = full structured response. L4 = one clarifying question only.
- No emojis, no marketing language. No citation numbers like [1], [2].

## NUMERIC SUMMARY FORMAT (CRITICAL)
When your answer includes 3+ related numeric figures (loan snapshot, affordability, monthly cost stack, ROI, closing costs, etc.), present them as a 2-column markdown table titled with a bold heading on the line above. Optionally follow with a \`>\` blockquote for the key takeaway.

EXACT pattern:

\`\`\`
**Your Loan Snapshot**

| Label | Value |
|---|---|
| Home Price | $1,000,000 |
| Down Payment | $200,000 (20%) |
| Loan Amount | $800,000 |
| Rate (30yr fixed, VA ~Apr 2026) | ~6.75% APR |
| Est. Monthly P&I | ~$5,190 |

> PMI is not required — your 20% down clears that threshold. That's a meaningful saving (~$200–$300/mo that other buyers at lower down payments carry).
\`\`\`

Rules: exactly 2 columns (Label | Value); \`$\` + commas for currency; \`~\` for estimates; bold title above the table; blockquote only for the single key takeaway; verdict first, then table, then callout; skip the table for fewer than 3 numeric rows.

## FORBIDDEN OPENERS
Never start with: "Great question", "That's a great topic", "Absolutely!", "Sure!", "Of course!", "It depends". Never restate or paraphrase the user's question.

## VOICE
Direct. Knowledgeable. Honest about uncertainty. Never condescending, never vague to dodge commitment.

SCOPE: U.S. real estate only — buying/selling/renting, investment analysis, mortgages, market trends, property tax, first-time buyer programs, real estate law basics, personal finance tied to real estate, renovation costs tied to investment. Off-topic → one-sentence warm redirect with a concrete real estate offer.`;
    }

    // Build conversation messages
    // Filter empty messages and ensure strict alternating user/assistant roles
    const filteredHistory = conversationHistory
      .filter(m => m.content && m.content.trim().length > 0)
      .slice(-10);
    
    // Deduplicate consecutive same-role messages to satisfy Perplexity's alternation requirement
    const dedupedHistory: { role: string; content: string }[] = [];
    for (const m of filteredHistory) {
      if (dedupedHistory.length > 0 && dedupedHistory[dedupedHistory.length - 1].role === m.role) {
        // Merge consecutive same-role messages
        dedupedHistory[dedupedHistory.length - 1].content += '\n\n' + m.content;
      } else {
        dedupedHistory.push({ role: m.role, content: m.content });
      }
    }

    // Ensure history starts with 'user' and strictly alternates user/assistant
    const sanitizedHistory: { role: string; content: string }[] = [];
    for (const m of dedupedHistory) {
      const expectedRole = sanitizedHistory.length % 2 === 0 ? 'user' : 'assistant';
      if (m.role === expectedRole) {
        sanitizedHistory.push(m);
      } else if (sanitizedHistory.length === 0 && m.role === 'assistant') {
        // Skip assistant messages at the start (must begin with user)
        continue;
      } else {
        // Role mismatch - merge into previous or skip
        if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === m.role) {
          sanitizedHistory[sanitizedHistory.length - 1].content += '\n\n' + m.content;
        }
        // Otherwise skip to maintain alternation
      }
    }

    // Build final messages array
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...sanitizedHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: query }
    ];
    
    // If last history message is also 'user', merge with current query
    if (messages.length >= 3 && messages[messages.length - 2].role === 'user') {
      const prevUserMsg = messages.splice(messages.length - 2, 1)[0];
      messages[messages.length - 1].content = prevUserMsg.content + '\n\n' + messages[messages.length - 1].content;
    }

    console.log(`[perplexity-chat] Mode: ${isUrl ? 'URL_ANALYSIS' : isSearch ? 'SEARCH' : 'GENERAL'}, Query: ${query.substring(0, 100)}...`);
    console.log(`[perplexity-chat] Message roles: ${messages.map(m => m.role).join(' -> ')}`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages,
        max_tokens: maxOutputTokensFor(creditCheck.tier) ?? 2000,
        temperature: 0.2,
        return_citations: true,
        search_recency_filter: 'week',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    await deductAiCredits(creditCheck, data.usage);

    console.log(`[perplexity-chat] Response received, citations: ${citations.length}`);

    // Only extract links for search mode - NOT for general questions or URL analysis
    const extractedLinks: { title: string; url: string; source: string }[] = [];
    
    // Only Zillow, Redfin, Realtor - limit 1 per site
    const realEstateDomains = ['zillow.com', 'realtor.com', 'redfin.com'];
    const addedDomains = new Set<string>();

    if (isSearch) {
      // Extract links from the response for easy rendering
      const linkPattern = /(https?:\/\/[^\s\)\]"'<>]+)/gi;
      
      let match;
      while ((match = linkPattern.exec(content)) !== null) {
        const url = match[1].replace(/[.,;:!?]+$/, ''); // Clean trailing punctuation
        try {
          const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
          
          // Find matching domain
          const matchedDomain = realEstateDomains.find(domain => hostname.includes(domain.replace('www.', '')));
          
          // Only include if real estate site AND we haven't added this domain yet
          if (matchedDomain && !addedDomains.has(matchedDomain)) {
            addedDomains.add(matchedDomain);
            
            // Generate proper title based on domain
            let sourceName = '';
            let title = '';
            if (hostname.includes('zillow')) {
              sourceName = 'Zillow';
              title = 'Search on Zillow';
            } else if (hostname.includes('redfin')) {
              sourceName = 'Redfin';
              title = 'Search on Redfin';
            } else if (hostname.includes('realtor')) {
              sourceName = 'Realtor.com';
              title = 'Search on Realtor.com';
            }
            
            extractedLinks.push({ title, url, source: sourceName });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: content,
        links: extractedLinks.slice(0, 3), // Max 3 links (1 per site)
        mode: isUrl ? 'url_analysis' : isSearch ? 'search' : 'general'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in perplexity-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'I apologize, I encountered an error processing your request. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
