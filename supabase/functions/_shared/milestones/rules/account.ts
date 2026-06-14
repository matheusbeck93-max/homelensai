import type { MilestoneRule, MilestoneEvent } from '../types.ts';

const ANALYSIS_TIERS = [10, 25, 50, 100, 250, 500];

export const accountRules: MilestoneRule[] = [
  {
    id: 'account.anniversary',
    category: 'account',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      const created = new Date(ctx.createdAt);
      const now = new Date();
      const years = now.getFullYear() - created.getFullYear();
      if (years < 1) return out;
      const anniversary = new Date(created);
      anniversary.setFullYear(created.getFullYear() + years);
      const days = (now.getTime() - anniversary.getTime()) / 86_400_000;
      if (days < 0 || days > 14) return out;
      out.push({
        milestoneId: `account.anniversary.${years}y`,
        subjectId: '',
        category: 'account',
        severity: years >= 3 ? 'major' : 'notable',
        headline: `${years} year${years === 1 ? '' : 's'} on HomeLens`,
        context: `You joined on ${created.toISOString().slice(0, 10)}.`,
        metadata: { years },
      });
      return out;
    },
  },
  {
    id: 'account.analyses.count',
    category: 'account',
    evaluate(ctx) {
      let tier: number | null = null;
      for (const t of ANALYSIS_TIERS) if (ctx.analysesCount >= t) tier = t;
      if (tier === null) return [];
      return [
        {
          milestoneId: `account.analyses.${tier}`,
          subjectId: '',
          category: 'account',
          severity: tier >= 100 ? 'major' : 'notable',
          headline: `${tier}+ properties analyzed`,
          context: `That's a serious search. Most buyers analyze under 25.`,
          metadata: { tier, count: ctx.analysesCount },
        },
      ];
    },
  },
];