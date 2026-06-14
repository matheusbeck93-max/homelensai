import type { MilestoneRule, MilestoneEvent, OwnedPropertySnapshot } from '../types.ts';

const APPRECIATION_TIERS_USD = [25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const APPRECIATION_TIERS_PCT = [10, 25, 50, 100];
const EQUITY_TIERS_PCT = [25, 50, 75, 100];
const PAYDOWN_TIERS_PCT = [10, 25, 50, 75, 100];

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function propertyLabel(p: OwnedPropertySnapshot): string {
  if (p.address) return p.address;
  return [p.city, p.state].filter(Boolean).join(', ') || 'Your property';
}

function appreciationDollars(p: OwnedPropertySnapshot): number | null {
  if (!p.currentValue || !p.purchasePrice) return null;
  return p.currentValue - p.purchasePrice;
}
function appreciationPercent(p: OwnedPropertySnapshot): number | null {
  if (!p.currentValue || !p.purchasePrice || p.purchasePrice <= 0) return null;
  return ((p.currentValue - p.purchasePrice) / p.purchasePrice) * 100;
}
function equityPercent(p: OwnedPropertySnapshot): number | null {
  if (!p.currentValue || p.currentValue <= 0) return null;
  const balance = p.loanCurrentBalance ?? 0;
  return ((p.currentValue - balance) / p.currentValue) * 100;
}
function paydownPercent(p: OwnedPropertySnapshot): number | null {
  if (!p.loanOriginalPrincipal || p.loanOriginalPrincipal <= 0) return null;
  const balance = p.loanCurrentBalance ?? p.loanOriginalPrincipal;
  return ((p.loanOriginalPrincipal - balance) / p.loanOriginalPrincipal) * 100;
}
function ownershipYears(p: OwnedPropertySnapshot, now = new Date()): number | null {
  if (!p.purchaseDate) return null;
  const start = new Date(p.purchaseDate);
  const ms = now.getTime() - start.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

function topTierCrossed(value: number, tiers: number[]): number | null {
  let best: number | null = null;
  for (const t of tiers) if (value >= t) best = t;
  return best;
}

export const propertyRules: MilestoneRule[] = [
  {
    id: 'property.appreciation.usd',
    category: 'property',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const p of ctx.ownedProperties) {
        const gain = appreciationDollars(p);
        if (gain === null || gain <= 0) continue;
        const tier = topTierCrossed(gain, APPRECIATION_TIERS_USD);
        if (tier === null) continue;
        out.push({
          milestoneId: `property.appreciation.usd.${tier}`,
          subjectId: p.id,
          category: 'property',
          severity: tier >= 100_000 ? 'major' : 'notable',
          headline: `${propertyLabel(p)} is up ${formatUsd(tier)}+`,
          context: `Estimated value gained since purchase: ${formatUsd(gain)}.`,
          metadata: { tier, gain, propertyId: p.id },
        });
      }
      return out;
    },
  },
  {
    id: 'property.appreciation.pct',
    category: 'property',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const p of ctx.ownedProperties) {
        const pct = appreciationPercent(p);
        if (pct === null || pct <= 0) continue;
        const tier = topTierCrossed(pct, APPRECIATION_TIERS_PCT);
        if (tier === null) continue;
        out.push({
          milestoneId: `property.appreciation.pct.${tier}`,
          subjectId: p.id,
          category: 'property',
          severity: tier >= 50 ? 'major' : 'notable',
          headline: `${propertyLabel(p)} is up ${tier}%+`,
          context: `Estimated appreciation since purchase: ${pct.toFixed(1)}%.`,
          metadata: { tier, pct, propertyId: p.id },
        });
      }
      return out;
    },
  },
  {
    id: 'property.equity.pct',
    category: 'property',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const p of ctx.ownedProperties) {
        const pct = equityPercent(p);
        if (pct === null) continue;
        const tier = topTierCrossed(pct, EQUITY_TIERS_PCT);
        if (tier === null) continue;
        out.push({
          milestoneId: `property.equity.${tier}`,
          subjectId: p.id,
          category: 'property',
          severity: tier >= 75 ? 'major' : 'notable',
          headline: `${propertyLabel(p)} crossed ${tier}% equity`,
          context: `Current estimated equity share: ${pct.toFixed(1)}%.`,
          metadata: { tier, pct, propertyId: p.id },
        });
      }
      return out;
    },
  },
  {
    id: 'property.paydown.pct',
    category: 'property',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      for (const p of ctx.ownedProperties) {
        const pct = paydownPercent(p);
        if (pct === null) continue;
        const tier = topTierCrossed(pct, PAYDOWN_TIERS_PCT);
        if (tier === null) continue;
        out.push({
          milestoneId: `property.paydown.${tier}`,
          subjectId: p.id,
          category: 'property',
          severity: tier >= 50 ? 'major' : 'notable',
          headline: `${tier}% of your loan is paid down`,
          context: `${propertyLabel(p)} — principal paid: ${pct.toFixed(1)}%.`,
          metadata: { tier, pct, propertyId: p.id },
        });
      }
      return out;
    },
  },
  {
    id: 'property.ownership.anniversary',
    category: 'property',
    evaluate(ctx) {
      const out: MilestoneEvent[] = [];
      const now = new Date();
      for (const p of ctx.ownedProperties) {
        const yrs = ownershipYears(p, now);
        if (yrs === null) continue;
        const whole = Math.floor(yrs);
        if (whole < 1) continue;
        // Fire within first 14 days of the anniversary window.
        const start = new Date(p.purchaseDate!);
        const anniversaryThisYear = new Date(start);
        anniversaryThisYear.setFullYear(start.getFullYear() + whole);
        const days = (now.getTime() - anniversaryThisYear.getTime()) / 86_400_000;
        if (days < 0 || days > 14) continue;
        out.push({
          milestoneId: `property.anniversary.${whole}y`,
          subjectId: p.id,
          category: 'property',
          severity: whole >= 5 ? 'major' : 'notable',
          headline: `${whole}-year anniversary: ${propertyLabel(p)}`,
          context: `You closed on ${start.toISOString().slice(0, 10)}.`,
          metadata: { years: whole, propertyId: p.id },
        });
      }
      return out;
    },
  },
];