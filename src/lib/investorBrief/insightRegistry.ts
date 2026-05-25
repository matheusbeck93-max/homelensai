import type { ContextSnapshot, InsightDefinition } from './types';

/**
 * Insight registry — single source of truth for what cards exist.
 *
 * Adding a new insight = adding an entry here. The composer, brief edge
 * function, and renderers all dispatch off card_type + the id stored in
 * investor_brief_cards.config.
 */

// ── cap_rate_trend ────────────────────────────────────────────────
interface CapRateTrendData {
  market: string;
  series: Array<{ month: string; capRate: number }>;
  current: number;
  target: number;
}

const capRateTrend: InsightDefinition<CapRateTrendData> = {
  id: 'cap_rate_trend',
  cardType: 'trend_chart',
  basePriority: 90,
  isEligible: (ctx) => (ctx.preferences.preferred_cities ?? []).length > 0,
  loadData: async (ctx) => {
    const market = ctx.preferences.preferred_cities?.[0] ?? 'Austin, TX';
    // Synthesized trailing-12-month series. Real wiring will hit a market
    // metrics endpoint in a follow-up.
    const base = 6.2;
    const series = Array.from({ length: 12 }, (_, i) => {
      const drift = Math.sin(i / 2) * 0.4 + i * 0.05;
      return {
        month: new Date(Date.now() - (11 - i) * 30 * 86400_000).toISOString().slice(0, 7),
        capRate: Number((base + drift).toFixed(2)),
      };
    });
    const current = series[series.length - 1].capRate;
    return { market, series, current, target: 7.0 };
  },
  title: (_ctx, d) => `Median cap rate — ${d.market}`,
  subtitle: (_ctx, d) => `Now ${d.current.toFixed(2)}% · target ${d.target.toFixed(2)}%`,
  toBriefSummary: (d) =>
    `${d.market} median cap rate is ${d.current.toFixed(2)}% over the trailing 12 months (target ${d.target.toFixed(2)}%).`,
  investigatePrompt: (d) =>
    `Walk me through what's driving the cap-rate trend in ${d.market} right now and which of my memorized properties benefit most.`,
};

// ── watchlist_price_trend ─────────────────────────────────────────
interface WatchlistData {
  count: number;
  cities: string[];
}

const watchlistPriceTrend: InsightDefinition<WatchlistData> = {
  id: 'watchlist_price_trend',
  cardType: 'ranked_list',
  basePriority: 80,
  isEligible: (ctx) => ctx.savedProperties.length >= 1,
  loadData: async (ctx) => {
    const cities = Array.from(
      new Set(
        ctx.savedProperties
          .map((p) => [p.city, p.state].filter(Boolean).join(', '))
          .filter((s) => s.length > 0),
      ),
    );
    return { count: ctx.savedProperties.length, cities };
  },
  title: (_ctx, d) => `Your watchlist · ${d.count} ${d.count === 1 ? 'property' : 'properties'}`,
  subtitle: (_ctx, d) =>
    d.cities.length > 0 ? `Across ${d.cities.slice(0, 3).join(' · ')}` : 'No city tags yet',
  toBriefSummary: (d) =>
    `Watchlist has ${d.count} saved ${d.count === 1 ? 'property' : 'properties'}${
      d.cities.length > 0 ? ` across ${d.cities.slice(0, 3).join(', ')}` : ''
    }.`,
  investigatePrompt: () =>
    'Summarize my saved-properties watchlist: which look strongest right now and where should I focus?',
};

// ── price_reduction_heatmap ───────────────────────────────────────
interface HeatmapData {
  market: string;
  rows: string[]; // ZIP codes
  cols: string[]; // week labels
  values: number[][]; // intensities 0..1
}

const priceReductionHeatmap: InsightDefinition<HeatmapData> = {
  id: 'price_reduction_heatmap',
  cardType: 'heatmap',
  basePriority: 70,
  isEligible: (ctx) => (ctx.preferences.preferred_cities ?? []).length > 0,
  loadData: async (ctx) => {
    const market = ctx.preferences.preferred_cities?.[0] ?? 'Austin, TX';
    const rows = ['78704', '78745', '78702', '78751', '78723'];
    const cols = ['W-4', 'W-3', 'W-2', 'W-1', 'This wk'];
    const values = rows.map((_, r) =>
      cols.map((_c, c) => Number((Math.abs(Math.sin((r + 1) * (c + 1))) ).toFixed(2))),
    );
    return { market, rows, cols, values };
  },
  title: (_ctx, d) => `Price-reduction hot zones — ${d.market}`,
  toBriefSummary: (d) =>
    `Last 5 weeks of price-reduction intensity across ${d.rows.length} ZIPs in ${d.market}.`,
  investigatePrompt: (d) =>
    `Which ZIPs in ${d.market} have the most active price reductions, and what's the typical % cut?`,
};

// ── top_matches_today / ranked_list of saved analyses ─────────────
interface RankedAnalysesData {
  rows: Array<{ address: string; score: number | null; price: number | null }>;
}

const rankedAnalyses: InsightDefinition<RankedAnalysesData> = {
  id: 'ranked_analyses',
  cardType: 'ranked_list',
  basePriority: 75,
  isEligible: (ctx) => ctx.savedAnalyses.length >= 1,
  loadData: async (ctx) => {
    const rows = ctx.savedAnalyses
      .slice(0, 25)
      .map((a) => ({
        address: a.property_address ?? 'Untitled',
        score: a.investment_score,
        price: a.property_price,
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .slice(0, 5);
    return { rows };
  },
  title: () => 'Top scored analyses',
  subtitle: (_ctx, d) => `${d.rows.length} of your saved analyses`,
  toBriefSummary: (d) => {
    const top = d.rows[0];
    if (!top) return 'No saved analyses yet.';
    return `Highest-scoring saved analysis: ${top.address}${
      top.score != null ? ` (${top.score}/100)` : ''
    }.`;
  },
  investigatePrompt: () =>
    'Compare my top-scoring saved analyses and tell me which one looks like the best buy right now.',
};

// ── missing_data ──────────────────────────────────────────────────
interface MissingDataData {
  rows: Array<{ id: string; address: string; missing: string[] }>;
}

const missingData: InsightDefinition<MissingDataData> = {
  id: 'missing_data',
  cardType: 'missing_data',
  basePriority: 60,
  isEligible: (ctx) =>
    ctx.savedAnalyses.some((a) => {
      const m = a.key_metrics ?? {};
      return (
        m.insurance == null ||
        m.property_tax == null ||
        m.vacancy == null ||
        Object.keys(m).length === 0
      );
    }),
  loadData: async (ctx) => {
    const rows = ctx.savedAnalyses
      .map((a) => {
        const m = a.key_metrics ?? {};
        const missing: string[] = [];
        if (m.insurance == null) missing.push('insurance');
        if (m.property_tax == null) missing.push('property tax');
        if (m.vacancy == null) missing.push('vacancy');
        return missing.length > 0
          ? { id: a.id, address: a.property_address ?? 'Untitled', missing }
          : null;
      })
      .filter((r): r is { id: string; address: string; missing: string[] } => r !== null)
      .slice(0, 5);
    return { rows };
  },
  title: (_ctx, d) =>
    d.rows.length === 1
      ? `${d.rows[0].address} is missing inputs`
      : `${d.rows.length} analyses are missing inputs`,
  toBriefSummary: (d) => {
    if (d.rows.length === 0) return 'No analyses are missing required inputs.';
    const sample = d.rows[0];
    return `${d.rows.length} saved analysis row${
      d.rows.length === 1 ? '' : 's'
    } missing assumptions (e.g., ${sample.address}: ${sample.missing.join(', ')}).`;
  },
  investigatePrompt: () =>
    'Walk me through the missing inputs on my saved analyses and suggest reasonable defaults for each.',
};

// ── setup / sample (cold-start) ───────────────────────────────────
const setupCard: InsightDefinition<{ stepsRemaining: number }> = {
  id: 'setup',
  cardType: 'setup',
  basePriority: 1000, // always tops cold-start
  isEligible: (ctx) =>
    (ctx.preferences.preferred_cities ?? []).length === 0 &&
    ctx.savedProperties.length === 0 &&
    ctx.savedAnalyses.length === 0,
  loadData: async (ctx) => {
    let n = 0;
    if ((ctx.preferences.preferred_cities ?? []).length === 0) n++;
    if (ctx.savedProperties.length === 0) n++;
    if (ctx.savedAnalyses.length === 0) n++;
    return { stepsRemaining: n };
  },
  title: () => 'Set up your brief',
  subtitle: (_ctx, d) => `${d.stepsRemaining} quick steps to start receiving daily insights`,
  toBriefSummary: (d) =>
    `Setup card: user has ${d.stepsRemaining} onboarding steps remaining (preferences, watchlist, first analysis).`,
  investigatePrompt: () => 'Help me set up my Investor Brief — what should I do first?',
};

const sampleCard: InsightDefinition<{ market: string }> = {
  id: 'sample',
  cardType: 'sample',
  basePriority: 999,
  isEligible: (ctx) =>
    (ctx.preferences.preferred_cities ?? []).length === 0 &&
    ctx.savedProperties.length === 0 &&
    ctx.savedAnalyses.length === 0,
  loadData: async () => ({ market: 'Austin, TX' }),
  title: () => 'Sample insight',
  subtitle: () => 'This is what a real card looks like',
  toBriefSummary: (d) =>
    `Sample card showing the user what a real ${d.market} insight will look like.`,
  investigatePrompt: () => 'Show me a sample of what a daily Investor Brief contains.',
};

export const insightRegistry: InsightDefinition<any>[] = [
  setupCard,
  sampleCard,
  capRateTrend,
  watchlistPriceTrend,
  rankedAnalyses,
  missingData,
  priceReductionHeatmap,
];

export function getDefinition(id: string): InsightDefinition<any> | undefined {
  return insightRegistry.find((d) => d.id === id);
}

export function adjustPriority(
  def: InsightDefinition<any>,
  ctx: ContextSnapshot,
  feedback: import('./types').FeedbackSignal[],
): number {
  if (def.scorePriority) return def.scorePriority(ctx, feedback);
  // Bayesian-ish nudge: thumbs-up boosts, thumbs-down/dismissed demotes.
  const recent = feedback.filter((f) => f.card_type === def.cardType);
  const up = recent.filter((f) => f.signal === 'up' || f.signal === 'investigated' || f.signal === 'pinned').length;
  const down = recent.filter((f) => f.signal === 'down' || f.signal === 'dismissed').length;
  const total = up + down;
  if (total === 0) return def.basePriority;
  const ratio = (up + 1) / (total + 2); // Laplace smoothing
  return def.basePriority + Math.round((ratio - 0.5) * 40);
}