import { useMemo } from 'react';
import { BarChart3, Target, Building2, Zap } from 'lucide-react';
import { useSavedAnalyses } from '@/hooks/useSavedAnalyses';
import { BriefKpiTile } from './BriefKpiTile';

function formatMoney(n: number | null | undefined): string | null {
  if (n == null || !isFinite(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function extractCity(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  // Prefer "City, ST" pattern
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || null;
}

export function BriefKpiRow() {
  const { analyses, loading } = useSavedAnalyses();

  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonth = analyses.filter((a) => new Date(a.created_at) >= monthStart);
    const lastMonth = analyses.filter((a) => {
      const d = new Date(a.created_at);
      return d >= lastMonthStart && d < monthStart;
    });

    const scored = analyses.filter(
      (a) => typeof a.investment_score === 'number' && !isNaN(a.investment_score as number),
    );
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, a) => s + (a.investment_score as number), 0) / scored.length)
      : null;
    const avgLabel =
      avgScore == null
        ? null
        : avgScore >= 80
          ? 'Exceptional'
          : avgScore >= 65
            ? 'Good Investment'
            : avgScore >= 50
              ? 'Fair'
              : 'Below target';

    const cities = new Set<string>();
    analyses.forEach((a) => {
      const c = extractCity(a.property_address);
      if (c) cities.add(c);
    });
    const cityList = Array.from(cities);

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    const thisWeekCities = new Set<string>();
    analyses
      .filter((a) => new Date(a.created_at) >= thisWeekStart)
      .forEach((a) => {
        const c = extractCity(a.property_address);
        if (c) thisWeekCities.add(c);
      });

    const top = scored.reduce<null | typeof scored[number]>(
      (best, a) =>
        !best || (a.investment_score as number) > (best.investment_score as number) ? a : best,
      null,
    );

    return {
      thisMonthCount: thisMonth.length,
      savedCount: analyses.length,
      diff: thisMonth.length - lastMonth.length,
      avgScore,
      avgLabel,
      scoredCount: scored.length,
      cityCount: cityList.length,
      cityPreview: cityList.slice(0, 3).join(' · '),
      thisWeekCityCount: thisWeekCities.size,
      top,
    };
  }, [analyses]);

  const dash = '—';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <BriefKpiTile
        label="Analyses this month"
        value={loading ? dash : String(metrics.thisMonthCount)}
        context={loading ? undefined : `${metrics.savedCount} saved`}
        trend={
          !loading && metrics.diff !== 0
            ? `${metrics.diff > 0 ? '↗' : '↘'} ${metrics.diff > 0 ? '+' : ''}${metrics.diff} vs last month`
            : undefined
        }
        accent="blue"
        icon={BarChart3}
      />
      <BriefKpiTile
        label="Avg investment score"
        value={loading || metrics.avgScore == null ? dash : String(metrics.avgScore)}
        context={loading ? undefined : 'across saved analyses'}
        trend={metrics.avgLabel ? `↗ ${metrics.avgLabel}` : undefined}
        accent="green"
        icon={Target}
      />
      <BriefKpiTile
        label="Markets compared"
        value={loading ? dash : String(metrics.cityCount)}
        context={loading ? undefined : metrics.cityPreview || 'Save an analysis to begin'}
        trend={
          !loading && metrics.thisWeekCityCount > 0
            ? `↗ ${metrics.thisWeekCityCount} this week`
            : undefined
        }
        accent="purple"
        icon={Building2}
      />
      <BriefKpiTile
        label="Top score found"
        value={loading || !metrics.top ? dash : String(metrics.top.investment_score)}
        context={
          loading || !metrics.top
            ? undefined
            : [
                extractCity(metrics.top.property_address) || metrics.top.property_address || 'Property',
                formatMoney(metrics.top.property_price),
              ]
                .filter(Boolean)
                .join(' · ')
        }
        trend={
          metrics.top?.score_label
            ? `↗ ${metrics.top.score_label}`
            : metrics.top && (metrics.top.investment_score as number) >= 80
              ? '↗ Exceptional Investment'
              : undefined
        }
        accent="amber"
        icon={Zap}
      />
    </div>
  );
}