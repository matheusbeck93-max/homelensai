import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting property alerts check...');

    // Get all properties
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, price, status, address, city, state');

    if (propertiesError) throw propertiesError;

    console.log(`Checking ${properties?.length || 0} properties for changes...`);

    for (const property of properties || []) {
      // Get the most recent snapshot for this property
      const { data: lastSnapshot } = await supabase
        .from('property_snapshots')
        .select('*')
        .eq('property_id', property.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();

      let hasChanges = false;
      const changes: { type: string; oldValue: string; newValue: string }[] = [];

      if (lastSnapshot) {
        // Check for price drop
        if (parseFloat(property.price) < parseFloat(lastSnapshot.price)) {
          hasChanges = true;
          changes.push({
            type: 'price_drop',
            oldValue: lastSnapshot.price.toString(),
            newValue: property.price.toString()
          });
        }

        // Check for status change
        if (property.status !== lastSnapshot.status) {
          hasChanges = true;
          changes.push({
            type: 'status_change',
            oldValue: lastSnapshot.status,
            newValue: property.status
          });
        }
      }

      // Create new snapshot
      await supabase
        .from('property_snapshots')
        .insert({
          property_id: property.id,
          price: property.price,
          status: property.status
        });

      // If there are changes, notify users who favorited this property
      if (hasChanges) {
        console.log(`Changes detected for property ${property.id}:`, changes);

        // Get users who favorited this property with Pro/Premium subscription
        const { data: favorites } = await supabase
          .from('favorites')
          .select(`
            user_id,
            profiles!inner(
              email,
              full_name,
              subscription_status,
              alert_email_enabled,
              alert_price_drops,
              alert_status_changes
            )
          `)
          .eq('property_id', property.id);

        for (const favorite of favorites || []) {
          const profile = (favorite as any).profiles;
          
          // Check if user has Pro/Premium and alerts enabled
          if (
            !profile.alert_email_enabled ||
            (profile.subscription_status !== 'pro' && profile.subscription_status !== 'premium')
          ) {
            continue;
          }

          // Send alerts based on user preferences
          for (const change of changes) {
            // Check if user wants this type of alert
            if (
              (change.type === 'price_drop' && !profile.alert_price_drops) ||
              (change.type === 'status_change' && !profile.alert_status_changes)
            ) {
              continue;
            }

            // Check if we already sent this alert
            const { data: existingAlert } = await supabase
              .from('sent_alerts')
              .select('id')
              .eq('user_id', favorite.user_id)
              .eq('property_id', property.id)
              .eq('alert_type', change.type)
              .eq('new_value', change.newValue)
              .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .maybeSingle();

            if (existingAlert) {
              console.log(`Alert already sent to user ${favorite.user_id} for ${change.type}`);
              continue;
            }

            // Send email
            try {
              const emailSubject = change.type === 'price_drop' 
                ? `🏠 Price Drop Alert: ${property.address}`
                : `🔔 Status Change: ${property.address}`;

              const emailBody = change.type === 'price_drop'
                ? `
                  <h2>Great News! Price Drop Alert</h2>
                  <p>Hi ${profile.full_name || 'there'},</p>
                  <p>A property you're watching has dropped in price:</p>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>${property.address}, ${property.city}, ${property.state}</h3>
                    <p style="font-size: 18px;">
                      <span style="text-decoration: line-through; color: #888;">$${parseFloat(change.oldValue).toLocaleString()}</span>
                      <strong style="color: #16a34a; margin-left: 10px;">$${parseFloat(change.newValue).toLocaleString()}</strong>
                    </p>
                    <p style="color: #16a34a; font-weight: bold;">
                      Save $${(parseFloat(change.oldValue) - parseFloat(change.newValue)).toLocaleString()}!
                    </p>
                  </div>
                  <p><a href="${supabaseUrl.replace('https://', 'https://app.')}/property/${property.id}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Property</a></p>
                  <p style="color: #888; font-size: 12px; margin-top: 30px;">You're receiving this because you favorited this property. Manage your alert preferences in Settings.</p>
                `
                : `
                  <h2>Status Update</h2>
                  <p>Hi ${profile.full_name || 'there'},</p>
                  <p>A property you're watching has changed status:</p>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>${property.address}, ${property.city}, ${property.state}</h3>
                    <p>
                      Status changed from <strong>${change.oldValue}</strong> to <strong>${change.newValue}</strong>
                    </p>
                  </div>
                  <p><a href="${supabaseUrl.replace('https://', 'https://app.')}/property/${property.id}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Property</a></p>
                  <p style="color: #888; font-size: 12px; margin-top: 30px;">You're receiving this because you favorited this property. Manage your alert preferences in Settings.</p>
                `;

              await resend.emails.send({
                from: 'HomeLens Alerts <onboarding@resend.dev>',
                to: [profile.email],
                subject: emailSubject,
                html: emailBody,
              });

              console.log(`Alert email sent to ${profile.email} for ${change.type}`);

              // Record sent alert
              await supabase
                .from('sent_alerts')
                .insert({
                  user_id: favorite.user_id,
                  property_id: property.id,
                  alert_type: change.type,
                  old_value: change.oldValue,
                  new_value: change.newValue
                });

            } catch (emailError) {
              console.error(`Failed to send email to ${profile.email}:`, emailError);
            }
          }
        }
      }
    }

    console.log('Property alerts check completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Property alerts check completed',
        propertiesChecked: properties?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-property-alerts function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
