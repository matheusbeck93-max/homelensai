import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPersona, type PersonaId, type PersonaDef } from './personaRegistry';

/**
 * Lightweight hook: resolves the current authenticated user's persona def.
 * Returns `mixed` while loading or when unauthenticated.
 */
export function useCurrentPersona(): { def: PersonaDef; persona: PersonaId } {
  const [persona, setPersona] = useState<PersonaId>('mixed');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('profiles')
        .select('persona')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled) return;
      if (data?.persona) setPersona(data.persona as PersonaId);
    })();
    return () => { cancelled = true; };
  }, []);

  return { persona, def: getPersona(persona) };
}