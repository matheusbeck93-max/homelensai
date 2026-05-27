import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OwnedProperty, PortfolioRollup } from '@/lib/myProperties/types';
import {
  computeEquity,
  computeAppreciation,
  computeMonthlyCashFlow,
  computeCapRate,
  type RentalDetail,
} from '@/lib/myProperties/computeMetrics';

export interface OwnedPropertyWithMetrics extends OwnedProperty {
  rental: RentalDetail | null;
  metrics: {
    currentValue: number;
    equity: number;
    equityPct: number;
    monthlyCashFlow: number;
    capRate: number | null;
    appreciation: number;
    appreciationPct: number;
    activeAlertsCount: number;
  };
}

export function useOwnedProperties() {
  const [properties, setProperties] = useState<OwnedPropertyWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }

    const { data: props, error: propsErr } = await (supabase as any)
      .from('investor_owned_properties')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (propsErr) {
      setError(propsErr.message);
      setLoading(false);
      return;
    }

    const ids = (props ?? []).map((p: any) => p.id);
    const [rentalsRes, alertsRes] = await Promise.all([
      ids.length
        ? (supabase as any)
            .from('investor_owned_property_rental')
            .select('*')
            .in('property_id', ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? (supabase as any)
            .from('investor_owned_property_alerts')
            .select('property_id')
            .eq('status', 'active')
            .in('property_id', ids)
        : Promise.resolve({ data: [] }),
    ]);

    const rentalsById = new Map<string, RentalDetail>();
    (rentalsRes.data ?? []).forEach((r: any) => rentalsById.set(r.property_id, r));
    const alertCountById = new Map<string, number>();
    (alertsRes.data ?? []).forEach((a: any) =>
      alertCountById.set(a.property_id, (alertCountById.get(a.property_id) ?? 0) + 1),
    );

    const enriched: OwnedPropertyWithMetrics[] = (props ?? []).map((p: any) => {
      const rental = rentalsById.get(p.id) ?? null;
      const eq = computeEquity(p);
      const app = computeAppreciation(p);
      return {
        ...p,
        rental,
        metrics: {
          currentValue: eq.currentValue,
          equity: eq.equity,
          equityPct: eq.equityPct,
          monthlyCashFlow: computeMonthlyCashFlow(p, rental),
          capRate: computeCapRate(p, rental),
          appreciation: app.absolute,
          appreciationPct: app.pct,
          activeAlertsCount: alertCountById.get(p.id) ?? 0,
        },
      };
    });

    setProperties(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rollup: PortfolioRollup = useMemo(() => {
    const count = properties.length;
    const totalEquity = properties.reduce((sum, p) => sum + p.metrics.equity, 0);
    const totalMonthlyCashFlow = properties.reduce(
      (sum, p) => sum + p.metrics.monthlyCashFlow,
      0,
    );
    const totalAppreciation = properties.reduce((sum, p) => sum + p.metrics.appreciation, 0);

    // Weighted-average cap rate across rented properties (weight = current value)
    const rented = properties.filter((p) => p.metrics.capRate != null);
    const totalValue = rented.reduce((s, p) => s + p.metrics.currentValue, 0);
    const weightedAvgCapRate =
      totalValue > 0
        ? rented.reduce((s, p) => s + (p.metrics.capRate ?? 0) * p.metrics.currentValue, 0) /
          totalValue
        : null;

    // Top market share by current value
    const byMarket = new Map<string, number>();
    let portfolioValue = 0;
    properties.forEach((p) => {
      const market = `${p.city}, ${p.state}`;
      byMarket.set(market, (byMarket.get(market) ?? 0) + p.metrics.currentValue);
      portfolioValue += p.metrics.currentValue;
    });
    let topMarketShare: PortfolioRollup['topMarketShare'] = null;
    if (portfolioValue > 0 && byMarket.size > 0) {
      let topMarket = '';
      let topValue = 0;
      byMarket.forEach((v, k) => {
        if (v > topValue) {
          topValue = v;
          topMarket = k;
        }
      });
      topMarketShare = { market: topMarket, pct: topValue / portfolioValue };
    }

    return {
      count,
      totalEquity,
      totalMonthlyCashFlow,
      weightedAvgCapRate,
      totalAppreciation,
      topMarketShare,
    };
  }, [properties]);

  return { properties, rollup, loading, error, reload: load };
}

export function useOwnedPropertiesCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count: c } = await (supabase as any)
        .from('investor_owned_properties')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}