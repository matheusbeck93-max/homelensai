import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from "https://esm.sh/resend@4.0.0";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { withCronLog } from '../_shared/cron-log.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('check-property-alerts');
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve((req: Request) => withRequestOrigin(req, () => (withCronLog("check-property-alerts", async (req) => {
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    log.step('Starting property alerts check');

    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, price, status, address, city, state');

    if (propertiesError) throw propertiesError;

    log.step(`Checking ${properties?.length || 0} properties for changes`);

    for (const property of properties || []) {
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
        if (parseFloat(property.price) < parseFloat(lastSnapshot.price)) {
          hasChanges = true;
          changes.push({ type: 'price_drop', oldValue: lastSnapshot.price.toString(), newValue: property.price.toString() });
        }
        if (property.status !== lastSnapshot.status) {
          hasChanges = true;
          changes.push({ type: 'status_change', oldValue: lastSnapshot.status, newValue: property.status });
        }
      }

      await supabase
        .from('property_snapshots')
        .insert({ property_id: property.id, price: property.price, status: property.status });

      if (hasChanges) {
        log.step(`Changes detected for property ${property.id}`, changes);

        const { data: favorites } = await supabase
          .from('favorites')
          .select(`user_id, profiles!inner(email, full_name, subscription_status, alert_email_enabled, alert_price_drops, alert_status_changes)`)
          .eq('property_id', property.id);

        for (const favorite of favorites || []) {
          const profile = (favorite as any).profiles;
          
          if (!profile.alert_email_enabled || profile.subscription_status === 'free') {
            continue;
          }

          for (const change of changes) {
            if ((change.type === 'price_drop' && !profile.alert_price_drops) || (change.type === 'status_change' && !profile.alert_status_changes)) {
              continue;
            }

            const { data: existingAlert } = await supabase
              .from('sent_alerts')
              .select('id')
              .eq('user_id', favorite.user_id)
              .eq('property_id', property.id)
              .eq('alert_type', change.type)
              .eq('new_value', change.newValue)
              .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .maybeSingle();

            if (existingAlert) continue;

            try {
              const emailSubject = change.type === 'price_drop' 
                ? `🏠 Price Drop Alert: ${property.address}`
                : `🔔 Status Change: ${property.address}`;

              const emailBody = change.type === 'price_drop'
                ? `<h2>Great News! Price Drop Alert</h2><p>Hi ${profile.full_name || 'there'},</p><p>A property you're watching has dropped in price:</p><div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>${property.address}, ${property.city}, ${property.state}</h3><p style="font-size: 18px;"><span style="text-decoration: line-through; color: #888;">$${parseFloat(change.oldValue).toLocaleString()}</span><strong style="color: #16a34a; margin-left: 10px;">$${parseFloat(change.newValue).toLocaleString()}</strong></p><p style="color: #16a34a; font-weight: bold;">Save $${(parseFloat(change.oldValue) - parseFloat(change.newValue)).toLocaleString()}!</p></div><p style="color: #888; font-size: 12px; margin-top: 30px;">You're receiving this because you favorited this property. Manage your alert preferences in Settings.</p>`
                : `<h2>Status Update</h2><p>Hi ${profile.full_name || 'there'},</p><p>A property you're watching has changed status:</p><div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>${property.address}, ${property.city}, ${property.state}</h3><p>Status changed from <strong>${change.oldValue}</strong> to <strong>${change.newValue}</strong></p></div><p style="color: #888; font-size: 12px; margin-top: 30px;">You're receiving this because you favorited this property. Manage your alert preferences in Settings.</p>`;

              await resend.emails.send({
                from: 'HomeLens Alerts <onboarding@resend.dev>',
                to: [profile.email],
                subject: emailSubject,
                html: emailBody,
              });

              log.step(`Alert email sent for ${change.type}`);

              await supabase
                .from('sent_alerts')
                .insert({ user_id: favorite.user_id, property_id: property.id, alert_type: change.type, old_value: change.oldValue, new_value: change.newValue });

            } catch (emailError) {
              log.error('Failed to send email:', emailError);
            }
          }
        }
      }
    }

    log.step('Property alerts check completed');

    return jsonResponse({ 
      success: true, 
      message: 'Property alerts check completed',
      propertiesChecked: properties?.length || 0
    });

  } catch (error) {
    log.error('Error:', error);
    return errorResponse(getErrorMessage(error));
  }
}))(req)));
