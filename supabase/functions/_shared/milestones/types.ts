/**
 * Milestone domain types — shared between detector, rules, edge functions
 * and (via a thin frontend mirror) the React banner components.
 */

export type MilestoneCategory = 'property' | 'saved' | 'account' | 'market' | 'streak';
export type MilestoneSeverity = 'minor' | 'notable' | 'major';

export interface MilestoneEvent {
  /** Stable rule key, e.g. `property.appreciation.25k`. */
  milestoneId: string;
  /** Per-subject identifier so the same rule can fire for many properties.
   *  Use empty string for account/market-wide events. */
  subjectId: string;
  category: MilestoneCategory;
  severity: MilestoneSeverity;
  headline: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface UserContext {
  userId: string;
  tier: 'free' | 'buyer' | 'investor';
  createdAt: string;
  ownedProperties: OwnedPropertySnapshot[];
  savedProperties: SavedPropertySnapshot[];
  marketStats: MarketStatSnapshot[];
  analysesCount: number;
  preferredCities: string[];
  fullName: string | null;
}

export interface OwnedPropertySnapshot {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentValue: number | null;
  loanOriginalPrincipal: number | null;
  loanCurrentBalance: number | null;
  primaryPhotoUrl: string | null;
}

export interface SavedPropertySnapshot {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  listPrice: number | null;
  savedAt: string;
  lastSeenPrice?: number | null;
}

export interface MarketStatSnapshot {
  city: string;
  state: string | null;
  medianListPrice: number | null;
  appreciationYoy: number | null;
  refreshedAt: string | null;
}

export interface MilestoneRule {
  id: string;
  category: MilestoneCategory;
  /** Returns 0..N events for this user. */
  evaluate(ctx: UserContext): MilestoneEvent[];
}