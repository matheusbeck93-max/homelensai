import type { MilestoneRule, MilestoneEvent } from '../types.ts';

export const marketRules: MilestoneRule[] = [
  {
    id: 'market.appreciation.high',
    category: 'market',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const m of ctx.marketStats) {
        const yoy = m.appreciationYoy;
        if (yoy === null || yoy < 5) continue;
        const tier = yoy >= 15 ? 15 : yoy >= 10 ? 10 : 5;
        const cityKey = `${m.city}-${m.state ?? ''}`.toLowerCase().replace(/\s+/g, '-');
        out.push({
          milestoneId: `market.appreciation.${tier}.${cityKey}`,
          subjectId: cityKey,
          category: 'market',
          severity: tier >= 10 ? 'notable' : 'minor',
          headline: `${m.city} is up ${yoy.toFixed(1)}% YoY`,
          context: `One of your watched markets crossed ${tier}% annual appreciation.`,
          metadata: { city: m.city, state: m.state, yoy, tier },
        });
      }
      return out;
    },
  },
];