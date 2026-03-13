export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: string;
  priceMonthly: number;
  stripePriceId?: string;
  stripeProductId?: string;
  features: {
    chatAndAI: string[];
    calculators: string[];
    chromeExtension: string[];
    support?: string[];
  };
  limitations?: string[];
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'plan_free',
    name: 'Free',
    tier: 'free',
    price: '$0/mês',
    priceMonthly: 0,
    features: {
      chatAndAI: [
        'Chat com agente especialista em real estate EUA',
        'Análise de imóvel via link — 1x por dia',
        'Pesquisa de benefícios e incentivos — 3x por dia',
        'Pesquisa de tendências de mercado — 3x por dia',
        'Histórico das últimas 5 conversas'
      ],
      calculators: [
        'Calculadora Mortgage',
        'Calculadora Buying Power'
      ],
      chromeExtension: [
        'Chat HomeLens em qualquer aba',
        'Detecção automática de listagens',
        'Análise via extensão — 1x por dia'
      ]
    },
    limitations: [
      'Sem calculadora Investor',
      'Sem AI Insights nas calculadoras',
      'Sem Excel workflow no chat',
      'Sem Investment Score por imóvel',
      'Sem Comparador de Mercados',
      'Sem personalização do chat'
    ]
  },
  premium: {
    id: 'plan_premium_monthly',
    name: 'Premium',
    tier: 'premium',
    price: '$4.97/mês',
    priceMonthly: 4.97,
    stripePriceId: 'price_1SXAIIDNPbNbmEcljT5VEjT8',
    stripeProductId: 'prod_TU8ZtwtkutHhh5',
    features: {
      chatAndAI: [
        'Análise de imóvel via link — ilimitado',
        'Pesquisa de benefícios — ilimitado',
        'Pesquisa de tendências — ilimitado',
        'Histórico completo de conversas',
        'Geração de workflows Excel no chat',
        'Investment Score por imóvel',
        'Comparador de Mercados para investimento',
        'Personalização do chat com preferências do usuário'
      ],
      calculators: [
        'Todas as calculadoras do Free',
        'Calculadora Investor — Modo Simple e Advanced',
        'AI Insights nas calculadoras'
      ],
      chromeExtension: [
        'Todas as features da extensão do Free',
        'Análise ilimitada via extensão',
        'Investment Score via extensão'
      ],
      support: [
        'Suporte prioritário'
      ]
    }
  }
};

export const FEATURE_GATES = {
  // AI Analysis - Premium only
  UNLIMITED_AI_ANALYSIS: ['premium'],
  UNLIMITED_LINK_ANALYSIS: ['premium'],
  UNLIMITED_BENEFITS_SEARCH: ['premium'],
  UNLIMITED_TRENDS_SEARCH: ['premium'],
  FULL_CHAT_HISTORY: ['premium'],
  EXCEL_WORKFLOW: ['premium'],
  INVESTMENT_SCORE: ['premium'],
  MARKET_COMPARATOR: ['premium'],
  CHAT_PERSONALIZATION: ['premium'],
  
  // Calculators - Premium only
  INVESTOR_CALCULATOR: ['premium'],
  AI_CALCULATOR_INSIGHTS: ['premium'],
  
  // Chrome Extension - Premium only
  UNLIMITED_EXTENSION_ANALYSIS: ['premium'],
  EXTENSION_INVESTMENT_SCORE: ['premium'],
  
  // Support - Premium only
  PRIORITY_SUPPORT: ['premium']
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
