export type SubscriptionTier = 'free' | 'buyer' | 'investor';
export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  subtitle: string;
  price: string;
  priceMonthly: number;
  pricePeriod?: string;
  stripePriceId?: string;
  stripeProductId?: string;
  ctaLabel: string;
  ctaVariant: 'outline' | 'default';
  headerNote?: string;
  features: string[];
  limitations?: string[];
  billingPeriod?: BillingPeriod;
  discount?: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'plan_free',
    name: 'Free',
    tier: 'free',
    subtitle: 'Get started with HomeLens',
    price: '$0',
    priceMonthly: 0,
    ctaLabel: 'Use HomeLens for free',
    ctaVariant: 'outline',
    headerNote: 'No credit card required',
    features: [
      'Chat with a US real estate expert agent — limited',
      'Property analysis via link — 3x per day',
      'Last 5 conversations saved',
      'Mortgage Calculator',
      'Buying Power Calculator',
      'HomeLens chat on any tab (Google Extension)',
      'Auto-detect property listings (Google Extension)',
      'Google Extension analysis — 3x per day',
    ],
    limitations: [
      'Match Score & Investment Score',
      'Saved analyses & full chat history',
      'Property alerts & weekly picks',
      'Neighborhood Insights & Personality',
      'Property comparison & PDF export',
      'Excel workflow in chat',
      'Voice mode (text-to-speech)',
      'Investor Calculator & Market Comparator',
      'Portfolio tracking',
    ],
  },
  buyer: {
    id: 'plan_buyer_monthly',
    name: 'Buyer',
    tier: 'buyer',
    subtitle: 'For homebuyers ready to make smart offers',
    price: '$9.97',
    priceMonthly: 9.97,
    pricePeriod: '/mo',
    stripePriceId: 'price_1TSMm0PfVIpcDpxSMzUCGAvN',
    stripeProductId: 'prod_URFGRoGQyqiWSq',
    ctaLabel: 'Upgrade to Buyer',
    ctaVariant: 'default',
    headerNote: 'Cancel anytime',
    features: [
      'Unlimited chat with a US real estate expert agent',
      'Personalized chat (uses your profile)',
      'Unlimited property analysis via link',
      'Match Score & Investment Score',
      'Full conversation history',
      'Saved analyses (app + Chrome extension)',
      'Property alerts & weekly picks',
      'Neighborhood Insights & Personality',
      'Property comparison',
      'Excel workflow in chat',
      'PDF property reports',
      'Voice mode (text-to-speech)',
      'Mortgage Calculator',
      'Buying Power Calculator',
      'Unlimited Google Extension analysis',
    ],
  },
  investor: {
    id: 'plan_investor_monthly',
    name: 'Investor',
    tier: 'investor',
    subtitle: 'For rental-property investors',
    price: '$24.97',
    priceMonthly: 24.97,
    pricePeriod: '/mo',
    stripePriceId: 'price_1TZt4aPfVIpcDpxShMu0UEwn',
    stripeProductId: 'prod_UZ16G46hQlRRVD',
    ctaLabel: 'Upgrade to Investor',
    ctaVariant: 'default',
    headerNote: 'Everything in Buyer + investor tools',
    features: [
      'Everything in Buyer',
      'Investor Calculator — Simple & Advanced',
      'Stress scenarios (Bear / Base / Bull)',
      'ARM scenario modeling',
      'Tax modeling with MFJ filing & LTCG',
      '20-year Investment Projections with IRR',
      'Market Comparator (multi-market)',
      'Portfolio tracking',
      'Investor-grade Excel workbooks',
      'Investor email digests',
      'Priority API limits (2,000 credits/day)',
      'Priority support',
    ],
  },
};

export const BUYER_ANNUAL_PLAN: SubscriptionPlan = {
  id: 'plan_buyer_annual',
  name: 'Buyer',
  tier: 'buyer',
  subtitle: 'For homebuyers ready to make smart offers',
  price: '$7.97',
  priceMonthly: 7.97,
  pricePeriod: '/mo',
  stripePriceId: 'price_1TSMm1PfVIpcDpxSFmwVN4Ip',
  stripeProductId: 'prod_URFGwmCiEV7RY9',
  ctaLabel: 'Upgrade to Buyer',
  ctaVariant: 'default',
  headerNote: 'Billed annually ($95.64/year)',
  features: [
    'Unlimited chat with a US real estate expert agent',
    'Personalized chat (uses your profile)',
    'Unlimited property analysis via link',
    'Match Score & Investment Score',
    'Full conversation history',
    'Saved analyses (app + Chrome extension)',
    'Property alerts & weekly picks',
    'Neighborhood Insights & Personality',
    'Property comparison',
    'Excel workflow in chat',
    'PDF property reports',
    'Voice mode (text-to-speech)',
    'Mortgage Calculator',
    'Buying Power Calculator',
    'Unlimited Google Extension analysis',
  ],
  billingPeriod: 'annual',
  discount: 'Save 20%',
};

export const INVESTOR_ANNUAL_PLAN: SubscriptionPlan = {
  id: 'plan_investor_annual',
  name: 'Investor',
  tier: 'investor',
  subtitle: 'For rental-property investors',
  price: '$19.97',
  priceMonthly: 19.97,
  pricePeriod: '/mo',
  stripePriceId: 'price_1TZt4uPfVIpcDpxSgnUotVmn',
  stripeProductId: 'prod_UZ17Q3M67mTUP4',
  ctaLabel: 'Upgrade to Investor',
  ctaVariant: 'default',
  headerNote: 'Billed annually ($239.71/year)',
  features: [
    'Everything in Buyer',
    'Investor Calculator — Simple & Advanced',
    'Stress scenarios (Bear / Base / Bull)',
    'ARM scenario modeling',
    'Tax modeling with MFJ filing & LTCG',
    '20-year Investment Projections with IRR',
    'Market Comparator (multi-market)',
    'Portfolio tracking',
    'Investor-grade Excel workbooks',
    'Investor email digests',
    'Priority API limits (2,000 credits/day)',
    'Priority support',
  ],
  billingPeriod: 'annual',
  discount: 'Save 20%',
};

/**
 * Feature access matrix. Each FeatureKey lists the tiers that have access.
 * Source of truth for every gate in the app.
 *
 * Buyer = home-buyer features (Match Score, alerts, history, neighborhood, etc.)
 * Investor = Buyer + rental-property tools (Investor Calc, Market Comparator,
 *            Portfolio, MFJ tax modeling, etc.)
 */
export const FEATURE_GATES = {
  // Buyer + Investor
  UNLIMITED_CHAT: ['buyer', 'investor'],
  UNLIMITED_PROPERTY_ANALYSIS: ['buyer', 'investor'],
  MATCH_SCORE: ['buyer', 'investor'],
  INVESTMENT_SCORE: ['buyer', 'investor'],
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
  PORTFOLIO_TRACKING: ['investor'],
  INVESTOR_EXCEL_WORKBOOKS: ['investor'],
  INVESTOR_EMAIL_DIGESTS: ['investor'],
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

export function isFree(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'free' || !tier;
}

/** Any paid tier (Buyer or Investor). */
export function isPaid(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'buyer' || tier === 'investor';
}

export function isBuyer(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'buyer';
}

export function isInvestor(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'investor';
}

/**
 * @deprecated Use isPaid() or hasFeatureAccess() instead. Kept for backward
 * compatibility during the 2-tier → 3-tier migration. Returns true for any
 * paid tier (Buyer or Investor).
 */
export function isPremium(tier: SubscriptionTier | null | undefined): boolean {
  return isPaid(tier);
}

/** Display label for a tier. */
export function tierDisplayName(tier: SubscriptionTier | null | undefined): string {
  if (tier === 'buyer') return 'Buyer';
  if (tier === 'investor') return 'Investor';
  return 'Free';
}