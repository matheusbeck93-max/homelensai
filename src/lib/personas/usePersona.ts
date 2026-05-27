import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPersona, type PersonaId, type PersonaDef, blendedWeights } from './personaRegistry';

export interface PersonaState {
  loading: boolean;
  persona: PersonaId;
  secondary: PersonaId[];
  def: PersonaDef;
  weights: { toolWeights: Record<string, number>; briefCardWeights: Record<string, number> };
  refresh: () => Promise<void>;
  setPersona: (next: PersonaId, secondary?: PersonaId[]) => Promise<{ error: Error | null }>;
}

export function usePersona(userId: string | null | undefined): PersonaState {
  const [loading, setLoading] = useState(true);
  const [persona, setPersonaState] = useState<PersonaId>('mixed');
  const [secondary, setSecondary] = useState<PersonaId[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPersonaState('mixed');
      setSecondary([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('persona, persona_secondary')
      .eq('id', userId)
      .maybeSingle();
    const p = (data?.persona ?? 'mixed') as PersonaId;
    const sec = ((data?.persona_secondary ?? []) as string[]).filter((s) =>
      ['first_time_buyer', 'rental_investor', 'flipper', 'institutional', 'existing_owner'].includes(s),
    ) as PersonaId[];
    setPersonaState(p);
    setSecondary(sec);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPersona = useCallback(
    async (next: PersonaId, nextSecondary: PersonaId[] = []) => {
      if (!userId) return { error: new Error('Not authenticated') };
      const previous = persona;
      const { error } = await supabase
        .from('profiles')
        .update({
          persona: next,
          persona_secondary: nextSecondary,
          persona_set_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (!error) {
        setPersonaState(next);
        setSecondary(nextSecondary);
        // fire-and-forget telemetry
        void supabase.from('investor_persona_telemetry').insert({
          user_id: userId,
          persona: next,
          event_type:
            previous === 'mixed' && next !== 'mixed' ? 'investor_persona_set' : 'investor_persona_changed',
          payload: { from: previous, to: next, secondary: nextSecondary } as never,
        });
      }
      return { error: error ? new Error(error.message) : null };
    },
    [userId, persona],
  );

  return {
    loading,
    persona,
    secondary,
    def: getPersona(persona),
    weights: blendedWeights(persona, secondary),
    refresh,
    setPersona,
  };
}