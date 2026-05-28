import type { CardType } from './types';

/**
 * Default starter follow-up prompts shown in the Deep Dive panel,
 * keyed by card type. Per-insight overrides can be added later via an
 * optional `deepDiveStarterPrompts` field on InsightDefinition.
 */
export function defaultDeepDiveStarters(cardType: CardType, title: string): string[] {
  switch (cardType) {
    case 'trend_chart':
      return [
        'Which ZIPs are driving this trend?',
        'How do my saved properties benefit from this?',
        'Project this 6 months out.',
      ];
    case 'budget_affordability':
      return [
        'Show me listings within my budget that hit my cap rate target.',
        'What if I raised my budget by 20%?',
        'Compare my budget against neighboring markets I haven\'t picked.',
      ];
    case 'heatmap':
      return [
        'Show me the hottest ZIP with affordable matches.',
        'Are any of my saved properties in this zone?',
        'What\'s driving the cluster?',
      ];
    case 'ranked_list':
      return [
        'Why is the top item ranked highest?',
        'How do my saved properties compare to this list?',
        'Show me the next 5 below the cutoff.',
      ];
    case 'portfolio_glance':
      return [
        'Walk me through what\'s working and what\'s not.',
        'Which property has the strongest return?',
        'Where am I over-concentrated?',
      ];
    case 'portfolio_alerts':
      return [
        'Run a deeper analysis on the top alert.',
        'Show me all active alerts ranked by impact.',
        'Which alert should I act on first?',
      ];
    case 'missing_data':
      return [
        'Fix this for me — fill in reasonable defaults and recompute.',
        'Show me the impact of the missing field on returns.',
        'Which other analyses have the same gap?',
      ];
    case 'neighborhood_scores':
      return [
        'Which neighborhood scores best for my persona?',
        'How do schools and crime weigh into this?',
        'Compare top 2 side-by-side.',
      ];
    case 'flip_spread_movers':
      return [
        'Which ZIP has the widest spread right now?',
        'Show me listings that fit a flip in the top ZIP.',
        'What\'s the typical rehab budget here?',
      ];
    case 'migration_trends':
      return [
        'Where are people moving from?',
        'How does this affect rents in my target markets?',
        'Project net migration 12 months out.',
      ];
    case 'anomaly':
      return [
        'What\'s causing this anomaly?',
        'Is this a buying signal or noise?',
        'Show me comps that confirm or reject it.',
      ];
    default:
      return [
        `Tell me more about ${title}.`,
        'Compare this to my portfolio.',
        'Project this forward.',
      ];
  }
}
