import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  hasImage: z.boolean().optional(),
  userProfile: z.any().optional(),
  propertyData: z.any().optional(),
  conversationMode: z.boolean().optional(), // New flag for unified conversation mode
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validationResult = chatRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: validationResult.error.errors 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { messages, hasImage, userProfile: clientProfile, propertyData, conversationMode } = validationResult.data;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const authHeader = req.headers.get('Authorization');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // In conversation mode, check if this is a property search request
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    
    // Detect property URLs
    const urlRegex = /(https?:\/\/(?:www\.)?(zillow|realtor|redfin|trulia|homes)\.com\/[^\s]+)/gi;
    const detectedUrls = lastUserMessage.match(urlRegex) || [];
    
    console.log(`Detected ${detectedUrls.length} property URLs:`, detectedUrls);
    
    // In conversation mode, let AI handle property search queries naturally
    // We removed the auto-deflect logic - AI will now parse and trigger searches
    
    // Check if we're waiting for purpose clarification
    const previousMessage = messages.length > 1 ? messages[messages.length - 2]?.content || '' : '';
    const isWaitingForPurpose = previousMessage.includes('Is this for investment or primary residence?');
    
    // Check if user is responding with purpose
    const purposeResponse = lastUserMessage.toLowerCase();
    const isInvestment = purposeResponse.includes('invest');
    const isPrimaryResidence = purposeResponse.includes('residence') || purposeResponse.includes('primary') || purposeResponse.includes('live') || purposeResponse.includes('home');
    
    // If 1+ URLs detected, trigger property analysis mode
    if (detectedUrls.length >= 1) {
      // First, ask about purpose if this is the first property message
      if (!isWaitingForPurpose && messages.length <= 2) {
        console.log('First property URL detected, asking about purpose');
        return new Response(
          JSON.stringify({ 
            response: 'Got it! Before I provide a complete analysis of this property, I need to know: **Is this for investment or primary residence?**\n\nThis will help me focus on the most relevant aspects for you.',
            needsPurpose: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Triggering property analysis mode');
      
      // Fetch real property data from URLs using Firecrawl
      const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
      
      if (!FIRECRAWL_API_KEY) {
        console.error('FIRECRAWL_API_KEY not configured');
        return new Response(
          JSON.stringify({ 
            response: 'I detected property URLs, but I need Firecrawl API key configured to fetch real data. Please configure it to enable property analysis.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const propertyPromises = detectedUrls.slice(0, 4).map(async (url: string, index: number) => {
        try {
          console.log(`Fetching property data from: ${url}`);
          
          // Use Firecrawl to scrape the URL
          const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url,
              formats: ['markdown', 'html']
            })
          });
          
          if (!firecrawlResponse.ok) {
            throw new Error(`Firecrawl failed: ${firecrawlResponse.status}`);
          }
          
          const firecrawlData = await firecrawlResponse.json();
          const html = firecrawlData.data?.html || '';
          const markdown = firecrawlData.data?.markdown || '';
          const content = html || markdown;
          
          // Parse property data
          let propertyData: any = {
            id: `url-${index + 1}`,
            externalLink: url,
            condition: 'active',
            status: 'active',
          };
          
          // Extract data from content
          const priceMatch = content.match(/\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/g);
          if (priceMatch && priceMatch[0]) {
            propertyData.price = parseInt(priceMatch[0].replace(/[$,]/g, ''));
          }
          
          const bedsMatch = content.match(/(\d+)\s*(?:bed|bd|bedroom)/i);
          const bathsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)/i);
          const sqftMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)/i);
          
          if (bedsMatch) propertyData.beds = parseInt(bedsMatch[1]);
          if (bathsMatch) propertyData.baths = parseFloat(bathsMatch[1]);
          if (sqftMatch) propertyData.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
          
          const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          if (h1Match) {
            const fullAddress = h1Match[1].trim();
            propertyData.address = fullAddress;
            
            const locationMatch = fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
            if (locationMatch) {
              propertyData.city = locationMatch[1].trim();
              propertyData.state = locationMatch[2];
              propertyData.zip = locationMatch[3] || '';
            }
          }
          
          const yearMatch = content.match(/(?:built|year built)[:\s]*(\d{4})/i);
          if (yearMatch) propertyData.year_built = parseInt(yearMatch[1]);
          
          const lotMatch = content.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)\s*lot/i);
          if (lotMatch) propertyData.lot_size = parseInt(lotMatch[1].replace(/,/g, ''));
          
          const hostname = new URL(url).hostname;
          const imgMatch = content.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
          if (imgMatch) {
            propertyData.image_urls = [imgMatch[1]];
          }
          
          const descMatch = content.match(/<meta\s+(?:name|property)="description"\s+content="([^"]+)"/i);
          if (descMatch) {
            propertyData.description = descMatch[1].substring(0, 200);
          }
          
          console.log(`Extracted property data for ${url}:`, propertyData);
          
          // Set defaults
          propertyData.address = propertyData.address || `Property ${index + 1}`;
          propertyData.city = propertyData.city || 'Unknown';
          propertyData.state = propertyData.state || 'XX';
          propertyData.zip = propertyData.zip || '00000';
          propertyData.price = propertyData.price || 0;
          propertyData.beds = propertyData.beds || 0;
          propertyData.baths = propertyData.baths || 0;
          propertyData.sqft = propertyData.sqft || 0;
          propertyData.image_urls = propertyData.image_urls || [`https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800`];
          propertyData.description = propertyData.description || `Property from ${hostname}`;
          
          return propertyData;
        } catch (error) {
          console.error(`Error fetching property ${url}:`, error);
          return {
            id: `url-${index + 1}`,
            address: `Property ${index + 1}`,
            city: 'Unknown',
            state: 'XX',
            zip: '00000',
            price: 0,
            beds: 0,
            baths: 0,
            sqft: 0,
            image_urls: [`https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800`],
            description: 'Failed to fetch property details',
            condition: 'active',
            status: 'active',
            externalLink: url,
          };
        }
      });
      
      const properties = await Promise.all(propertyPromises);
      
      try {
        console.log('All properties fetched, starting AI analysis...');
        console.log('Properties data:', JSON.stringify(properties, null, 2));
        
        // Determine purpose from conversation history
        let purpose = 'investment'; // default
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i]?.content?.toLowerCase() || '';
          if (msg.includes('residence') || msg.includes('primary') || msg.includes('live') || msg.includes('home')) {
            purpose = 'residence';
            break;
          } else if (msg.includes('invest')) {
            purpose = 'investment';
            break;
          }
        }
        
        console.log('Analysis purpose:', purpose);
        
        // Generate natural AI analysis with calculations
        const analysisPrompt = detectedUrls.length === 1
          ? purpose === 'investment'
            ? `Analyze this property AS AN INVESTMENT with clear metrics (show final numbers only, NO formulas):

Property Details:
${properties.map(p => `- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}
- Lot Size: ${p.lot_size || 'N/A'} sqft`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured INVESTMENT analysis using this format:

**💰 Financial Analysis**
• List price: $[amount]
• Price per sqft: $[number]
• Down payment (20%): $[amount]
• Loan amount: $[amount]
• Monthly payment (7% APR, 30 years): $[amount]

**📊 Investment Metrics**
• Estimated monthly rent: $[amount]
• Monthly expenses:
  - Mortgage: $[amount]
  - Property tax: $[amount]
  - Insurance: $[amount]
  - Maintenance: $[amount]
  - HOA fees: $[amount]
• Net monthly cash flow: $[amount]
• Annual cap rate: [percentage]%
• Cash-on-cash return: [percentage]%

**✨ Property Highlights**
• [Key feature 1]
• [Key feature 2]
• [Key feature 3]

**💡 Investment Recommendation**
[Brief recommendation based on the investment metrics]

CRITICAL: 
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Answer ONLY what the user requested
- If you have a tip, keep it SHORT (1 sentence) and ask if they want more details`
            : `Analyze this property FOR PRIMARY RESIDENCE with clear metrics (show final numbers only, NO formulas):

Property Details:
${properties.map(p => `- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}
- Lot Size: ${p.lot_size || 'N/A'} sqft`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured HOMEBUYER analysis using this format:

**💰 Acquisition Cost**
• List price: $[amount]
• Price per sqft: $[number]
• Down payment (20%): $[amount]
• Loan amount: $[amount]
• Monthly payment (7% APR, 30 years): $[amount]

**🏡 Monthly Housing Cost**
• Mortgage: $[amount]
• Estimated property tax: $[amount]
• Home insurance: $[amount]
• Maintenance: $[amount]
• HOA fees: $[amount if applicable]
• **Total monthly**: $[amount]

**✨ Property Highlights**
• [Key feature 1 - focus on livability]
• [Key feature 2 - focus on comfort]
• [Key feature 3 - focus on neighborhood]

**⚠️ Important Considerations**
• [Important factor 1 for living]
• [Important factor 2 for living]
• [Important factor 3 for living]

**💡 Home Evaluation**
[Brief recommendation based on living quality and affordability]

CRITICAL: 
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Answer ONLY what the user requested
- If you have a tip, keep it SHORT (1 sentence) and ask if they want more details`
          : purpose === 'investment'
            ? `Compare these ${detectedUrls.length} properties AS INVESTMENTS with detailed calculations:

${properties.map((p, i) => `Property ${i + 1}:
- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured INVESTMENT comparison using this format:

**📊 Side-by-Side Comparison**

For each property:
**Property ${1}:** [Address]
• Price: $[amount] | Price/sqft: $[result]
• Monthly payment: $[calculated]
• Estimated rent: $[estimated]
• Net cash flow: $[result]
• Cap rate: [percentage]%

[Repeat for each property]

**💡 Key Differences**
• Price & value: [comparison]
• Size & layout: [comparison]
• Location: [comparison]
• Investment potential: [comparison]

**🏆 Best Investment**
[Which property offers better ROI and why based on the numbers]

**⚠️ Important Factors**
• [List key investment considerations]

CRITICAL: 
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Answer ONLY what the user requested
- If you have a tip, keep it SHORT (1 sentence) and ask if they want more details`
            : `Compare these ${detectedUrls.length} properties FOR PRIMARY RESIDENCE with detailed calculations:

${properties.map((p, i) => `Property ${i + 1}:
- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured HOMEBUYER comparison using this format:

**📊 Side-by-Side Comparison**

For each property:
**Property ${1}:** [Address]
• Price: $[amount] | Price/sqft: $[result]
• Total monthly payment: $[calculated including all costs]
• Size: [sqft] sqft
• Beds/Baths: [beds]/[baths]

[Repeat for each property]

**💡 Key Differences**
• Cost & affordability: [comparison]
• Space & layout: [comparison]
• Location & neighborhood: [comparison]
• Suitability for living: [comparison]

**🏆 Best Option for Living**
[Which property offers better living quality and affordability]

**⚠️ Important Factors**
• [List key living considerations]

CRITICAL: 
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Answer ONLY what the user requested
- If you have a tip, keep it SHORT (1 sentence) and ask if they want more details`;

        console.log('Analysis prompt created, calling OpenAI API...');
      
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a real estate expert providing concise, structured property analysis. Use bullet points and clear formatting.' },
            { role: 'user', content: analysisPrompt }
          ],
          max_tokens: 1000
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`OpenAI API failed: ${aiResponse.status}`, errorText);
        throw new Error(`OpenAI API failed: ${aiResponse.status} - ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const analysis = aiData.choices[0].message.content;
      
      console.log('AI analysis generated successfully');
      
      // Return as regular chat response with properties metadata
      // Frontend will check if user explicitly requests calculator
      return new Response(
        JSON.stringify({ 
          response: analysis,
          properties: properties, // Include properties for calculator option
          hasProperties: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      } catch (analysisError) {
        console.error('Error during property analysis:', analysisError);
        // Fallback: return property data without AI analysis
        return new Response(
          JSON.stringify({ 
            response: JSON.stringify({
              type: 'property_analysis',
              analysis: `I fetched the property data but encountered an error generating the analysis. Here's what I found:\n\n${properties.map((p, i) => `**Property ${i + 1}:**\n- Address: ${p.address}, ${p.city}, ${p.state}\n- Price: $${p.price?.toLocaleString()}\n- ${p.beds} beds, ${p.baths} baths, ${p.sqft?.toLocaleString()} sqft\n- Year Built: ${p.year_built || 'N/A'}`).join('\n\n')}`,
              properties: properties,
              isComparison: detectedUrls.length > 1
            })
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch context from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch fresh user profile from database if authenticated
    let userProfile = clientProfile;
    if (authHeader && !userProfile) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile && profile.onboarding_completed) {
          userProfile = profile.buyer_type || 'regular-buyer';
        }
      }
    }

    const { data: programs } = await supabase.from('programs').select('*').limit(5);
    const { data: rates } = await supabase.from('rates').select('*').limit(5);

    // Build personalization context from full profile
    let personalizationContext = '';
    if (clientProfile && clientProfile.onboarding_completed) {
      const prefs = [];
      
      if (clientProfile.budget_min && clientProfile.budget_max) {
        prefs.push(`💰 Budget Range: $${clientProfile.budget_min.toLocaleString()} - $${clientProfile.budget_max.toLocaleString()}`);
      }
      
      if (clientProfile.desired_monthly_payment) {
        prefs.push(`💵 Target Monthly Payment: $${clientProfile.desired_monthly_payment.toLocaleString()}`);
      }
      
      if (clientProfile.property_types && clientProfile.property_types.length > 0) {
        prefs.push(`🏠 Preferred Property Types: ${clientProfile.property_types.join(', ')}`);
      }
      
      if (clientProfile.location_preferences && clientProfile.location_preferences.length > 0) {
        prefs.push(`📍 Preferred Locations: ${clientProfile.location_preferences.join(', ')}`);
      }
      
      if (clientProfile.risk_level) {
        prefs.push(`📊 Investment Risk Tolerance: ${clientProfile.risk_level}`);
      }
      
      if (clientProfile.commute_preferences) {
        const commutePref = clientProfile.commute_preferences as any;
        if (commutePref.max_commute_minutes) {
          prefs.push(`🚗 Max Commute Time: ${commutePref.max_commute_minutes} minutes`);
        }
        if (commutePref.walkability_preference) {
          prefs.push(`🚶 Walkability Preference: ${commutePref.walkability_preference}`);
        }
      }
      
      if (prefs.length > 0) {
        personalizationContext = `\n\n## 👤 USER PROFILE & PREFERENCES\n${prefs.join('\n')}

**PERSONALIZATION INSTRUCTIONS**:
- Automatically apply these preferences when the user searches for properties
- If the user's query conflicts with their saved preferences, prioritize their explicit request
- Remind them of their preferences when relevant ("Based on your $500K budget...")
- Suggest properties that match their criteria without them having to repeat preferences`;
      }
    }

    const contextInfo = `
Available First-Time Buyer Programs:
${programs?.map(p => `- ${p.name} (${p.jurisdiction}): ${p.eligibility}, Max benefit: $${p.max_benefit}`).join('\n') || 'None'}

Current Mortgage Rates:
${rates?.map(r => `- ${r.product}: ${r.apr}% APR`).join('\n') || 'None'}

**User Profile**: ${userProfile || 'regular-buyer'}
${personalizationContext}
`;

    // Add property-specific context if analyzing a selected property
    const propertyContext = propertyData ? `

**SELECTED PROPERTY ANALYSIS**:
The user has selected this specific property to analyze:
- Address: ${propertyData.address}, ${propertyData.city}, ${propertyData.state}
- Price: $${propertyData.price.toLocaleString()}
- Bedrooms: ${propertyData.beds} | Bathrooms: ${propertyData.baths}
- Square Feet: ${propertyData.sqft}
${propertyData.description ? `- Description: ${propertyData.description}` : ''}

Provide a detailed analysis for this property.
` : '';

    const profileInstructions = {
      'investor': `
**INVESTOR ANALYSIS MODE**:
When analyzing properties for investors, you MUST provide:

1. **Purchase & Renovation Breakdown**:
   - Purchase price
   - Estimated renovation costs (based on property condition from images/description)
   - Closing costs (typically 2-5% of purchase price)
   - Total initial investment

2. **Financing Analysis**:
   - Down payment required (typically 20-25% for investment properties)
   - Mortgage details using current rates (${rates?.find(r => r.product.includes('30'))?.apr || 7}% APR for 30-year)
   - Monthly mortgage payment (P&I)
   - Property taxes (estimate based on location)
   - Insurance costs
   - HOA fees (if applicable)

3. **Investment Returns**:
   - After Repair Value (ARV) estimate
   - Potential monthly rental income (research local market rates)
   - Cash flow analysis (rental income - all expenses)
   - Cap rate calculation
   - ROI percentage
   - Break-even timeline

4. **Exit Strategy**:
   - Recommended hold period
   - Projected sale price in 3-5 years
   - Total profit estimate
   - Flip vs. rent recommendation

5. **Risk Assessment**:
   - Market conditions
   - Property condition concerns
   - Neighborhood factors
   - Competition analysis

Format with clear numbers, calculations, and professional recommendations.`,
      
      'first-time-buyer': `
**FIRST-TIME BUYER GUIDANCE MODE**:
Focus on helping the buyer understand:
- Affordability based on the 28/36 rule
- Down payment options and assistance programs available
- Estimated monthly payments including PMI if <20% down
- Closing costs breakdown
- Move-in ready vs. fixer-upper considerations
- Neighborhood quality and schools
- Long-term value and appreciation potential
- Step-by-step buying process`,
      
      'regular-buyer': `
**REGULAR BUYER MODE**:
Provide balanced analysis covering:
- Property value and market comparison
- Monthly payment estimates
- Neighborhood and lifestyle fit
- Maintenance and upkeep considerations
- Resale potential
- Overall value assessment`
     };

    // Define available tools - NO LISTING SEARCH
    // Listing searches are handled by the main search bar on the homepage
    const tools: any[] = [];

    const systemPrompt = `You are HomeLens, an AI-powered real estate and mortgage expert focused on the US market.

**CRITICAL RULE #1: NEVER tell the user to "use the search bar" or "enter your criteria in the search". You are responsible for parsing their natural language and triggering searches yourself.**

**CRITICAL RULE #2: NO RAW JSON IN CHAT MESSAGES**
- The "message" field is ONLY for natural language text that the user will read
- NEVER paste JSON objects, arrays, or structured data inside "message"
- NEVER include things like: {"location": "...", "price": ...} or [{"property": ...}] in your message
- All structured data for the UI goes into separate fields: "searchParams" or "uiBlock"
- Keep "message" as clean, readable markdown text ONLY

**WHAT YOU CAN DO:**
- Answer ANY question about home buying, mortgages, investments, renovations, and market insights
- Calculate buying power, monthly payments, cap rates, cash flow, and ROI
- Search for properties using the Realty in US database (you trigger this, not the user)
- Use mortgage, buying power, and investor calculators
- Explain first-time buyer programs, down payment assistance, and financing options
- Provide market insights and neighborhood analysis

**BEHAVIORAL RULES:**

1. **BE CONVERSATIONAL & EXPERT-LIKE**
   - You can discuss ANY real estate topic, not just property search
   - Answer questions about: affordability, mortgages, renovations, market conditions, investment strategies
   - Be helpful and educational like ChatGPT, but specialized in US real estate
   - ALWAYS respond directly in the chat - NEVER tell users to use other features or interfaces
   - You ARE the chat assistant, so process ALL requests directly

2. **HANDLE ALL FINANCIAL SCENARIOS DIRECTLY**
   - When users ask about buying power, affordability, or scenarios with income/down payment info:
     * Calculate their buying power immediately using the 28% rule
     * Show them what they can afford with clear numbers
     * If they also mention wanting a house, calculate AND search for properties in their range
   - NEVER redirect users to calculators or other tools - do the math yourself and present results
   - Example: "$200k down, $150k income" → Calculate max buying power (~$750k-$850k), show the numbers, and optionally search

3. **LOCATION-ONLY IS ENOUGH TO START A SEARCH**
   - If the user provides ANY location (city + state, ZIP, or clear location like "in Arlington, VA" or "around Miami"), you MUST immediately trigger a property search.
   - Use default filters if other criteria aren't specified:
     * status: "for_sale"
     * price_min: 0
     * price_max: 2000000
     * beds_min: 0 (any bedrooms)
     * baths_min: 0 (any bathrooms)
     * prop_type: "any"
   - Do NOT ask for more details before searching if you have a location.
   - Example: "Show me homes in Arlington, VA" → IMMEDIATELY trigger search with defaults

3. **PROGRESSIVE REFINEMENT - MAINTAIN SEARCH CONTEXT**
   - Treat follow-up messages as refinements of the current search, not brand new conversations
   - If the user says "make it 3 bedrooms" or "under 900k" after a search:
     → Update the previous search filters with the new criteria
     → Re-trigger the search with updated filters
     → Keep the location unless they specify a new one
   - Always reuse previous context: location, price range, bedrooms, etc. unless explicitly changed
   - EVERY refinement MUST trigger a NEW search with updated filters

4. **EXTRACT FILTERS FROM NATURAL LANGUAGE**
   Parse these patterns:
   - "3 bedroom house" → beds_min: 3
   - "under 1M" or "less than 1M" or "below $1,000,000" → price_max: 1000000
   - "above 500k" or "at least $500,000" → price_min: 500000
   - "at least 2 baths" or "2+ bathrooms" → baths_min: 2
   - "single family" or "house" → prop_type: "single_family"
   - "condo" or "apartment" → prop_type: "condo"
   - "townhouse" or "townhome" → prop_type: "townhouse"

5. **HANDLE FINANCIAL PLANNING REQUESTS DIRECTLY**
   - When users ask for "scenarios", "affordability analysis", or give income/down payment info:
     → Calculate buying power using: (annual income × 0.28) / 12 = max monthly housing
     → Subtract taxes (~$400) and insurance (~$200)  
     → Calculate max loan at 6.8% over 30 years
     → Add down payment to get total buying power
     → Present results clearly with breakdown
   - If they mention wanting to BUY a house, also trigger a property search
   - If they just want financial analysis, provide the numbers without searching
   - Example 1 (wants to buy): "With $150k income and $200k down, your buying power is ~$800k-$900k. Let me find homes in that range in [location if provided]."
   - Example 2 (just scenario): "With $150k income and $200k down, here's what you can afford: Monthly budget: $3,500, Down payment: $200k, Max home price: ~$850k, Monthly mortgage: ~$3,100"

6. **WHEN TO SEARCH FOR PROPERTIES**
   Trigger a property search when user:
   - Explicitly asks to "find", "show", "search for", "get me", "I want to buy" homes/houses/properties
   - Provides ANY location + intent to see listings (even if budget isn't specified)
   - Says something like "homes in [city]" or "properties around [location]"
   - Refines previous search criteria ("under 900k", "make it 3 bedrooms", "show condos instead")
   
   These phrases MUST trigger an immediate search:
   - "find a 3 bedroom house in Arlington"
   - "show me homes in Miami"
   - "properties in Austin under 500k"
   - "I want to buy a house in Denver"
   - "can you show houses of less than 900k?" (refinement of previous search)
   
7. **FOLLOW-UP QUESTIONS ONLY FOR MISSING LOCATION**
   - ONLY ask "Which city and state (or ZIP) should I search in?" if NO location is provided AND you cannot infer one from context
   - Never ask unnecessary questions about budget or bedrooms if you can use defaults
   - As soon as the user provides a location, trigger the search immediately

8. **PURE ADVISORY QUESTIONS (NO SEARCH)**
   If user asks:
   - "Is now a good time to buy in Miami?"
   - "How much does a kitchen remodel cost?"
   - "What's the difference between FHA and conventional loans?"
   - "Should I invest or buy a primary residence?"
   
   → Answer in detail WITHOUT triggering a property search
   → Only search if they explicitly ask for listings

9. **BUYING POWER CALCULATION (DO THIS YOURSELF, DON'T REDIRECT)**
   When users ask about affordability or scenarios:
   - Calculate using 28% rule: Max monthly housing = (annual income × 0.28) / 12
   - Subtract estimated taxes ($400) and insurance ($200) from max monthly
   - Remaining = max mortgage payment (P&I only)
   - Use 6.8% rate, 30-year term: Loan = Payment × 166.08 (approximation factor)
   - Add down payment to get total buying power
   - Show ONLY final numbers in natural language, NO formulas
   - NEVER say "use the calculator" or "try the buying power tool" - YOU are the tool
   - Example: "With a $150k annual income and $200k down payment, your estimated buying power is around $800k-$900k. Your monthly payment would be about $3,100-$3,500 including taxes and insurance."

10. **RESPONSE FORMAT - THIS IS CRITICAL**
   
   You MUST return valid JSON in one of these exact formats:
   
   **Format A: Advisory response (no property search)**
   {
     "message": "Your detailed markdown answer here. Keep it natural and conversational. NO JSON objects or arrays in this text."
   }
   
   Example:
   {
     "message": "Great question! FHA loans require as little as 3.5% down and are easier to qualify for, making them popular with first-time buyers. Conventional loans typically need 5-20% down but often have lower rates and no upfront mortgage insurance premium. Here's what to consider..."
   }
   
   **Format B: Property search response**
   {
     "message": "Natural language explanation of what you searched and why. For example: 'Here are some 3-bedroom houses in Arlington, VA under $900,000 based on your updated budget.'",
     "searchParams": {
       "location": "Arlington, VA",
       "price_min": 0,
       "price_max": 900000,
       "beds_min": 3,
       "baths_min": 0,
       "prop_type": "single_family"
     }
   }
   
   CRITICAL RULES FOR FORMAT B:
   - "message" = Human-readable explanation ONLY. No JSON, no raw filter objects, no arrays.
   - "searchParams" = Structured search filters for the property search API
   - The frontend will call the search API with searchParams and display results automatically
   - You do NOT need to describe the searchParams in the message - just explain what the user will see
   - ALWAYS include searchParams when performing any search or search refinement
   
   **Format C: Calculator UI block (only if explicitly requested)**
   {
     "message": "Brief intro to the calculator",
     "uiBlock": {
       "type": "ui_block/mortgage_calculator",
       "title": "Mortgage Calculator",
       "inputs": {...}
     }
   }
   
   **NEVER DO THIS:**
   ❌ "Here are the search parameters: {\"location\": \"Arlington, VA\", \"price_max\": 900000}"
   ❌ "I'll search for properties with these filters: [location: Arlington, beds: 3]"
   ❌ Including any JSON-like syntax in the message field
   
   **ALWAYS DO THIS:**
   ✅ "Here are some 3-bedroom houses in Arlington, VA under $900,000 based on your updated budget."
   ✅ "I found 60 homes in Miami that match your criteria. These properties range from condos to single-family homes."
   ✅ "Based on your income, I estimate your buying power is $700k-$850k. I'll show you matching homes in Denver."

11. **EVERY SEARCH MUST RETURN SEARCH PARAMS**
   - ANY time you decide to search for properties, you MUST include searchParams in your JSON response
   - This includes: initial searches, refinements, filter updates, and new location searches
   - If you mention searching or showing properties in your message, searchParams MUST be present
   - The frontend depends on searchParams to actually fetch and display the properties

12. **TONE & STYLE**
   - Conversational and consultative
   - Professional but friendly
   - Use bullet points and sections in your message
   - Show final calculated numbers only (no formulas or calculation steps)
   - Be prescriptive and realistic
   - NEVER redirect users to other tools or features - handle everything in the chat
   - You ARE the assistant - answer directly, calculate directly, search directly

**IMPORTANT**: ONLY show scenario cards (Financing, Investment, Taxes, Flip) if the user EXPLICITLY asks for scenarios, options, or wants to see more details about specific aspects. Do NOT show them automatically after property analysis.

**Current Market Data (2025)**:
${contextInfo}
${propertyContext}

${profileInstructions[userProfile as keyof typeof profileInstructions] || profileInstructions['regular-buyer']}

${hasImage ? '\n**IMAGE ANALYSIS MODE**: The user has uploaded a property image. Analyze it thoroughly for:\n- Property condition and quality\n- Visible features and upgrades\n- Estimated renovation needs\n- Market appeal and positioning\n' : ''}

**CRITICAL FORMATTING RULES:**
- Always respond in American English
- Use markdown formatting for ALL links: [text](url)
- Use current 2025 market data and trends
- Average mortgage rate: 6.8% (30-year fixed)
- Format responses with emojis for visual clarity
- Use bullet points with emojis for better readability
- Structure information in clear sections with headers
- **NEVER show raw mathematical formulas** (like "$500,000 * 0.20 = $100,000")
- Only show final calculated results in clean format (like "Down Payment: $100,000")
- **NEVER include JSON objects, arrays, or structured data inside your "message" text**

**REMEMBER:**
- Parse user intent and trigger property searches yourself - never tell them to use the search bar
- For any search query, return searchParams so the frontend can fetch and display properties
- Keep "message" as natural language only - no JSON, no raw objects
- Every refinement ("under 900k", "3 bedrooms") triggers a NEW search with updated searchParams`;

    console.log('Making OpenAI API call for regular chat...');
    
    // First API call with tools enabled
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages
        ],
        tools: tools,
        tool_choice: 'auto',
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected OpenAI response format:', JSON.stringify(data));
      throw new Error('Invalid response format from OpenAI');
    }
    
    const assistantMessage = data.choices[0].message;
    let assistantResponse = assistantMessage.content;
    console.log('OpenAI raw response:', assistantResponse);

    // Parse and validate the AI's JSON response to ensure clean message format
    try {
      let parsed: any;

      // First try to parse the whole response as JSON
      try {
        parsed = JSON.parse(assistantResponse);
      } catch (innerError) {
        // If that fails, try to extract the JSON block from mixed text + JSON
        const firstBrace = assistantResponse.indexOf('{');
        const lastBrace = assistantResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const possibleJson = assistantResponse.slice(firstBrace, lastBrace + 1);
          parsed = JSON.parse(possibleJson);
        } else {
          throw innerError;
        }
      }

      console.log('Parsed JSON response:', JSON.stringify(parsed, null, 2));

      // If the model provided structured searchParams, build real listing links
      if (parsed && parsed.searchParams && parsed.searchParams.location) {
        const sp = parsed.searchParams;
        const location = String(sp.location || '').trim();
        const beds = typeof sp.beds_min === 'number' ? sp.beds_min : undefined;
        const maxPrice = typeof sp.price_max === 'number' ? sp.price_max : undefined;

        const links: { source: string; url: string; title: string }[] = [];

        // Zillow
        if (location) {
          const zillowLocation = location.replace(/\s+/g, '-').replace(',', '');
          const zillowStateObj: any = {
            pagination: {},
            mapBounds: {},
            filterState: {}
          };
          if (beds) zillowStateObj.filterState.beds = { min: beds };
          if (maxPrice) zillowStateObj.filterState.price = { max: maxPrice };

          const zillowUrl = `https://www.zillow.com/homes/${zillowLocation}_rb/?searchQueryState=${encodeURIComponent(
            JSON.stringify(zillowStateObj)
          )}`;

          links.push({
            source: 'Zillow',
            url: zillowUrl,
            title: 'Zillow filtered search'
          });

          // Realtor.com
          const realtorLocation = location.replace(/\s+/g, '_').replace(',', '');
          let realtorUrl = `https://www.realtor.com/realestateandhomes-search/${realtorLocation}`;
          const realtorParams: string[] = [];
          if (beds) realtorParams.push(`beds-${beds}`);
          if (maxPrice) realtorParams.push(`price-na-${maxPrice}`);
          if (realtorParams.length) realtorUrl += '/' + realtorParams.join('/');
          links.push({
            source: 'Realtor.com',
            url: realtorUrl,
            title: 'Realtor.com filtered search'
          });

          // Redfin (generic city/area filter)
          const redfinLocation = location.replace(/\s+/g, '-').replace(',', '');
          let redfinUrl = `https://www.redfin.com/${redfinLocation}/filter/`;
          const redfinParams: string[] = [];
          if (beds) redfinParams.push(`min-beds=${beds}`);
          if (maxPrice) redfinParams.push(`max-price=${maxPrice}`);
          if (redfinParams.length) redfinUrl += redfinParams.join(',');
          links.push({
            source: 'Redfin',
            url: redfinUrl,
            title: 'Redfin filtered search'
          });
        }

        // Build a clean, user-friendly message with the links in markdown format
        if (links.length > 0) {
          const locationText = location || 'your area';
          const bedsText = beds ? `${beds}+ bedroom ` : '';
          const priceText = maxPrice ? `under $${(maxPrice / 1000).toFixed(0)}k` : '';
          
          const header = `Here are property listings for ${bedsText}homes ${priceText ? priceText + ' ' : ''}in ${locationText}:`;
          
          // Format links as clickable markdown
          const linksMarkdown = links
            .map((l) => `- **[${l.source}](${l.url})** - Click to view listings`)
            .join('\n');
          
          // Add natural follow-up question
          const followUp = '\n\n💬 **What would you like to do next?**\n• Analyze a specific property you found?\n• Search with different criteria?\n• Get help with financing calculations?';

          parsed.message = `${header}\n\n${linksMarkdown}${followUp}`;
          parsed.links = links;
          
          // CRITICAL: Remove searchParams to prevent frontend from calling search-listings
          // which would hit the rate-limited external API
          delete parsed.searchParams;
        }
      }

      // Validate that message doesn't contain raw JSON or searchParams
      if (parsed.message) {
        let cleanMessage = parsed.message;
        const originalMessage = cleanMessage;

        // AGGRESSIVE JSON REMOVAL: Find any opening brace and remove everything after it
        const firstBraceInMessage = cleanMessage.indexOf('{');
        if (firstBraceInMessage !== -1) {
          const textBeforeBrace = cleanMessage.substring(0, firstBraceInMessage).trim();
          if (textBeforeBrace.length > 10) {
            cleanMessage = textBeforeBrace;
            console.log('Removed JSON starting at position', firstBraceInMessage);
          }
        }

        // Also look for common JSON patterns and remove them
        cleanMessage = cleanMessage
          .replace(/\{[^{}]*"message"[^{}]*:.*?\}$/s, '')
          .replace(/\{[^{}]*"searchParams"[^{}]*:.*?\}$/s, '')
          .replace(/\{[^{}]*"location"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"price_min"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"beds_min"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"prop_type"[^{}]*:.*?\}/g, '')
          .replace(/\s*\.\.\.\s*$/g, '')
          .replace(/\s+$/g, '')
          .trim();

        // Remove any line that looks like JSON (starts with '{' or contains '": ')
        cleanMessage = cleanMessage
          .split('\n')
          .filter((line: string) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('{') &&
                   !trimmed.includes('": ') &&
                   !trimmed.includes('"searchParams"') &&
                   !trimmed.includes('"location"');
          })
          .join('\n')
          .trim();

        if (cleanMessage !== originalMessage) {
          console.log('Message cleaned. Original length:', originalMessage.length, 'New length:', cleanMessage.length);
        }

        parsed.message = cleanMessage;
      }

      console.log('Final cleaned response:', JSON.stringify(parsed, null, 2));

      // Return the parsed object directly (not double-stringified)
      // Frontend expects { response: { message: "...", searchParams: {...} } }
      return new Response(
        JSON.stringify({ response: parsed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      // If AI didn't return valid JSON, wrap it in a proper structure
      console.log('AI response was not valid JSON, wrapping it:', assistantResponse?.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          response: JSON.stringify({
            message: assistantResponse || 'I apologize, I couldn\'t process that request.'
          })
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in ai-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
