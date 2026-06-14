import type { MilestoneRule, MilestoneEvent } from '../types.ts';

const PRICE_DROP_TIERS_PCT = [5, 10, 15, 25];

export const savedRules: MilestoneRule[] = [
  {
    id: 'saved.price.drop',
    category: 'saved',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const s of ctx.savedProperties) {
        if (!s.listPrice || !s.lastSeenPrice || s.lastSeenPrice <= 0) continue;
        const dropPct = ((s.lastSeenPrice - s.listPrice) / s.lastSeenPrice) * 100;
        if (dropPct <= 0) continue;
        let tier: number | null = null;
        for (const t of PRICE_DROP_TIERS_PCT) if (dropPct >= t) tier = t;
        if (tier === null) continue;
        const label = s.address ?? [s.city, s.state].filter(Boolean).join(', ') ?? 'A saved home';
        out.push({
          milestoneId: `saved.price.drop.${tier}`,
          subjectId: s.id,
          category: 'saved',
          severity: tier >= 15 ? 'major' : 'notable',
          headline: `Price drop on ${label}`,
          context: `Down ${dropPct.toFixed(1)}% since you saved it.`,
          metadata: { tier, dropPct, savedId: s.id },
        });
      }
      return out;
    },
  },
];