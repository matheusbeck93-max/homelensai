/**
 * Persistent AI memory types — Phase 2 of the Stickiness layer.
 */

export type MemoryCategory =
  | 'preference'
  | 'goal'
  | 'constraint'
  | 'context'
  | 'fact'
  | 'behavior';

export type MemorySource = 'extracted' | 'user_stated' | 'tool_inferred' | 'manual';

export interface UserMemory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  importance: number; // 1-5
  source: MemorySource;
  source_conversation_id: string | null;
  last_used_at: string;
  reinforced_count: number;
  contradicted_count: number;
  user_deleted: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtractedMemoryCandidate {
  category: MemoryCategory;
  content: string;
  importance: number;
}

export type MemoryTier = 'free' | 'buyer' | 'investor';

export const MEMORY_CAP_BY_TIER: Record<MemoryTier, number> = {
  free: 25,
  buyer: 100,
  investor: 250,
};

export function resolveMemoryTier(tier?: string | null): MemoryTier {
  if (tier === 'investor' || tier === 'unlimited' || tier === 'premium') return 'investor';
  if (tier === 'buyer' || tier === 'paid') return 'buyer';
  return 'free';
}