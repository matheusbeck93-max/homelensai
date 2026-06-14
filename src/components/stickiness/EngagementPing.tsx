import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStickiness } from '@/hooks/useStickiness';

const SENT_KEY = 'homelens.engagement.appOpen';

/**
 * Fires a single `app_open` engagement event per UTC day for the signed-in
 * user. Mounted once at the app shell level — has no UI.
 */
export function EngagementPing() {
  const { recordEngagement, refresh } = useStickiness();
  const fired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const tryPing = async () => {
      if (fired.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;
      const today = new Date().toISOString().slice(0, 10);
      const key = `${SENT_KEY}.${data.session.user.id}.${today}`;
      if (localStorage.getItem(key)) {
        fired.current = true;
        return;
      }
      fired.current = true;
      try {
        const res = await recordEngagement('app_open');
        if (!cancelled && res) {
          localStorage.setItem(key, '1');
          // Pull any newly-detected milestones into the banner.
          if (res.crossed_tier) setTimeout(refresh, 1200);
        }
      } catch {
        fired.current = false;
      }
    };
    tryPing();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fired.current = false;
        tryPing();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [recordEngagement, refresh]);

  return null;
}