import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { MEMORY_CAP_BY_TIER, type MemoryTier } from './types.ts';

const EXPIRY_DAYS = 18 * 30; // ~18 months

/**
 * Enforce per-tier cap by soft-deleting the lowest-priority memories, and
 * auto-expire anything not reinforced in the last 18 months.
 */
export async function pruneMemories(
  db: SupabaseClient,
  userId: string,
  tier: MemoryTier,
): Promise<{ pruned: number; expired: number }> {
  const cap = MEMORY_CAP_BY_TIER[tier];

  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: expired } = await db
    .from('user_memories')
    .update({ user_deleted: true })
    .eq('user_id', userId)
    .eq('user_deleted', false)
    .lt('last_used_at', cutoff)
    .select('id');

  const { count } = await db
    .from('user_memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('user_deleted', false);

  let pruned = 0;
  if ((count ?? 0) > cap) {
    const over = (count ?? 0) - cap;
    const { data: lru } = await db
      .from('user_memories')
      .select('id')
      .eq('user_id', userId)
      .eq('user_deleted', false)
      .order('importance', { ascending: true })
      .order('last_used_at', { ascending: true })
      .limit(over);
    const ids = (lru ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      await db.from('user_memories').update({ user_deleted: true }).in('id', ids);
      pruned = ids.length;
    }
  }

  return { pruned, expired: expired?.length ?? 0 };
}