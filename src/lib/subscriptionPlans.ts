export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: string;
  priceMonthly: number;
  stripePriceId?: string;
  stripeProductId?: string;
  features: string[];
  limitations?: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'plan_free',
    name: 'Free',
    tier: 'free',
    price: '$0',
    priceMonthly: 0,
    features: [
      'Unlimited property searches',
      'Unlimited favorites',
      '3 AI property analyses per day',
      'Basic mortgage calculator',
      'Property search and filtering'
    ],
    limitations: [
      'Limited to 3 AI analyses per day',
      'No price fairness meter',
      'No property comparison',
      'No PDF exports',
      'No smart alerts'
    ]
  },
  pro: {
    id: 'plan_pro_monthly',
    name: 'Pro',
    tier: 'pro',
    price: '$4.99/mo',
    priceMonthly: 4.99,
    stripePriceId: 'price_1SXAGhDNPbNbmEcl7swPot9W',
    stripeProductId: 'prod_TU8XHaYsigHmU3',
    features: [
      'Everything in Free, plus:',
      'Unlimited AI property analyses',
      'Price Fairness Meter',
      'Property Comparison Mode (unlimited)',
      'Export PDF property reports',
      'Neighborhood Personality AI',
      'Investor view & calculators',
      'Map-based investment zones'
    ]
  },
  premium: {
    id: 'plan_premium_monthly',
    name: 'Premium',
    tier: 'premium',
    price: '$9.99/mo',
    priceMonthly: 9.99,
    stripePriceId: 'price_1SXAIIDNPbNbmEcljT5VEjT8',
    stripeProductId: 'prod_TU8ZtwtkutHhh5',
    features: [
      'Everything in Pro, plus:',
      'Portfolio builder (multi-property tracking)',
      'Deep investment projections (10-20 year)',
      'Smart Alerts & Weekly Picks',
      'Monthly Investment Snapshot reports',
      'Unlimited PDF exports',
      'Daily Deal Digest',
      'Priority AI routing',
      'Advanced market analytics',
      'Custom investment strategies'
    ]
  }
};

export const FEATURE_GATES = {
  // AI Analysis
  UNLIMITED_AI_ANALYSIS: ['pro', 'premium'],
  
  // Quick Wins Features
  PRICE_FAIRNESS_METER: ['pro', 'premium'],
  PROPERTY_COMPARISON: ['pro', 'premium'],
  EXPORT_PDF: ['pro', 'premium'],
  NEIGHBORHOOD_PERSONALITY: ['pro', 'premium'],
  
  // Investor Features
  INVESTOR_VIEW: ['pro', 'premium'],
  
  // Premium Only
  PORTFOLIO_BUILDER: ['premium'],
  DEEP_PROJECTIONS: ['premium'],
  SMART_ALERTS: ['premium'],
  PERSONALIZED_PICKS: ['premium'],
  DEAL_DIGEST: ['premium']
} as const;

export type FeatureKey = keyof typeof FEATURE_GATES;

export function hasFeatureAccess(
  userTier: SubscriptionTier | null | undefined,
  feature: FeatureKey
): boolean {
  if (!userTier) return false;
  const allowedTiers = FEATURE_GATES[feature] as readonly SubscriptionTier[];
  return allowedTiers.includes(userTier);
}

export function isProOrPremium(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'pro' || tier === 'premium';
}

export function isPremium(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'premium';
}
