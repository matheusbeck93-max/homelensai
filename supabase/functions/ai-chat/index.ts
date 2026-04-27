import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logging.ts';
import { enforceDailyLimit } from '../_shared/dailyLimit.ts';

const log = createLogger('ai-chat');

// Attachment security constants
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
];
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB in raw bytes (~13.3MB base64)
const MAX_BASE64_LENGTH = Math.ceil(MAX_ATTACHMENT_SIZE_BYTES * 4 / 3); // base64 overhead
const MAX_ATTACHMENTS = 5;

// Input validation schema
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  hasImage: z.boolean().optional(),
  userProfile: z.any().optional(),
  propertyData: z.any().optional(),
  conversationMode: z.boolean().optional(),
  extensionMode: z.boolean().optional(),
  attachment: z.object({
    name: z.string(),
    mimeType: z.string(),
    data: z.string(),
  }).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    mimeType: z.string(),
    data: z.string(),
  })).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Enforce daily AI limit (shared across app + extension via profiles.daily_analysis_count).
    // Premium = unlimited. Free = 3/day. Unauthenticated = 401 (no quota consumed).
    const limitResult = await enforceDailyLimit(req);
    if (!limitResult.allowed) {
      return limitResult.response!;
    }

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
    
    const { messages, hasImage, userProfile: clientProfile, propertyData, conversationMode, extensionMode, attachment, attachments: attachmentsArray } = validationResult.data;
    // Normalize: support both single `attachment` (legacy) and `attachments` array
    const allAttachments: Array<{ name: string; mimeType: string; data: string }> = [];
    if (attachmentsArray && attachmentsArray.length > 0) {
      allAttachments.push(...attachmentsArray);
    } else if (attachment) {
      allAttachments.push(attachment);
    }

    // --- Server-side attachment validation ---
    if (allAttachments.length > MAX_ATTACHMENTS) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_ATTACHMENTS} attachments allowed per message.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    for (const att of allAttachments) {
      if (!ALLOWED_MIME_TYPES.includes(att.mimeType.toLowerCase())) {
        return new Response(
          JSON.stringify({ error: `File type "${att.mimeType}" is not supported. Allowed: PDF, JPG, PNG, WEBP, HEIC.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (att.data.length > MAX_BASE64_LENGTH) {
        return new Response(
          JSON.stringify({ error: `File "${att.name}" exceeds the 10MB size limit.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const authHeader = req.headers.get('Authorization');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // In conversation mode, check if this is a property search request
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    
    // Detect property URLs
    const urlRegex = /(https?:\/\/(?:www\.)?(zillow|realtor|redfin|trulia|homes)\.com\/[^\s]+)/gi;
    const detectedUrls = lastUserMessage.match(urlRegex) || [];
    
    log.step('URL detection', { count: detectedUrls.length });
    
    // In conversation mode, let AI handle property search queries naturally
    // We removed the auto-deflect logic - AI will now parse and trigger searches
    
    // Check if we're waiting for purpose clarification
    const previousMessage = messages.length > 1 ? messages[messages.length - 2]?.content || '' : '';
    const isWaitingForPurpose = previousMessage.includes('Is this for investment or primary residence?');
    
    // Check if user is responding with purpose
    const purposeResponse = lastUserMessage.toLowerCase();
    const isInvestment = purposeResponse.includes('invest');
    const isPrimaryResidence = purposeResponse.includes('residence') || purposeResponse.includes('primary') || purposeResponse.includes('live') || purposeResponse.includes('home');
    
    // If propertyData is provided (from Chrome extension with DOM-extracted data),
    // skip Firecrawl and use it directly - it's more accurate
    if (propertyData && detectedUrls.length >= 1) {
      log.step('Using client-provided propertyData (extension mode)');
      
      // Build property object from client-provided data
      const clientProperty = {
        id: 'ext-property',
        externalLink: propertyData.externalUrl || detectedUrls[0],
        condition: 'active',
        status: 'active',
        price: propertyData.price || 0,
        beds: propertyData.beds || 0,
        baths: propertyData.baths || 0,
        sqft: propertyData.sqft || 0,
        year_built: propertyData.yearBuilt || null,
        lot_size: propertyData.lotSize || null,
        address: propertyData.address || 'Unknown',
        city: propertyData.city || 'Unknown',
        state: propertyData.state || 'XX',
        zip: propertyData.zip || '00000',
        image_urls: propertyData.imageUrl ? [propertyData.imageUrl] : [],
        description: propertyData.description || '',
        propertyType: propertyData.propertyType || null,
      };
      
      // Determine purpose from conversation history
      let purpose = 'investment';
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
      
      log.step('Analysis purpose', { purpose });
      
      const properties = [clientProperty];
      const analysisPrompt = purpose === 'investment'
        ? `Analyze this property AS AN INVESTMENT with clear metrics (show final numbers only, NO formulas):

Property Details:
- Address: ${clientProperty.address}, ${clientProperty.city}, ${clientProperty.state} ${clientProperty.zip}
- Price: $${clientProperty.price || 'N/A'}
- Beds: ${clientProperty.beds || 'N/A'} | Baths: ${clientProperty.baths || 'N/A'} | Sqft: ${clientProperty.sqft || 'N/A'}
- Year Built: ${clientProperty.year_built || 'N/A'}
- Lot Size: ${clientProperty.lot_size || 'N/A'} sqft
- Property Type: ${clientProperty.propertyType || 'N/A'}
- Description: ${clientProperty.description || 'N/A'}

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
• [Key feature 1 - based on ACTUAL property data above]
• [Key feature 2 - based on ACTUAL property data above]
• [Key feature 3 - based on ACTUAL property data above]

**💡 Investment Recommendation**
[Brief recommendation based on the investment metrics]

CRITICAL: 
- Use the EXACT property data provided above (address, price, beds, baths, sqft, year built). Do NOT make up different numbers.
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Keep response concise with bullet points.`
        : `Analyze this property FOR PRIMARY RESIDENCE with clear metrics (show final numbers only, NO formulas):

Property Details:
- Address: ${clientProperty.address}, ${clientProperty.city}, ${clientProperty.state} ${clientProperty.zip}
- Price: $${clientProperty.price || 'N/A'}
- Beds: ${clientProperty.beds || 'N/A'} | Baths: ${clientProperty.baths || 'N/A'} | Sqft: ${clientProperty.sqft || 'N/A'}
- Year Built: ${clientProperty.year_built || 'N/A'}
- Lot Size: ${clientProperty.lot_size || 'N/A'} sqft
- Property Type: ${clientProperty.propertyType || 'N/A'}
- Description: ${clientProperty.description || 'N/A'}

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
• [Key feature 1 - based on ACTUAL property data above]
• [Key feature 2 - based on ACTUAL property data above]
• [Key feature 3 - based on ACTUAL property data above]

**⚠️ Important Considerations**
• [Important factor 1 for living]
• [Important factor 2 for living]
• [Important factor 3 for living]

**💡 Home Evaluation**
[Brief recommendation based on living quality and affordability]

CRITICAL: 
- Use the EXACT property data provided above (address, price, beds, baths, sqft, year built). Do NOT make up different numbers.
- Show ONLY final calculated numbers. DO NOT show formulas or calculation steps.
- Keep response concise with bullet points.`;

      // Fetch user profile for match score
      let matchScoreInstructions = '';
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (profile && profile.onboarding_completed) {
            matchScoreInstructions = `\n\nYou MUST start your response with: "MATCH_SCORE: X/10" where X is how well this property matches the user profile:\n- Budget: $${profile.budget_min || 0} - $${profile.budget_max || 'unlimited'}\n- Preferred cities: ${profile.preferred_cities?.join(', ') || 'any'}\n- Property types: ${profile.property_types?.join(', ') || 'any'}\n- Has children: ${profile.has_children ? 'Yes' : 'No'}\n- Safety priority: ${profile.safety_priority || 'medium'}\n- Risk level: ${profile.risk_level || 'moderate'}\nAfter the score line, continue with the analysis.`;
          }
        }
      }

      log.step('Calling AI Gateway with client property data');
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `You are a real estate expert providing concise, structured property analysis. Use bullet points and clear formatting. Keep responses under 300 words for browser extension readability.${matchScoreInstructions}` },
            ...messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: analysisPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const errorText = await aiResponse.text();
        console.error(`AI Gateway failed: ${aiResponse.status}`, errorText);
        throw new Error(`AI Gateway failed: ${aiResponse.status} - ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const analysis = aiData.choices[0].message.content;
      
      console.log('AI analysis with client data generated successfully');
      
      return new Response(
        JSON.stringify({ 
          response: analysis,
          properties: properties,
          hasProperties: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If 1+ URLs detected (no propertyData from extension), trigger Firecrawl analysis mode
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
      console.log('Triggering property analysis mode (Firecrawl)');
      
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
          
          log.step('Property data extracted', { url: new URL(url).hostname });
          
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
        log.step('Properties fetched, starting AI analysis', { count: properties.length });
        
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

        console.log('Analysis prompt created, calling Lovable AI Gateway...');
      
      // Fetch user profile for match score (Firecrawl path)
      let firecrawlMatchScoreInstructions = '';
      if (authHeader) {
        try {
          const fcSupabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const fcSupabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const fcSupabase = createClient(fcSupabaseUrl, fcSupabaseKey);
          const fcToken = authHeader.replace('Bearer ', '');
          const { data: { user: fcUser } } = await fcSupabase.auth.getUser(fcToken);
          if (fcUser) {
            const { data: fcProfile } = await fcSupabase.from('profiles').select('*').eq('id', fcUser.id).single();
            if (fcProfile && fcProfile.onboarding_completed) {
              firecrawlMatchScoreInstructions = `\n\nYou MUST start your response with: "MATCH_SCORE: X/10" where X is how well this property matches the user profile:\n- Budget: $${fcProfile.budget_min || 0} - $${fcProfile.budget_max || 'unlimited'}\n- Preferred cities: ${fcProfile.preferred_cities?.join(', ') || 'any'}\n- Property types: ${fcProfile.property_types?.join(', ') || 'any'}\n- Has children: ${fcProfile.has_children ? 'Yes' : 'No'}\n- Safety priority: ${fcProfile.safety_priority || 'medium'}\n- Risk level: ${fcProfile.risk_level || 'moderate'}\n- Min bedrooms: ${fcProfile.min_bedrooms || 'any'}\n- Min bathrooms: ${fcProfile.min_bathrooms || 'any'}\n- Must-have features: ${fcProfile.must_have_features?.join(', ') || 'none'}\nAfter the score line, continue with the analysis.`;
            }
          }
        } catch (profileErr) {
          console.error('Error fetching profile for match score (Firecrawl path):', profileErr);
        }
      }

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `You are a real estate expert providing concise, structured property analysis. Use bullet points and clear formatting.${firecrawlMatchScoreInstructions}` },
            { role: 'user', content: analysisPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const errorText = await aiResponse.text();
        console.error(`AI Gateway failed: ${aiResponse.status}`, errorText);
        throw new Error(`AI Gateway failed: ${aiResponse.status} - ${errorText}`);
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
    let fullProfile: any = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          fullProfile = profile;
          if (!userProfile) {
            userProfile = profile.buyer_type || 'regular-buyer';
          }
        }
      }
    }

    const { data: programs } = await supabase.from('programs').select('*').limit(5);
    const { data: rates } = await supabase.from('rates').select('*').limit(5);

    // Build personalization context from full profile
    let personalizationContext = '';
    const profileSource = fullProfile || clientProfile;
    if (profileSource) {
      const prefs = [];
      
      if (profileSource.budget_min && profileSource.budget_max) {
        prefs.push(`💰 Budget Range: $${profileSource.budget_min.toLocaleString()} - $${profileSource.budget_max.toLocaleString()}`);
      }
      
      if (profileSource.desired_monthly_payment) {
        prefs.push(`💵 Target Monthly Payment: $${profileSource.desired_monthly_payment.toLocaleString()}`);
      }
      
      if (profileSource.property_types && profileSource.property_types.length > 0) {
        prefs.push(`🏠 Preferred Property Types: ${profileSource.property_types.join(', ')}`);
      }
      
      if (profileSource.location_preferences && profileSource.location_preferences.length > 0) {
        prefs.push(`📍 Preferred Locations: ${Array.isArray(profileSource.location_preferences) ? profileSource.location_preferences.join(', ') : JSON.stringify(profileSource.location_preferences)}`);
      }
      
      if (profileSource.risk_level) {
        prefs.push(`📊 Investment Risk Tolerance: ${profileSource.risk_level}`);
      }
      
      if (profileSource.commute_preferences) {
        const commutePref = profileSource.commute_preferences as any;
        if (commutePref.max_commute_minutes) {
          prefs.push(`🚗 Max Commute Time: ${commutePref.max_commute_minutes} minutes`);
        }
        if (commutePref.walkability_preference) {
          prefs.push(`🚶 Walkability Preference: ${commutePref.walkability_preference}`);
        }
      }

      // New profile fields
      if (profileSource.investment_strategy) {
        prefs.push(`📈 Investment Strategy: ${profileSource.investment_strategy}`);
      }
      if (profileSource.hold_period_years) {
        prefs.push(`⏱️ Hold Period: ${profileSource.hold_period_years} years`);
      }
      if (profileSource.financing_preference) {
        prefs.push(`🏦 Financing Preference: ${profileSource.financing_preference}`);
      }
      if (profileSource.min_bathrooms) {
        prefs.push(`🚿 Min Bathrooms: ${profileSource.min_bathrooms}`);
      }
      if (profileSource.must_have_features && profileSource.must_have_features.length > 0) {
        prefs.push(`✅ Must-Have Features: ${profileSource.must_have_features.join(', ')}`);
      }
      if (profileSource.has_children) {
        prefs.push(`👨‍👩‍👧‍👦 Has Children: Yes`);
        if (profileSource.children_ages && profileSource.children_ages.length > 0) {
          prefs.push(`🎒 Children Ages: ${profileSource.children_ages.join(', ')}`);
        }
      }
      if (profileSource.climate_preference) {
        prefs.push(`🌤️ Climate Preference: ${profileSource.climate_preference}`);
      }
      if (profileSource.safety_priority) {
        prefs.push(`🛡️ Safety Priority: ${profileSource.safety_priority}`);
      }
      if (profileSource.about_me) {
        prefs.push(`📝 About the user: ${profileSource.about_me}`);
      }
      if (profileSource.buyer_types && profileSource.buyer_types.length > 0) {
        prefs.push(`👤 Buyer Personas: ${profileSource.buyer_types.join(', ')}`);
      }
      if (profileSource.investment_strategies && profileSource.investment_strategies.length > 0) {
        prefs.push(`📈 Investment Strategies: ${profileSource.investment_strategies.join(', ')}`);
      }
      if (profileSource.financing_preferences && profileSource.financing_preferences.length > 0) {
        prefs.push(`🏦 Financing Preferences: ${profileSource.financing_preferences.join(', ')}`);
      }
      if (profileSource.preferred_cities && profileSource.preferred_cities.length > 0) {
        prefs.push(`📍 Preferred Cities: ${profileSource.preferred_cities.join(', ')}`);
      }
      if (profileSource.min_bedrooms) {
        prefs.push(`🛏️ Min Bedrooms: ${profileSource.min_bedrooms}`);
      }
      
      if (prefs.length > 0) {
        personalizationContext = `\n\n## 👤 USER PROFILE & PREFERENCES\n${prefs.join('\n')}

**PERSONALIZATION INSTRUCTIONS**:
- Automatically apply these preferences when the user searches for properties
- If the user's query conflicts with their saved preferences, prioritize their explicit request
- Remind them of their preferences when relevant ("Based on your $500K budget...")
- Suggest properties that match their criteria without them having to repeat preferences
- If user has children, heavily weight school district quality in property evaluations
- If safety_priority is high, prominently feature neighborhood safety data
- If climate_preference is set, note climate alignment for suggested locations`;
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
- Price: $${propertyData.price?.toLocaleString?.() || propertyData.price}
- Bedrooms: ${propertyData.beds} | Bathrooms: ${propertyData.baths}
- Square Feet: ${propertyData.sqft}
${propertyData.lotSize ? `- Lot Size: ${propertyData.lotSize} sqft` : ''}
${propertyData.yearBuilt ? `- Year Built: ${propertyData.yearBuilt}` : ''}
${propertyData.propertyType ? `- Property Type: ${propertyData.propertyType}` : ''}
${propertyData.externalUrl ? `- Listing URL: ${propertyData.externalUrl}` : ''}
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

    const systemPrompt = `You are HomeLens AI, a real estate decision guide built for people navigating the U.S. housing market. Your role is to help users make informed, confident decisions.

## IDENTITY
You are a knowledgeable, direct, and honest real estate advisor. Communicate like a trusted professional who deeply understands the market and always prioritize the user's actual situation over generic advice.

You are NOT:
- A generic chatbot that gives textbook answers
- A sales tool trying to make a purchase sound better than it is
- A legal or tax advisor
- A substitute for professional pre-approval or licensed counsel

## USER PROFILE — SILENT CONTEXT
The user's profile (goals, budget, market, experience level) is provided above as silent background context. Rules:
- Never reference the profile explicitly. Forbidden openers: "Based on your profile", "You mentioned you're an investor", "As a first-time buyer".
- Use it to calibrate depth, tone, and relevance — not to personalize every message.
- Apply it only when it genuinely changes the quality of the answer.
- If the user's question contradicts their profile, follow the question — do not assume.
- Examples: first-time buyer → explain PMI/DTI/escrow without being asked. Experienced investor → skip basics, go to cap rate and cash flow. Short-term flip → factor holding costs and resale timing. Specific metro → anchor local data to that market proactively.

## RESPONSE CALIBRATION — CLASSIFY EVERY QUESTION FIRST

**Level 1 — Quick Factual** (e.g., "What is PMI?", "What does DTI stand for?")
→ 2–5 sentences. No tables, no headers, no bullets, no follow-ups. Just clarity.

**Level 2 — Situational** (e.g., "Is 6.5% a good rate?", "10% or 20% down?")
→ Direct answer + brief context + one concrete takeaway. Light structure if helpful.

**Level 3 — Decision-Oriented** (e.g., "Can I afford a $1M home with $200k income?", "Buy or rent in Austin?")
→ Full structured response: short answer → math breakdown → local market context → key risks → actionable next steps. Use tables only where they clarify.

**Level 4 — Ambiguous / Incomplete** (e.g., "Can I afford a house?", "Is now a good time to buy?")
→ Ask ONE clarifying question to get the missing variable. Do not guess and pad.
Example: "To give you a real answer, I need your approximate income, target price range, and location — can you share those?"

## RESPONSE PRINCIPLES
1. **Lead with a direct answer.** Never bury the conclusion. Short answer first, then explain.
2. **Show your reasoning.** When math is involved, show the calculation path.
3. **Use local market data, not national averages.** When a city/metro is mentioned, anchor to it. If you lack precise current data, say so and give the best estimate with a clear note.
4. **Name the risks.** Proactively flag variables that could change the outcome (HOA, variable income treatment, rate lock timing, etc.).
5. **Close with action, never vagueness.** End Level 2/3 responses with at least one concrete next step. "Get a pre-approval letter from a lender familiar with [market] — takes 1–3 business days, won't hurt your credit" beats "Talk to a lender".
6. **Calibrate tone to intent.** Curious/learning → educational, warm. Pre-decision → consultative, precise. Investor → analytical, numbers-forward. Stressed → calm, structured, reassuring without being dishonest.

## ACCURACY STANDARDS
- Mortgage rates: reflect current conditions; if no real-time data, state the period your estimate reflects.
- Property tax, HOA, and local medians: market-specific. No national averages on local questions.
- DTI: reference both the 28/36 rule AND the 43–45% lender ceiling.
- PMI: flag when ≥20% down eliminates it or <20% triggers it; estimate monthly cost when relevant.

## BOUNDARIES
- No predictions of price movements or appreciation guarantees.
- No specific legal advice (title, contracts, zoning).
- No simulated credit decisions or "you will be approved" statements.
- No naming specific lenders, agents, or financial products.
- No questions outside real estate, mortgage, and related personal finance.
When a question hits these limits, acknowledge briefly and redirect: "That's a call for your lender/attorney/CPA — but what I can tell you is [the in-scope part]."

## FORMAT — MARKDOWN
- **Headers (\`##\`)**: Level 3 only. Never in Level 1 or 2.
- **Tables**: only for multi-variable comparisons or multi-line cost breakdowns. Not decoration.
- **Bold**: the single most important number/conclusion per section. Not every phrase.
- **Bullets**: for 3+ parallel items. Not as a default structure.
- **Length**: L1 = 2–5 sentences, no structure. L2 = 1 short paragraph + optional single table or 3-bullet list. L3 = full structured response with sections, tables where useful, clear closing action. L4 = one clarifying question, nothing more.
- White space is clarity. No walls of text.

## FORBIDDEN OPENERS
Never start with: "Great question", "Great news", "That's a great topic", "Absolutely!", "Sure!", "Of course!", "This is a common question", "It depends". Never restate or paraphrase the user's question.

## VOICE
Direct. Knowledgeable. Honest about uncertainty. Never condescending, never vague to avoid commitment. The advisor a first-time buyer wishes they had and an experienced investor still finds useful.

**CRITICAL RULE #1: ALWAYS TRIGGER PROPERTY SEARCHES YOURSELF**
- NEVER tell users to "use the search bar" or "enter criteria"
- When users ask for properties, YOU parse their request and return searchParams
- The frontend will automatically fetch and display property hero cards

**CRITICAL RULE #2: NO RAW JSON IN CHAT MESSAGES**
- The "message" field is ONLY for natural language text
- NEVER include JSON objects, arrays, or structured data in "message"
- searchParams goes in a separate field, not in message text
- Keep "message" as clean, readable text ONLY

**CRITICAL RULE #3: UNDERSTAND REGIONAL AND METRO AREA QUERIES**
- Parse regional/metro area terms and convert to searchable locations
- Common metro areas and their coverage:
  * "DMV" or "DMV area" → Washington DC metro (Arlington VA, Alexandria VA, Silver Spring MD, Bethesda MD)
  * "Bay Area" → San Francisco Bay Area (San Francisco, Oakland, San Jose, Palo Alto)
  * "Triangle" → North Carolina Research Triangle (Raleigh, Durham, Chapel Hill)
  * "Metro Atlanta" → Atlanta metro (Atlanta, Decatur, Marietta, Sandy Springs)
  * "South Florida" → Miami metro (Miami, Fort Lauderdale, West Palm Beach)
  * "DFW" → Dallas-Fort Worth (Dallas, Fort Worth, Plano, Arlington TX)
  
- When user mentions a metro/regional area:
  * Pick the PRIMARY city in that metro area for the search
  * Mention in your message that you're showing results from the main metro area
  * Example: "DMV area" → use "Arlington, VA" or "Silver Spring, MD" as location
  * Example: "Bay Area" → use "San Francisco, CA" or "Oakland, CA"

- If location is UNCLEAR or AMBIGUOUS:
  * Ask a follow-up question: "I'd like to help you search! Which specific area are you interested in? For example, are you looking in [option 1], [option 2], or somewhere else?"
  * DO NOT guess - ask for clarification
  * Example: User says "somewhere in Virginia" → Ask: "Which area of Virginia? Arlington/Alexandria, Richmond, Virginia Beach, or another city?"

**WHAT YOU CAN DO:**
- Answer ANY question about home buying, mortgages, investments, renovations, and market insights
- Calculate buying power, monthly payments, cap rates, cash flow, and ROI
- **Search for properties by returning searchParams** - frontend will show hero cards with real property images
- Explain first-time buyer programs, down payment assistance, and financing options
- Provide market insights and neighborhood analysis
- Analyze properties from URLs that users paste

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
   - If the user provides ANY clear, specific location (city + state, ZIP, or unambiguous location), you MUST immediately trigger a property search.
   - Use default filters if other criteria aren't specified:
     * status: "for_sale"
     * price_min: 0
     * price_max: 2000000
     * beds_min: 0 (any bedrooms)
     * baths_min: 0 (any bathrooms)
     * prop_type: "any"
   - CLEAR locations that can trigger immediate search:
     * "Arlington, VA" ✅
     * "Miami" or "Miami, FL" ✅
     * "90210" (ZIP code) ✅
     * "DMV area" ✅ (use Arlington, VA or Silver Spring, MD)
     * "Bay Area" ✅ (use San Francisco, CA or Oakland, CA)
   - AMBIGUOUS locations that require clarification:
     * "somewhere in Virginia" ❌ → Ask: "Which area of Virginia?"
     * "up north" ❌ → Ask: "Which city or state are you interested in?"
     * "the coast" ❌ → Ask: "Which coastal area?"
   - Example: "Show me homes in Arlington, VA" → IMMEDIATELY trigger search with defaults
   - Example: "Find houses in the DMV" → IMMEDIATELY trigger search with "Arlington, VA" and mention "Showing results from the DC metro area (Arlington, Alexandria, and nearby)"

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
   
7. **FOLLOW-UP QUESTIONS FOR AMBIGUOUS LOCATIONS**
   - If location is mentioned but UNCLEAR or TOO BROAD:
     * "somewhere in California" → Ask: "Which area of California? Los Angeles, San Francisco, San Diego, or another city?"
     * "near the beach" → Ask: "Which coastal area are you interested in?"
     * "up north" → Ask: "Which northern state or city would you like to search in?"
   - If NO location is provided at all:
     * Ask: "Which city and state (or ZIP code) should I search in?"
   - If location is CLEAR (even if broad like "DMV" or "Bay Area"):
     * Convert to specific searchable city
     * Trigger search immediately with that city
     * Mention the metro area coverage in your message
   - Never ask unnecessary questions about budget or bedrooms if you can use defaults
   - As soon as you have a clear/specific location, trigger the search immediately

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
   
   You MUST return valid JSON in one of these formats:
   
   **Format A: Advisory response (no property search)**
   {
     "message": "Your detailed markdown answer here. Be natural and conversational."
   }
   
   **Format B: Property search response (MOST IMPORTANT)**
   {
     "message": "I'll show you some 3-bedroom houses in Arlington, VA under $900,000.",
     "searchParams": {
       "location": "Arlington, VA",
       "price_min": 0,
       "price_max": 900000,
       "beds_min": 3,
       "baths_min": 0,
       "prop_type": "single_family"
     }
   }
   
   **Format B Examples for Regional Searches:**
   
   User: "Find houses in the DMV area"
   {
     "message": "I'll show you homes in the DC metro area, starting with Arlington and Alexandria, VA.",
     "searchParams": {
       "location": "Arlington, VA",
       "price_min": 0,
       "price_max": 2000000,
       "beds_min": 0,
       "baths_min": 0,
       "prop_type": "any"
     }
   }
   
   User: "3 bedroom homes in DMV under 900k"
   {
     "message": "I'll show you 3+ bedroom homes in the DC metro area (Arlington, Alexandria, Silver Spring) under $900,000.",
     "searchParams": {
       "location": "Arlington, VA",
       "price_min": 0,
       "price_max": 900000,
       "beds_min": 3,
       "baths_min": 0,
       "prop_type": "any"
     }
   }
   
   User: "Houses somewhere in Virginia" (AMBIGUOUS - ask for clarification)
   {
     "message": "I'd be happy to search Virginia for you! Which area are you most interested in? Northern Virginia (Arlington/Alexandria), Richmond, Virginia Beach, Charlottesville, or another city?"
   }
   Note: NO searchParams because location is too ambiguous - wait for user to clarify
   
   CRITICAL FOR FORMAT B:
   - "message" = Natural language ONLY. No JSON, no filter descriptions
   - "searchParams" = Separate field with search filters
   - Frontend will fetch properties and show hero cards with images
   - ALWAYS include searchParams when user requests properties
   - For refinements like "under 900k" or "3 bedrooms", return UPDATED searchParams
   
   **Format C: Calculator UI block (rare)**
   {
     "message": "Here's the calculator you requested",
     "uiBlock": { "type": "ui_block/mortgage_calculator", ... }
   }
   
   **NEVER DO THIS:**
   ❌ Including JSON in message: "Search params: {\"location\": ...}"
   ❌ Describing filters: "I'll search for 3 beds, $900k max in Arlington"
   
   **ALWAYS DO THIS:**
   ✅ Clean message + searchParams in separate field
   ✅ "I'll show you matching properties." + searchParams object

11. **EVERY SEARCH MUST RETURN SEARCH PARAMS**
   - ANY time you decide to search for properties, you MUST include searchParams in your JSON response
   - This includes: initial searches, refinements, filter updates, and new location searches
   - If you mention searching or showing properties in your message, searchParams MUST be present
   - The frontend depends on searchParams to actually fetch and display the properties

12. **ADDITIONAL STYLE RULES**
   - Show final calculated numbers only (no formulas or calculation steps)
   - Be prescriptive and realistic — give clear recommendations, not vague options
   - NEVER redirect users to other tools or features - handle everything in the chat
   - You ARE the assistant - answer directly, calculate directly, search directly

13. **SCOPE RESTRICTION**
   You are exclusively a real estate assistant. Your purpose is to help users make better real estate decisions in the U.S. market.
   
   Topics you cover:
   - Buying, selling, or renting residential or commercial properties
   - Real estate investment analysis (ROI, cap rate, cash flow, IRR)
   - Mortgage, financing, and affordability
   - Market trends, neighborhood insights, and city comparisons
   - Property tax, insurance, closing costs, and transaction costs
   - First-time buyer programs, grants, and government incentives
   - Real estate law basics (contracts, disclosures, title, escrow)
   - Personal finance when directly tied to a real estate decision
   - Analysis of specific properties or listings
   - Interior design, furniture, and home decoration tied to home investment
   - Home renovation costs tied to investment analysis
   
   Topics outside your scope — redirect these:
   - General personal finance unrelated to buying or investing
   - Lifestyle, relationships, food, travel, technology, or any other topic unrelated to real estate
   
   When a user asks something outside your scope, acknowledge their situation warmly in one sentence, then redirect clearly. Always end the redirect with a concrete real estate offer.

**IMPORTANT**: ONLY show scenario cards (Financing, Investment, Taxes, Flip) if the user EXPLICITLY asks for scenarios, options, or wants to see more details about specific aspects. Do NOT show them automatically after property analysis.

**Current Market Data (2025)**:
${contextInfo}
${propertyContext}

${profileInstructions[userProfile as keyof typeof profileInstructions] || profileInstructions['regular-buyer']}

**MARKET & FINANCIAL INTELLIGENCE**:
You are THE definitive real estate market and financial expert. You MUST:
- Know current mortgage rate environment and how it impacts affordability
- Understand property tax differences between states and cities (e.g., Texas has no state income tax but high property taxes ~2.2%; Florida has homestead exemptions; NJ/CT have the highest property taxes; California has Prop 13 limiting assessment increases)
- Know state/local tax incentives: homestead exemptions, STAR programs (NY), Prop 13 (CA), no-income-tax states (TX, FL, NV, WA, TN)
- Recommend loan programs: FHA (3.5% down, 580+ credit), VA (0% down for veterans), USDA (rural, 0% down), conventional (5-20% down), jumbo thresholds vary by county ($766,550 in 2025 for most areas)
- Know first-time buyer programs by state: down payment assistance, tax credits (MCC), closing cost grants, state housing finance agencies
- Understand 1031 exchanges for investors, depreciation benefits, capital gains exclusions ($250k single/$500k married for primary residence after 2 years)
- Compare markets: appreciation rates, rent-to-price ratios, cap rates by metro area
- Factor in insurance costs (flood zones require NFIP, hurricane-prone areas like FL/TX have higher premiums, wildfire risk in CA increases costs)
- Know HOA trends, special assessments, and condo vs SFH cost structures
- When user has children, heavily weight school district quality (GreatSchools ratings, state test scores)
- Consider climate risks (flooding, hurricanes, wildfires, tornadoes) and how they affect insurance premiums and long-term property value
- Consider neighborhood safety using crime data knowledge and trends
- Proactively surface relevant tax benefits, loan programs, and market context the user may not have asked about

${extensionMode ? `
**EXTENSION MODE (Chrome Extension)**:
- Keep responses SHORT and concise — under 250 words
- Use bullet points, not long paragraphs
- Skip asking about purpose — use the provided analysis mode
- Do NOT ask follow-up questions unless truly needed
` : ''}

${extensionMode && propertyData && fullProfile ? `
**PROPERTY MATCH SCORE**:
You MUST start your response with a single line: "MATCH_SCORE: X/10" where X is a number from 0 to 10 (can use decimals like 7.5).
This score represents how well this specific property matches the user's complete profile considering ALL of these factors:
- Budget fit (price vs. user's budget range)
- Location match (vs. preferred cities/commute needs)
- Property type match (vs. preferred types)
- School quality (CRITICAL if user has children — weight this heavily)
- Neighborhood safety (weighted by user's safety_priority setting)
- Climate alignment (vs. user's climate_preference)
- Investment potential (if investor: cap rate, appreciation, rental yield)
- Tax implications (property tax burden, available programs like FHA/VA if user qualifies)
- Lifestyle features (must-have features match, walkability)
- Financing fit (eligible loan programs based on user's financing_preference)

After the score line, explain your reasoning through the analysis bullets — reference which factors helped or hurt the score.
Be specific: mention actual tax rates, applicable loan programs, school ratings, and market comparisons.
If the score is below 5, clearly explain what makes this a poor match.
If above 8, highlight why this is an excellent match.
` : ''}

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
- Every refinement ("under 900k", "3 bedrooms") triggers a NEW search with updated searchParams

---
WORKFLOW EXCEL GENERATION:
STRICT RULE — Excel is only sent when explicitly requested or previously accepted:
- Generate the "uiBlock" of type "workflow_excel" ONLY when ONE of these is true:
  (A) The user's CURRENT message explicitly asks for an Excel / spreadsheet / .xlsx / downloadable file / "send me the spreadsheet" / "export to Excel" / similar.
  (B) In a PREVIOUS assistant turn YOU offered the spreadsheet and the user has now replied affirmatively ("yes", "sure", "please do", "send it", "go ahead", etc.).
- In every other case, DO NOT include a workflow_excel uiBlock. Provide your analysis in the message and, if a spreadsheet would genuinely add value, close with a single offer like: "Want me to put this into a downloadable Excel spreadsheet?"
- Do not offer the spreadsheet on every analysis — only when the analysis has enough numeric depth to justify a workbook (budgets, cost breakdowns, multi-month financing, multi-row ROI, etc.).
- Never send the workbook silently or as a default. Offer → wait for yes → then send.

When generating the Excel (after confirmation or explicit request):

**CRITICAL: EVERY CELL MUST HAVE A NUMERIC VALUE.**
- NEVER leave cost/value columns empty or with placeholder text like "Fill in" or "Not Specified". EVERY cost cell MUST contain a realistic estimated number.
- If the prior analysis lacks specific numbers, YOU MUST estimate realistic values based on typical U.S. market data for the described scenario, region, and property type. Research common costs and use those.
- Example: If no kitchen remodel cost was mentioned for a Denver condo, estimate $15,000-$25,000 based on typical Denver market rates.
- Use raw numbers for monetary values (15000 not "$15,000" or "").
- Percentages should be strings like "6.50%" in the cell.
- If conversation history contains a prior analysis with numbers, extract ALL those numbers into cells.

To trigger Excel generation, include a "uiBlock" field with type "workflow_excel" in your JSON response:
{
  "message": "Here is your detailed spreadsheet with all the numbers.",
  "uiBlock": {
    "type": "workflow_excel",
    "title": "Renovation Budget - 1,200 sqft Austin TX",
    "description": "Complete renovation cost breakdown with all estimated values",
    "filename": "renovation-budget-austin-tx.xlsx",
    "sheets": [
      {
        "name": "Cost Breakdown",
        "headers": ["Category", "Estimated Cost", "Notes"],
        "rows": [["Kitchen Remodel", 25000, "Full gut renovation"], ["Bathroom Remodel", 15000, "Primary bath"]],
        "summaryRows": [{ "label": "Estimated Total Renovation Cost", "value": 75000, "bold": true }]
      }
    ]
  }
}

**MANDATORY RULES:**
1. Every row MUST have values in ALL columns — NO empty cost/value cells
2. Extract ALL dollar amounts, percentages, and metrics from prior messages into cells
3. Include multiple sheets: Summary + detailed breakdowns
4. For renovation: Category, Material Cost, Labor Cost, Total per item — all filled
5. For financing: Payment, Principal, Interest, Balance for 12+ months
6. For affordability: Income, Debts, Max Mortgage, Monthly Payment, Buying Power — all filled
7. For investment: Purchase Price, Expenses, Rental Income, Cash Flow, Cap Rate, ROI
8. Summary sheet with grand totals and key metrics

Also generate Excel for: "can I afford", "how much house", "buying power", "monthly payment for", "mortgage for".

Always include uiBlock alongside your conversational message.`;

    console.log('Making Lovable AI Gateway call for regular chat...');
    
    // Build messages for the AI request, handling multimodal attachment
    const aiMessages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      },
    ];

    // Add all messages except the last one as-is
    for (let i = 0; i < messages.length - 1; i++) {
      aiMessages.push(messages[i]);
    }

    // For the last message, include attachments as multimodal content if present
    const lastMsg = messages[messages.length - 1];
    if (allAttachments.length > 0 && lastMsg) {
      const fileNames = allAttachments.map(a => a.name).join(', ');
      console.log(`Including ${allAttachments.length} attachment(s): ${fileNames}`);
      const contentParts: any[] = [
        { type: 'text', text: lastMsg.content || `Analyze these documents: ${fileNames}` },
      ];
      for (const att of allAttachments) {
        console.log(`  - ${att.name} (${att.mimeType}, ${Math.round(att.data.length / 1024)}KB base64)`);
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${att.mimeType};base64,${att.data}`
          }
        });
      }
      aiMessages.push({
        role: lastMsg.role,
        content: contentParts
      });
    } else {
      aiMessages.push(lastMsg);
    }

    const requestBody: any = {
      model: 'google/gemini-2.5-flash',
      messages: aiMessages,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected AI response format:', JSON.stringify(data));
      throw new Error('Invalid response format from AI Gateway');
    }
    
    const assistantMessage = data.choices[0].message;
    let assistantResponse = assistantMessage.content;
    log.step('AI Gateway response received', { length: assistantResponse?.length });

    /**
     * RESPONSE SANITIZATION & LINK GENERATION
     * 
     * This section ensures that:
     * 1. AI responses are parsed from JSON to extract structured data
     * 2. Search parameters are converted to real property listing URLs (Zillow, Realtor, Redfin)
     * 3. Raw JSON and searchParams are NEVER sent to the chat UI
     * 4. Only human-readable messages with clickable links reach the user
     * 
     * Critical: The frontend should only receive { message: "...", links: [...] }
     * and should render message as text, not JSON blobs
     */
    try {
      let parsed: any;
      let messageBeforeJson = '';

      // First try to parse the whole response as JSON
      try {
        parsed = JSON.parse(assistantResponse);
      } catch (innerError) {
        // If that fails, try to extract the JSON block from mixed text + JSON
        const firstBrace = assistantResponse.indexOf('{');
        const lastBrace = assistantResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          // Keep the text BEFORE the JSON as the message
          messageBeforeJson = assistantResponse.slice(0, firstBrace).trim();
          const possibleJson = assistantResponse.slice(firstBrace, lastBrace + 1);
          parsed = JSON.parse(possibleJson);
          
          // If we have text before the JSON and parsed doesn't have a message, add it
          if (messageBeforeJson && !parsed.message) {
            parsed.message = messageBeforeJson;
          } else if (messageBeforeJson && parsed.message) {
            // Prepend the text before JSON to the existing message
            parsed.message = messageBeforeJson + '\n\n' + parsed.message;
          }
        } else {
          throw innerError;
        }
      }

      log.step('Response parsed successfully', { hasSearchParams: !!parsed.searchParams, hasUiBlock: !!parsed.uiBlock });

      // searchParams will be passed directly to frontend for property fetching
      // No need to generate external links - frontend will show hero cards

      /**
       * MESSAGE SANITIZATION
       * 
       * Ensure chat messages are human-readable by removing JSON artifacts.
       * This prevents raw searchParams JSON from appearing in chat bubbles
       * while keeping the structured data available for the frontend.
       */
      if (parsed.message) {
        let cleanMessage = parsed.message;
        
        // Remove JSON objects from the message text
        cleanMessage = cleanMessage
          .replace(/\{[^{}]*"searchParams"[^{}]*:.*?\}/gs, '')
          .replace(/\{[^{}]*"location"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"price_min"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"beds_min"[^{}]*:.*?\}/g, '')
          .replace(/\{[^{}]*"prop_type"[^{}]*:.*?\}/g, '')
          .trim();

        // Remove lines that look like JSON
        cleanMessage = cleanMessage
          .split('\n')
          .filter((line: string) => {
            const trimmed = line.trim();
            return !trimmed.startsWith('{') &&
                   !trimmed.includes('"searchParams"') &&
                   !trimmed.includes('"location":');
          })
          .join('\n')
          .trim();

        parsed.message = cleanMessage;
      }
      
      // If still no message after all processing, provide a default
      if (!parsed.message && parsed.searchParams) {
        parsed.message = "Let me find those properties for you...";
      }

      log.step('Response cleaned and ready');

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
