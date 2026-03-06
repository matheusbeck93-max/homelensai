import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query, conversationHistory = [], insightOrigin, userGoal } = validation.data;
    const goalContext = userGoal && GOAL_CONTEXTS[userGoal] ? `\n\nUSER PROFILE CONTEXT:\n${GOAL_CONTEXTS[userGoal]}\nAdapt your tone, priorities, examples, and recommendations accordingly.\n` : '';
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
      
      const insightSystemPrompt = `You are a friendly and knowledgeable U.S. real estate assistant. The user just initiated this chat from the "${originLabel}" page's AI Insight feature on HomeLens.
${goalContext}
Your task:
1. Acknowledge that you see the user started this conversation from the ${originLabel} AI Insight
2. Read and interpret the AI insight analysis they're sharing with you
3. Summarize the key takeaways from the analysis in a warm, conversational tone
4. Ask the user what they would like to explore further based on this analysis

Example areas to suggest exploring:
- Finding properties that match their budget/criteria
- Comparing different financing scenarios
- Analyzing specific neighborhoods or markets
- Getting more detailed investment projections
- Understanding market trends in their target area

RULES:
- Be warm, friendly and conversational
- Address the user directly using "you" and "I"
- Use proper markdown formatting with **bold** headers and bullet points
- Each bullet point on its OWN line
- No emojis
- Be factual and helpful
- Make it clear you understood the analysis they shared`;

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
          max_tokens: 2000,
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

      systemPrompt = `You are a friendly and knowledgeable U.S. real estate assistant. The user has shared a property listing URL with you.
${goalContext}
${scrapedDataSection}

Your task:
1. Extract property information from the SCRAPED PAGE CONTENT provided above
2. Return a structured property summary in a warm, helpful tone
3. If scraped content is available, use it as your PRIMARY and AUTHORITATIVE data source

CRITICAL DATA EXTRACTION RULES:
- Look for the LISTING PRICE (the most prominent dollar amount, e.g. $XXX,XXX or $X,XXX,XXX)
- Look for beds/baths/sqft in formats like "3 bd | 2 ba | 1,500 sqft" or "3 Beds 2 Baths 1,500 Sq Ft"
- Look for the full street address, city, state, and ZIP
- Look for property type (Single Family, Condo, Townhouse, etc.)
- Look for year built, lot size, HOA fees, and annual taxes
- For Zillow: price near "Zestimate" or main listing; look for "bd", "ba", "sqft"
- For Redfin: price near the address; look for "Beds", "Baths", "Sq Ft"
- For Realtor.com: look for structured data near the top

Format your response with CLEAR structure using markdown:

**Hey! Here's what I found about this property:**

**Basic Information**
- **Price:** [exact price from scraped data or "Not listed"]
- **Address:** [full address or "Not listed"]
- **Property Type:** [type or "Not listed"]

**Property Details**
- **Bedrooms:** [number or "Not listed"]
- **Bathrooms:** [number or "Not listed"]
- **Size:** [sqft or "Not listed"]
- **Lot Size:** [lot size or "Not listed"]
- **Year Built:** [year or "Not listed"]

**Costs**
- **HOA:** [amount or "Not listed"]
- **Taxes:** [amount or "Not listed"]
- **Zestimate/Estimate:** [if available or skip]

**Key Features**
- [Feature 1]
- [Feature 2]
- [Feature 3]

**My Notes**
[Any important observations about the property]

---

**Would you like me to compare this property with another one?** Just send me another listing link and I'll help you see how they stack up side by side!

RULES:
- Each bullet point on its OWN line
- Use clear section headers with **bold**
- Extract ONLY what is in the scraped content or publicly known
- If information is not available, state "Not listed"
- No speculation or guessing on property details
- No emojis
- Be warm and conversational, but still factual
- Address the user directly using "you" and "I"
- NEVER invent prices, sizes, or features - only report what you find
- Do NOT include citation numbers like [1], [2], [8] in your response`;
    } else if (isSearch) {
      // Search Mode
      systemPrompt = `You are a friendly and helpful U.S. real estate assistant, here to help users find their perfect property.
${goalContext}

The user wants to search for properties. Your task:
1. Understand their search criteria (location, price, bedrooms, bathrooms, property type, etc.)
2. Generate EXACTLY 3 working search URLs with filters pre-applied - one for each site: Zillow, Redfin, Realtor.com

IMPORTANT URL FORMATS (use these exact patterns):

**Zillow format:**
https://www.zillow.com/[city]-[state abbreviation]/[beds]-beds/[price-range]-price/

Example: https://www.zillow.com/phoenix-az/3-beds/200000-500000_price/

**Redfin format:**
https://www.redfin.com/city/[city-id]/[state]/[City]/filter/min-price=[min],max-price=[max],min-beds=[beds]

Example: https://www.redfin.com/city/14240/AZ/Phoenix/filter/min-price=200000,max-price=500000,min-beds=3

**Realtor format:**
https://www.realtor.com/realestateandhomes-search/[City]_[State]/beds-[min]/price-[min]-[max]

Example: https://www.realtor.com/realestateandhomes-search/Phoenix_AZ/beds-3/price-200000-500000

DO NOT include "Link:" text in your response. Just provide the URLs directly.

Format your response with a warm, helpful tone:

**Great choice! Here's what I'm searching for you:**
• Location: [city, state]
• Price Range: [min] - [max]
• Bedrooms: [number]+
• [Any other filters]

I've prepared your search links below with all your filters ready to go!

---

**Found something you like?** Send me the listing URL and I'll give you a complete breakdown including neighborhood insights, investment potential, and negotiation tips!

RULES:
- Generate EXACTLY 3 URLs: one Zillow, one Redfin, one Realtor.com
- URLs MUST have the user's filters pre-applied
- Use the exact URL formats shown above
- Each bullet point on its OWN line
- Do NOT include any text like "Link:" before URLs
- Do NOT include individual listing links, only search result page URLs
- No property summaries or listing details
- No images
- Be warm, friendly and conversational
- Address the user directly`;
    } else {
      // General real estate question
      systemPrompt = `You are a friendly and approachable U.S. real estate assistant. Answer questions about home buying, mortgages, investments, and market trends in a warm, conversational way.
${goalContext}

FORMAT YOUR RESPONSES WITH CLEAR STRUCTURE:

**Use proper paragraphs:**
- Start with a friendly, direct answer
- Break into logical sections with headers when appropriate
- Use **bold** for emphasis on key points

**Use bullet points correctly:**
• Each bullet point on its OWN line
• Not all crammed into one sentence
• Clear and concise

**Example of GOOD formatting:**
"Great question! The 30-year fixed mortgage rate plays a huge role in what your monthly payment will look like.

**Here's what you should know:**
• Current rates are hovering around 6.5-7%
• Your credit score directly impacts the rate you'll get
• A larger down payment can help you secure better terms

**What this means for you:**
On a $400k loan, you'd be looking at roughly $2,500/month. Happy to break this down further if you'd like!"

RULES:
- Be conversational, warm, and helpful - like a knowledgeable friend
- Use "you" and "I" to make it personal
- ALWAYS use proper line breaks between bullet points
- Be factual only - no speculation
- No emojis
- No marketing language or sales pitches
- If the user seems to be looking for properties, encourage them to share their criteria (location, budget, bedrooms, etc.)`;
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

    const messages = [
      { role: 'system', content: systemPrompt },
      ...dedupedHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: query }
    ];
    
    // If last history message is also 'user', merge with current query to avoid consecutive user messages
    if (messages.length >= 3 && messages[messages.length - 2].role === 'user') {
      const prevUserMsg = messages.splice(messages.length - 2, 1)[0];
      messages[messages.length - 1].content = prevUserMsg.content + '\n\n' + messages[messages.length - 1].content;
    }

    console.log(`[perplexity-chat] Mode: ${isUrl ? 'URL_ANALYSIS' : isSearch ? 'SEARCH' : 'GENERAL'}, Query: ${query.substring(0, 100)}...`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages,
        max_tokens: 2000,
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
