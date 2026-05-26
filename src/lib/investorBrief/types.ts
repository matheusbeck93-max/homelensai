export type CardType =
  | 'trend_chart'
  | 'heatmap'
  | 'ranked_list'
  | 'anomaly'
  | 'missing_data'
  | 'note'
  | 'setup'
  | 'sample'
  | 'buying_power'
  | 'neighborhood_scores'
  | 'flip_spread_movers'
  | 'migration_trends';

export type InsightSeverity = 'info' | 'opportunity' | 'warning';

export interface ContextSnapshot {
  preferences: {
    primary_goal?: string | null;
    preferred_cities?: string[] | null;
    max_price_range?: number | null;
    min_bedrooms?: number | null;
    about_me?: string | null;
    brief_card_count?: number | null;
    cash_available?: number | null;
    financing_defaults?: {
      downPct?: number;
      rateApr?: number;
      termYears?: number;
    } | null;
    persona?: string | null;
    persona_secondary?: string[] | null;
  };
  savedProperties: Array<{
    id: string;
    property_address: string;
    property_url: string;
    city?: string | null;
    state?: string | null;
    created_at: string;
  }>;
  savedAnalyses: Array<{
    id: string;
    property_address: string | null;
    property_price: number | null;
    investment_score: number | null;
    key_metrics: Record<string, any> | null;
    created_at: string;
  }>;
  pinnedTalkingPoints: Array<{
    id: string;
    text: string;
    source_card_type: string | null;
    pinned_at: string;
  }>;
}

export interface FeedbackSignal {
  card_type: string;
  signal: 'up' | 'down' | 'investigated' | 'copied' | 'pinned' | 'dismissed';
  created_at: string;
}

export interface ComposedCard<TData = unknown> {
  id: string; // registry id, e.g. 'cap_rate_trend' (replaced by DB id after persistence)
  cardType: CardType;
  title: string;
  subtitle?: string;
  data: TData;
  config: Record<string, unknown>;
  /** One-line summary the AI uses to write the brief commentary. */
  summary: string;
  /** Prompt routed to the chat when the user clicks Investigate on this card. */
  investigatePrompt: string;
  priority: number;
}

export interface PersistedBriefCard {
  id: string;
  card_type: CardType;
  position: number;
  config: Record<string, unknown>;
  data_snapshot: any;
  hidden: boolean;
}

export interface InsightBullet {
  text: string;
  citedCardIds: string[];
  severity: InsightSeverity;
}

export interface PersistedBrief {
  id: string;
  intro_text: string;
  insights: InsightBullet[];
  followups: string[];
  generated_at: string;
  status: 'pending' | 'ready' | 'failed' | 'edited';
  edited_intro: string | null;
  edited_insights: InsightBullet[] | null;
}

export interface InsightDefinition<TData = unknown> {
  id: string;
  cardType: CardType;
  title: (ctx: ContextSnapshot, data: TData) => string;
  subtitle?: (ctx: ContextSnapshot, data: TData) => string;
  isEligible: (ctx: ContextSnapshot) => boolean;
  loadData: (ctx: ContextSnapshot) => Promise<TData>;
  basePriority: number;
  scorePriority?: (ctx: ContextSnapshot, feedback: FeedbackSignal[]) => number;
  toBriefSummary: (data: TData) => string;
  investigatePrompt: (data: TData) => string;
}