export type SubscriptionTier = 'free' | 'premium';
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
      'Chat with a US real estate expert agent',
      'Property analysis via link — 1x per day',
      'Benefits & incentives search — 3x per day',
      'Market trends research — 3x per day',
      'Last 5 conversations saved',
      'Mortgage Calculator',
      'Buying Power Calculator',
      'HomeLens chat on any tab (Extension)',
      'Auto-detect property listings (Extension)',
      'Extension analysis — 1x per day',
    ],
    limitations: [
      'Investor Calculator',
      'AI Insights on calculators',
      'Excel workflow in chat',
      'Investment Score per property',
      'Market Comparator',
      'Chat personalization',
    ],
  },
  premium: {
    id: 'plan_premium_monthly',
    name: 'Premium',
    tier: 'premium',
    subtitle: 'Unlock full investment power',
    price: '$4.97',
    priceMonthly: 4.97,
    pricePeriod: '/mo',
    stripePriceId: 'price_1SXAIIDNPbNbmEcljT5VEjT8',
    stripeProductId: 'prod_TU8ZtwtkutHhh5',
    ctaLabel: 'Upgrade to Premium',
    ctaVariant: 'default',
    headerNote: 'Cancel anytime',
    features: [
      'Chat personalized to your preferences',
      'Unlimited property analysis via link',
      'Unlimited benefits & incentives search',
      'Unlimited market trends research',
      'Full conversation history',
      'Generate Excel workflows in chat',
      'Market Comparator for investing',
      'Investment Score per property',
      'Investment Score via extension',
      'Investor Calculator — Simple & Advanced',
      'AI Insights on calculators',
      'Unlimited extension analysis',
      'Priority support',
    ],
  },
};

export const PREMIUM_ANNUAL_PLAN: SubscriptionPlan = {
  id: 'plan_premium_annual',
  name: 'Premium',
  tier: 'premium',
  subtitle: 'Unlock full investment power',
  price: '$4.48',
  priceMonthly: 4.48,
  pricePeriod: '/mo',
  stripePriceId: 'price_annual_placeholder', // Replace with actual Stripe price ID
  stripeProductId: 'prod_TU8ZtwtkutHhh5',
  ctaLabel: 'Upgrade to Premium',
  ctaVariant: 'default',
  headerNote: 'Billed annually ($53.70/year)',
  features: [
    'Chat personalized to your preferences',
    'Unlimited property analysis via link',
    'Unlimited benefits & incentives search',
    'Unlimited market trends research',
    'Full conversation history',
    'Generate Excel workflows in chat',
    'Market Comparator for investing',
    'Investment Score per property',
    'Investment Score via extension',
    'Investor Calculator — Simple & Advanced',
    'AI Insights on calculators',
    'Unlimited extension analysis',
    'Priority support',
  ],
  billingPeriod: 'annual',
  discount: 'Save 10%',
};

export const FEATURE_GATES = {
  UNLIMITED_AI_ANALYSIS: ['premium'],
  UNLIMITED_LINK_ANALYSIS: ['premium'],
  UNLIMITED_BENEFITS_SEARCH: ['premium'],
  UNLIMITED_TRENDS_SEARCH: ['premium'],
  FULL_CHAT_HISTORY: ['premium'],
  EXCEL_WORKFLOW: ['premium'],
  INVESTMENT_SCORE: ['premium'],
  MARKET_COMPARATOR: ['premium'],
  CHAT_PERSONALIZATION: ['premium'],
  INVESTOR_CALCULATOR: ['premium'],
  AI_CALCULATOR_INSIGHTS: ['premium'],
  UNLIMITED_EXTENSION_ANALYSIS: ['premium'],
  EXTENSION_INVESTMENT_SCORE: ['premium'],
  PRIORITY_SUPPORT: ['premium'],
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

export function isPremium(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'premium';
}

export function isFree(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'free' || !tier;
}