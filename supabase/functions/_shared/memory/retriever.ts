/**
 * Load + render the top-N memories for injection into a chat system prompt.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { UserMemory } from './types.ts';

export async function loadMemoriesForContext(
  db: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<UserMemory[]> {
  if (!userId) return [];
  const { data, error } = await db
    .from('user_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('user_deleted', false)
    .order('importance', { ascending: false })
    .order('last_used_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[memory.retriever] load failed', error);
    return [];
  }
  if (data && data.length > 0) {
    const ids = data.map((m: UserMemory) => m.id);
    db.from('user_memories')
      .update({ last_used_at: new Date().toISOString() })
      .in('id', ids)
      .then(({ error: e }) => {
        if (e) console.warn('[memory.retriever] touch failed', e);
      });
  }
  return (data ?? []) as UserMemory[];
}

export function renderMemoriesBlock(memories: UserMemory[]): string {
  if (!memories || memories.length === 0) return '';
  const lines = memories.map((m) => `- (${m.category}) ${m.content}`);
  return [
    '## What you remember about this user',
    '',
    'These are durable facts and preferences carried forward from past sessions.',
    'Use them naturally to personalise answers — never recite them, never say',
    '"I remember that you..." in a creepy way. If a stated fact now contradicts',
    'one of these memories, trust the user and silently update.',
    '',
    ...lines,
  ].join('\n');
}