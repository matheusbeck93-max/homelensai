import { supabase } from '@/integrations/supabase/client';
import type { PersonaId } from './personaRegistry';

export type PersonaEvent =
  | 'investor_persona_set'
  | 'investor_persona_changed'
  | 'investor_persona_starter_clicked'
  | 'investor_tool_called_by_persona'
  | 'investor_brief_card_rendered_by_persona'
  | 'investor_persona_mismatch_detected';

export async function recordPersonaEvent(
  userId: string | null | undefined,
  persona: PersonaId,
  event: PersonaEvent,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from('investor_persona_telemetry').insert({
      user_id: userId,
      persona,
      event_type: event,
      payload: payload as never,
    });
  } catch (e) {
    // best-effort
    console.warn('[persona telemetry] failed', e);
  }
}