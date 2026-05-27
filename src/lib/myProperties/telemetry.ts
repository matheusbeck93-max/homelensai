import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget telemetry for My Properties events.
 * Writes to `investor_persona_telemetry` (RLS scoped to auth.uid()).
 */
export async function trackOwnedPropertyEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return;
    await (supabase as any).from('investor_persona_telemetry').insert({
      user_id: uid,
      event_type: eventType,
      payload,
    });
  } catch {
    /* never block UX on telemetry */
  }
}