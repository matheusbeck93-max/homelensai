/**
 * Mirror of the frontend FEATURE_GATES map in src/lib/subscriptionPlans.ts.
 * Source of truth for tier-based feature access on the backend.
 *
 * Keep keys/values in sync with the frontend. If you add a feature here,
 * add it on the frontend too (and vice versa).
 */

export type SubscriptionTier = 'free' | 'buyer' | 'investor';

export const FEATURE_GATES = {
  // Buyer + Investor
  UNLIMITED_CHAT: ['buyer', 'investor'],
  UNLIMITED_PROPERTY_ANALYSIS: ['buyer', 'investor'],
  // Available on every tier — Free is capped at 3 analyses/day via
  // profiles.daily_analysis_count, paid tiers are uncapped.
  MATCH_SCORE: ['free', 'buyer', 'investor'],
  INVESTMENT_SCORE: ['free', 'buyer', 'investor'],
  PERSONALIZED_CHAT: ['buyer', 'investor'],
  UNLIMITED_HISTORY: ['buyer', 'investor'],
  SAVED_ANALYSES: ['buyer', 'investor'],
  PROPERTY_ALERTS: ['buyer', 'investor'],
  WEEKLY_PICKS: ['buyer', 'investor'],
  NEIGHBORHOOD_INSIGHTS: ['buyer', 'investor'],
  NEIGHBORHOOD_PERSONALITY: ['buyer', 'investor'],
  PROPERTY_COMPARISON: ['buyer', 'investor'],
  EXCEL_WORKFLOW: ['buyer', 'investor'],
  PDF_EXPORT: ['buyer', 'investor'],
  UNLIMITED_EXTENSION_ANALYSIS: ['buyer', 'investor'],
  VOICE_MODE: ['buyer', 'investor'],
  PRIORITY_SUPPORT: ['buyer', 'investor'],

  // Investor only
  INVESTOR_CALCULATOR: ['investor'],
  STRESS_SCENARIOS: ['investor'],
  ARM_SCENARIOS: ['investor'],
  TAX_MODELING_MFJ: ['investor'],
  INVESTMENT_PROJECTIONS: ['investor'],
  MARKET_COMPARATOR: ['investor'],
  INVESTOR_EXCEL_WORKBOOKS: ['investor'],
  INVESTOR_EMAIL_DIGESTS: ['investor'],
} as const satisfies Record<string, ReadonlyArray<SubscriptionTier>>;

export type FeatureKey = keyof typeof FEATURE_GATES;

export function hasFeatureAccess(tier: SubscriptionTier, feature: FeatureKey): boolean {
  return (FEATURE_GATES[feature] as ReadonlyArray<SubscriptionTier>).includes(tier);
}

/**
 * The minimum tier that satisfies a feature. If the feature is allowed for
 * both buyer + investor, the required tier is 'buyer'. Investor-only → 'investor'.
 */
export function requiredTierFor(feature: FeatureKey): SubscriptionTier {
  const allowed = FEATURE_GATES[feature] as ReadonlyArray<SubscriptionTier>;
  if (allowed.includes('buyer')) return 'buyer';
  if (allowed.includes('investor')) return 'investor';
  return 'investor';
}