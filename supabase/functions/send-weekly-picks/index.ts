import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import {
  completeWithFallback,
  isSurfaceEnabled,
  BudgetExceededError,
} from '../_shared/ai/router.ts';
import { ProviderError } from '../_shared/ai/types.ts';

const log = createLogger('send-weekly-picks');
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Cron-only — reject any caller without the shared secret header.
  // pg_cron must be updated to include the X-Cron-Secret header.
  // See CONFIG_CHANGES.md for setup instructions.
  const cronCheck = requireCronAuth(req);
  if (cronCheck) return cronCheck;


  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting weekly picks generation...');

    // Get current day of week
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = daysOfWeek[new Date().getDay()];

    // Get all Pro/Premium users who have weekly picks enabled for today
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, weekly_picks_enabled, weekly_picks_day, weekly_picks_last_sent, subscription_status, preferred_cities, max_price_range, min_bedrooms, budget_max')
      .eq('weekly_picks_enabled', true)
      .eq('weekly_picks_day', today)
      .in('subscription_status', ['buyer', 'investor']);

    if (usersError) throw usersError;

    console.log(`Found ${eligibleUsers?.length || 0} eligible users for weekly picks`);

    let picksGenerated = 0;
    let emailsSent = 0;

    for (const user of eligibleUsers || []) {
      try {
        // Check if we already sent picks this week
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        if (user.weekly_picks_last_sent && new Date(user.weekly_picks_last_sent) > new Date(weekAgo)) {
          console.log(`Already sent picks to user ${user.id} this week`);
          continue;
        }

        // Get user's favorited properties to understand preferences
        const { data: favorites } = await supabase
          .from('favorites')
          .select(`
            property_id,
            properties!inner(
              beds, baths, price, city, state, property_types
            )
          `)
          .eq('user_id', user.id)
          .limit(10);

        // Build query for potential properties
        let propertiesQuery = supabase
          .from('properties')
          .select('*')
          .eq('status', 'active')
          .order('list_date', { ascending: false })
          .limit(50);

        // Apply user preferences
        if (user.preferred_cities && user.preferred_cities.length > 0) {
          propertiesQuery = propertiesQuery.in('city', user.preferred_cities);
        }

        if (user.max_price_range) {
          propertiesQuery = propertiesQuery.lte('price', user.max_price_range);
        } else if (user.budget_max) {
          propertiesQuery = propertiesQuery.lte('price', user.budget_max);
        }

        if (user.min_bedrooms) {
          propertiesQuery = propertiesQuery.gte('beds', user.min_bedrooms);
        }

        const { data: candidateProperties, error: propertiesError } = await propertiesQuery;

        if (propertiesError) throw propertiesError;

        if (!candidateProperties || candidateProperties.length === 0) {
          console.log(`No candidate properties found for user ${user.id}`);
          continue;
        }

        // Use AI to curate the best picks
        if (!lovableApiKey) {
          console.error('LOVABLE_API_KEY not configured');
          continue;
        }

        const userPreferences = {
          favoriteTypes: favorites?.map((f: any) => ({
            beds: f.properties.beds,
            baths: f.properties.baths,
            price: f.properties.price,
            city: f.properties.city
          })) || [],
          preferredCities: user.preferred_cities || [],
          maxPrice: user.max_price_range || user.budget_max,
          minBedrooms: user.min_bedrooms
        };

        const systemPrompt = `You are a real estate expert curating personalized property recommendations.
Analyze the candidate properties and user's preferences/favorites to select the 5 BEST matches.

Consider:
- Price alignment with user's budget and favorite properties
- Location preferences and patterns in favorites
- Bedroom/bathroom preferences
- Property features and condition
- Investment potential and value

Return ONLY a JSON array of exactly 5 property IDs in order of best match, like:
["id1", "id2", "id3", "id4", "id5"]

Be selective - choose properties that truly match the user's demonstrated preferences.`;

        const userPrompt = `User Preferences:
${JSON.stringify(userPreferences, null, 2)}

Candidate Properties:
${JSON.stringify(candidateProperties.map(p => ({
  id: p.id,
  address: p.address,
  city: p.city,
  state: p.state,
  price: p.price,
  beds: p.beds,
  baths: p.baths,
  sqft: p.sqft,
  condition: p.condition,
  roi_percent: p.roi_percent
})), null, 2)}

Select the 5 best matches.`;

        let aiContent = '';
        if (isSurfaceEnabled('alerts_engine', user.id)) {
          try {
            const routed = await completeWithFallback(
              'alerts_engine',
              {
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
                temperature: 0.3,
                maxTokens: 500,
              },
              { userId: user.id, tier: 'paid' },
            );
            aiContent = routed.text;
          } catch (err) {
            if (err instanceof BudgetExceededError || (err instanceof ProviderError && err.status === 429)) {
              console.error(`AI router error for user ${user.id}:`, (err as Error).message);
              continue;
            }
            console.error('[send-weekly-picks] router path failed, falling back:', (err as Error)?.message);
          }
        }
        if (!aiContent) {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.3,
              max_tokens: 500,
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI API error for user ${user.id}:`, aiResponse.status);
            continue;
          }

          const aiData = await aiResponse.json();
          aiContent = aiData.choices?.[0]?.message?.content || '';
        }
        
        // Extract property IDs from AI response
        let selectedIds: string[] = [];
        try {
          const jsonMatch = aiContent.match(/\[.*\]/s);
          if (jsonMatch) {
            selectedIds = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Failed to parse AI response:', e);
          // Fallback: take first 5 properties
          selectedIds = candidateProperties.slice(0, 5).map(p => p.id);
        }

        // Get full property details for selected properties
        const selectedProperties = candidateProperties.filter(p => selectedIds.includes(p.id));

        if (selectedProperties.length === 0) {
          console.log(`No properties selected for user ${user.id}`);
          continue;
        }

        // Generate email HTML
        const formatCurrency = (value: number) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          }).format(value);
        };

        const propertiesHtml = selectedProperties.map(property => `
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">${property.address}</h3>
            <p style="margin: 0 0 10px 0; color: #6b7280;">${property.city}, ${property.state} ${property.zip}</p>
            <p style="margin: 0 0 10px 0; font-size: 24px; font-weight: bold; color: #16a34a;">${formatCurrency(property.price)}</p>
            <p style="margin: 0 0 10px 0; color: #4b5563;">
              ${property.beds} beds • ${property.baths} baths • ${property.sqft.toLocaleString()} sqft
            </p>
            ${property.roi_percent ? `<p style="margin: 0 0 10px 0; color: #16a34a; font-weight: bold;">Estimated ROI: ${property.roi_percent}%</p>` : ''}
            <a href="${supabaseUrl.replace('https://', 'https://app.')}/property/${property.id}" 
               style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
              View Details
            </a>
          </div>
        `).join('');

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1f2937; margin-bottom: 10px;">Your Weekly Property Picks</h1>
            <p style="color: #6b7280; margin-bottom: 30px;">
              Hi ${user.full_name || 'there'}! Here are ${selectedProperties.length} properties we think you'll love, curated based on your preferences and favorites.
            </p>
            
            ${propertiesHtml}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; text-align: center;">
                You're receiving this because you enabled Weekly Picks in your HomeLens settings.<br>
                <a href="${supabaseUrl.replace('https://', 'https://app.')}/settings" style="color: #6b7280;">Manage preferences</a>
              </p>
            </div>
          </div>
        `;

        // Send email
        await resend.emails.send({
          from: 'HomeLens Weekly Picks <onboarding@resend.dev>',
          to: [user.email],
          subject: `🏠 Your Weekly Property Picks - ${selectedProperties.length} New Matches`,
          html: emailHtml,
        });

        console.log(`Sent weekly picks to ${user.email}`);
        emailsSent++;

        // Update user's last sent timestamp
        await supabase
          .from('profiles')
          .update({ weekly_picks_last_sent: new Date().toISOString() })
          .eq('id', user.id);

        // Record in history
        await supabase
          .from('weekly_picks_history')
          .insert({
            user_id: user.id,
            property_ids: selectedIds,
            email_sent: true
          });

        picksGenerated++;

      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
      }
    }

    console.log(`Weekly picks completed: ${picksGenerated} users processed, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({ 
        success: true,
        usersProcessed: picksGenerated,
        emailsSent: emailsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-weekly-picks function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
