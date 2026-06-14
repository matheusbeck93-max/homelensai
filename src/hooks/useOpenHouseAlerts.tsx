import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OpenHouseAlert, OpenHouseFilters } from '@/types/openHouses';

export function useOpenHouseAlerts() {
  const [alerts, setAlerts] = useState<OpenHouseAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('open_house_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    setAlerts((data as OpenHouseAlert[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: { filters: OpenHouseFilters; frequency: 'daily' | 'weekly' }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Sign in required');
      const { error } = await supabase.from('open_house_alerts').insert({
        user_id: userData.user.id,
        country: input.filters.country,
        state: input.filters.state ?? null,
        city: input.filters.city ?? null,
        filters: {
          dateFrom: input.filters.dateFrom,
          dateTo: input.filters.dateTo,
          priceMin: input.filters.priceMin,
          priceMax: input.filters.priceMax,
        },
        frequency: input.frequency,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      const { error } = await supabase.from('open_house_alerts').update({ enabled }).eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('open_house_alerts').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { alerts, loading, refresh, create, toggle, remove };
}
