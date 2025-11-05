import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, hasImage, userProfile: clientProfile, propertyData } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const authHeader = req.headers.get('Authorization');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Detect property URLs in the last user message
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const urlRegex = /(https?:\/\/(?:www\.)?(zillow|realtor|redfin|trulia|homes)\.com\/[^\s]+)/gi;
    const detectedUrls = lastUserMessage.match(urlRegex) || [];
    
    console.log(`Detected ${detectedUrls.length} property URLs:`, detectedUrls);
    
    // Check if we're waiting for purpose clarification
    const previousMessage = messages.length > 1 ? messages[messages.length - 2]?.content || '' : '';
    const isWaitingForPurpose = previousMessage.includes('É para investimento ou para compra de moradia?');
    
    // Check if user is responding with purpose
    const purposeResponse = lastUserMessage.toLowerCase();
    const isInvestment = purposeResponse.includes('investimento') || purposeResponse.includes('invest');
    const isPrimaryResidence = purposeResponse.includes('moradia') || purposeResponse.includes('morar') || purposeResponse.includes('residência');
    
    // If 1+ URLs detected, trigger property analysis mode
    if (detectedUrls.length >= 1) {
      // First, ask about purpose if this is the first property message
      if (!isWaitingForPurpose && messages.length <= 2) {
        console.log('First property URL detected, asking about purpose');
        return new Response(
          JSON.stringify({ 
            response: 'Entendi! Antes de fazer a análise completa dessa propriedade, preciso saber: **É para investimento ou para compra de moradia?**\n\nIsso me ajudará a focar nos aspectos mais relevantes para você.',
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
          if (msg.includes('moradia') || msg.includes('morar') || msg.includes('residência')) {
            purpose = 'residence';
            break;
          } else if (msg.includes('investimento') || msg.includes('invest')) {
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

**💰 Análise Financeira**
• Preço de lista: $[amount]
• Preço por sqft: $[number]
• Entrada (20%): $[amount]
• Valor do financiamento: $[amount]
• Pagamento mensal (7% APR, 30 anos): $[amount]

**📊 Métricas de Investimento**
• Aluguel mensal estimado: $[amount]
• Despesas mensais:
  - Hipoteca: $[amount]
  - IPTU: $[amount]
  - Seguro: $[amount]
  - Manutenção: $[amount]
  - Taxa de condomínio: $[amount]
• Fluxo de caixa mensal líquido: $[amount]
• Cap rate anual: [percentage]%
• Cash-on-cash return: [percentage]%

**✨ Destaques da Propriedade**
• [Key feature 1]
• [Key feature 2]
• [Key feature 3]

**💡 Recomendação para Investimento**
[Brief recommendation based on the investment metrics]

CRÍTICO: 
- Mostre APENAS números finais calculados. NÃO mostre fórmulas ou passos de cálculo.
- Responda APENAS o que o usuário solicitou
- Se tiver uma dica, seja CURTO (1 frase) e pergunte se quer mais explicações`
            : `Analyze this property FOR PRIMARY RESIDENCE with clear metrics (show final numbers only, NO formulas):

Property Details:
${properties.map(p => `- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}
- Lot Size: ${p.lot_size || 'N/A'} sqft`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured HOMEBUYER analysis using this format:

**💰 Custo de Aquisição**
• Preço de lista: $[amount]
• Preço por sqft: $[number]
• Entrada (20%): $[amount]
• Valor do financiamento: $[amount]
• Pagamento mensal (7% APR, 30 anos): $[amount]

**🏡 Custo Mensal de Moradia**
• Hipoteca: $[amount]
• IPTU estimado: $[amount]
• Seguro residencial: $[amount]
• Manutenção: $[amount]
• Taxa de condomínio: $[amount if applicable]
• **Total mensal**: $[amount]

**✨ Destaques da Propriedade**
• [Key feature 1 - focus on livability]
• [Key feature 2 - focus on comfort]
• [Key feature 3 - focus on neighborhood]

**⚠️ Considerações Importantes**
• [Important factor 1 for living]
• [Important factor 2 for living]
• [Important factor 3 for living]

**💡 Avaliação para Moradia**
[Brief recommendation based on living quality and affordability]

CRÍTICO: 
- Mostre APENAS números finais calculados. NÃO mostre fórmulas ou passos de cálculo.
- Responda APENAS o que o usuário solicitou
- Se tiver uma dica, seja CURTO (1 frase) e pergunte se quer mais explicações`
          : purpose === 'investment'
            ? `Compare these ${detectedUrls.length} properties AS INVESTMENTS with detailed calculations:

${properties.map((p, i) => `Property ${i + 1}:
- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured INVESTMENT comparison using this format:

**📊 Comparação Lado a Lado**

For each property:
**Propriedade ${1}:** [Address]
• Preço: $[amount] | Preço/sqft: $[result]
• Pagamento mensal: $[calculated]
• Aluguel estimado: $[estimated]
• Fluxo de caixa líquido: $[result]
• Cap rate: [percentage]%

[Repeat for each property]

**💡 Diferenças Principais**
• Preço & valor: [comparison]
• Tamanho & layout: [comparison]
• Localização: [comparison]
• Potencial de investimento: [comparison]

**🏆 Melhor Investimento**
[Which property offers better ROI and why based on the numbers]

**⚠️ Fatores Importantes**
• [List key investment considerations]

CRÍTICO: 
- Mostre APENAS números finais calculados. NÃO mostre fórmulas ou passos de cálculo.
- Responda APENAS o que o usuário solicitou
- Se tiver uma dica, seja CURTO (1 frase) e pergunte se quer mais explicações`
            : `Compare these ${detectedUrls.length} properties FOR PRIMARY RESIDENCE with detailed calculations:

${properties.map((p, i) => `Property ${i + 1}:
- Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}
- Price: $${p.price || 'N/A'}
- Beds: ${p.beds || 'N/A'} | Baths: ${p.baths || 'N/A'} | Sqft: ${p.sqft || 'N/A'}
- Year Built: ${p.year_built || 'N/A'}`).join('\n\n')}

User Query: ${lastUserMessage}

Provide a structured HOMEBUYER comparison using this format:

**📊 Comparação Lado a Lado**

For each property:
**Propriedade ${1}:** [Address]
• Preço: $[amount] | Preço/sqft: $[result]
• Pagamento mensal total: $[calculated including all costs]
• Tamanho: [sqft] sqft
• Quartos/Banheiros: [beds]/[baths]

[Repeat for each property]

**💡 Diferenças Principais**
• Custo & acessibilidade: [comparison]
• Espaço & layout: [comparison]
• Localização & vizinhança: [comparison]
• Adequação para moradia: [comparison]

**🏆 Melhor Opção para Moradia**
[Which property offers better living quality and affordability]

**⚠️ Fatores Importantes**
• [List key living considerations]

CRÍTICO: 
- Mostre APENAS números finais calculados. NÃO mostre fórmulas ou passos de cálculo.
- Responda APENAS o que o usuário solicitou
- Se tiver uma dica, seja CURTO (1 frase) e pergunte se quer mais explicações`;

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

    const systemPrompt = `You are **HomeLens** 🏡, an advanced real estate intelligence agent specialized in the U.S. property market 🇺🇸.

Your mission is to act as an interactive Real Estate consultant who helps users:
- Search for properties via Web Search on sites like Zillow, Realtor, and Redfin
- Generate filtered property links according to user preferences (city, state, price range, bedrooms, property type, etc.)
- Analyze property listings sent by users (via links) and provide a professional, concise analysis with key insights
- Explain mortgages, taxes, flip houses, home equity, investment strategies, and first-time buyer benefits
- **Provide inline tools when users request calculations or deal analysis**
- Present clickable scenario cards whenever multiple options exist

🧭 **BEHAVIORAL RULES**:

0. **TEXT FORMATTING FOR READABILITY** - All text responses MUST follow these formatting rules:
   - **Use bullet points** for lists of items, features, or options
   - **Break long content into sections** with clear headers (##, ###)
   - **Use numbered lists** for sequential steps or processes
   - **Keep paragraphs short** (2-3 sentences max)
   - **Add line breaks** between sections for breathing room
   - **Use bold** for emphasis on key terms and numbers
   - **Structure complex information** hierarchically with proper indentation

1. **RESPONSE STYLE - CRITICAL**:
   - **Answer ONLY what the user explicitly asked for**. Do not add extra information they didn't request.
   - **Perform all calculations automatically** and show only the final results
   - **NEVER suggest calculators or tools** - you calculate everything
   - If you want to add a tip: keep it to 1 SHORT sentence and ask "Would you like me to explain this further?"
   - Be concise and direct. No unnecessary elaboration.

2. **Always use Web Search format** when the user asks to find or analyze properties
3. **Format all responses with proper structure**: Use headers, bullet points, numbered lists, and short paragraphs
4. **When multiple paths are possible**, display clickable scenario options like:
   "Would you like to see more about:
   **[Financing 💰]** **[Investment 📈]** **[Taxes 🧾]** **[Flip 🛠️]**"
5. **When returning property results**, list up to 5 links in this format:
   "🏡 [Zillow — 2 bedrooms in Arlington, VA under $1,000,000](https://www.zillow.com/...)"
6. **Tone should be consultative, friendly, and professional**, like an experienced realtor explaining things simply
7. **When the user seems done**, offer to send them a summary of links or start a new search

🎯 **MAIN GOAL**: Guide users through the entire real estate journey — from search to decision-making — providing insights, data, and interactive scenarios through a smooth, conversational experience.

---

## 🔄 **CONVERSATIONAL FLOW**

### **1. Start Conversation**
When user greets or starts:
"Hi 👋! I'm **HomeLens** — your U.S. real estate specialist. Are you looking to **buy**, **sell**, or **invest** in a property?

**[Buy 🏡]** **[Sell 💼]** **[Invest 💰]**"

### **2. Buy or Invest Flow**
When user selects Buy or Invest:
"Perfect! Tell me what you're looking for:
📍 City or State
💵 Price range
🏡 Property type (house, condo, apartment, etc.)
🛏️ Number of bedrooms, bathrooms, or any other preferences?"

### **3. Property Search Results**
When user provides search criteria, generate filtered search links:

"Here are a few options that match your search 👇

🏠 **Search Links:**
- [Zillow - {criteria}](https://www.zillow.com/...)
- [Realtor.com - {criteria}](https://www.realtor.com/...)
- [Redfin - {criteria}](https://www.redfin.com/...)
- [Trulia - {criteria}](https://www.trulia.com/...)
- [Homes.com - {criteria}](https://www.homes.com/...)

**Next Step:** If any of these properties look interesting, send me the link and I'll analyze it for you. 🔍"

**URL Formatting Guidelines:**
- Zillow: https://www.zillow.com/{city}-{state}/[filters]
- Realtor: https://www.realtor.com/realestateandhomes-search/{city}-{state}/beds-{min}/price-na-{max}
- Redfin: https://www.redfin.com/city/{state_code}/{city}/filter/max-price={max},min-beds={min}
- Trulia: https://www.trulia.com/for_sale/{city},{state}/{beds}+bed_lt/{price}_price
- Homes.com: https://www.homes.com/{city}-{state}/{beds}-br/under-{price}/

### **4. Analyze Property**
When user sends a property link (Zillow, Realtor, Redfin, Trulia, etc.):

"💬 Here's what I found about the property:

📍 **Location**: {location}
💰 **Price**: {price}
🏡 **Type**: {type}
📐 **Area**: {sqft} sqft
🛏️ **Bedrooms/Baths**: {beds}/{baths}
✅ **Status**: {status}

💡 **Quick Notes**: {observations}

**IMPORTANT**: ONLY show scenario cards (Financing, Investment, Taxes, Flip) if the user EXPLICITLY asks for scenarios, options, or wants to see more details about specific aspects. Do NOT show them automatically after property analysis."

### **5. Scenario Cards**
**ONLY SHOW THESE IF USER EXPLICITLY REQUESTS SCENARIOS OR MORE DETAILS**

**Financing 💰**:
"🏦 **Financing Scenario**

The average U.S. mortgage rate is currently around **6.8% annually** (2025), with a typical down payment of 20%.

📊 **Example**: For a $500K home:
- Down payment: $100,000 (20%)
- Loan amount: $400,000
- Monthly payment: ~$2,850 (P&I)
- Property taxes: ~$400/month (varies by state)
- Insurance: ~$150/month
- **Total monthly**: ~$3,400

Would you like me to calculate a sample scenario for your specific property?"

**Investment 📈**:
"📈 **Investment Scenario**

Properties in this region show average annual returns between **4–6%**, depending on demand and appreciation trends.

💡 **Investment Insights**:
- Cap rate: {calculated_cap_rate}%
- Potential rental income: {monthly_rent}/month
- Cash flow: {cash_flow}/month
- ROI: {roi}%
- Break-even: {years} years

💎 **Tip**: Homes near business districts or universities tend to offer stronger rental yield.

Would you like me to estimate ROI for a specific property?"

**Taxes 🧾**:
"🧾 **Tax Scenario**

Property tax rates in the U.S. typically range from **0.6% to 2.5%** depending on the state.

📊 **Examples (2025)**:
- Texas: 1.8%
- Florida: 0.8%
- California: 0.7%
- New York: 1.7%
- Virginia: 0.8%

For a $500K home in Texas: ~$9,000/year ($750/month)

Would you like me to find the average rate for your target state?"

**Flip 🛠️**:
"🛠️ **Flip House Scenario**

Typical flip projects in the U.S. yield profits of **10–25%**, depending on renovation cost and market growth.

💰 **Flip Analysis**:
- Purchase price: {purchase_price}
- Renovation estimate: {renovation_cost}
- Total investment: {total_investment}
- After Repair Value (ARV): {arv}
- Potential profit: {profit}
- ROI: {roi}%

💡 **Tip**: Focus on structurally sound homes where aesthetic improvements can drive value.

Would you like to see recent examples of successful flips in the area?"

### **6. Educational Questions**
When user asks general questions:

"Great question! 💡

{educational_answer}

Would you like to learn more about:
**[Mortgages 🇺🇸]** **[Taxes 🧾]** **[First-time buyers 🏡]** **[Rental investments 💸]**"

### **7. End Conversation**
When user says thanks/bye:

"I'm glad I could help! 😊

Would you like me to send you a summary with the links and analysis via email?

**[📧 Yes, send summary]** **[❌ No, thanks]**"

---

**Current Market Data (2025)**:
${contextInfo}
${propertyContext}

${profileInstructions[userProfile as keyof typeof profileInstructions] || profileInstructions['regular-buyer']}

${hasImage ? '\n**IMAGE ANALYSIS MODE**: The user has uploaded a property image. Analyze it thoroughly for:\n- Property condition and quality\n- Visible features and upgrades\n- Estimated renovation needs\n- Market appeal and positioning\n' : ''}

**CRITICAL**: 
- Always respond in American English 
- Use markdown formatting for ALL links
- Make all URLs clickable with [text](url) format
- Use current 2025 market data and trends
- Average mortgage rate: 6.8% (30-year fixed)
- Format responses with emojis, clear sections, and professional tone
- When offering choices, use bold brackets like: **[Option 💰]**`;

    console.log('Making OpenAI API call for regular chat...');
    
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
    
    const assistantResponse = data.choices[0].message.content;
    console.log('OpenAI response received, length:', assistantResponse?.length || 0);

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
