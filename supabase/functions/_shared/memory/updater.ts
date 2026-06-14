import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type { ChatTool } from '../ai/types.ts';
import type { MemoryCategory } from './types.ts';

export const UPDATE_USER_MEMORY_TOOL: ChatTool = {
  name: 'update_user_memory',
  description:
    'Persist a durable fact or preference about the user that should be remembered across sessions. Only call when the user states something clearly and lastingly true (a goal, constraint, location preference, etc). Do NOT call for ephemeral context.',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'reinforce', 'contradict', 'forget'] },
      memory_id: { type: 'string' },
      category: {
        type: 'string',
        enum: ['preference', 'goal', 'constraint', 'context', 'fact', 'behavior'],
      },
      content: { type: 'string' },
      importance: { type: 'number', minimum: 1, maximum: 5 },
    },
    required: ['operation'],
  },
};

export interface UpdateMemoryArgs {
  operation: 'add' | 'reinforce' | 'contradict' | 'forget';
  memory_id?: string;
  category?: MemoryCategory;
  content?: string;
  importance?: number;
}

export async function handleUpdateUserMemory(
  db: SupabaseClient,
  userId: string,
  args: UpdateMemoryArgs,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const op = args.operation;
  try {
    if (op === 'add') {
      if (!args.content || !args.category) return { ok: false, error: 'missing fields' };
      const { data, error } = await db
        .from('user_memories')
        .insert({
          user_id: userId,
          category: args.category,
          content: args.content.slice(0, 400),
          importance: Math.max(1, Math.min(5, Math.round(args.importance ?? 3))),
          source: 'tool_inferred',
        })
        .select('id')
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    }
    if (!args.memory_id) return { ok: false, error: 'memory_id required' };
    if (op === 'forget') {
      const { error } = await db
        .from('user_memories')
        .update({ user_deleted: true })
        .eq('id', args.memory_id)
        .eq('user_id', userId);
      return { ok: !error, error: error?.message };
    }
    if (op === 'reinforce') {
      const { data: row } = await db
        .from('user_memories')
        .select('reinforced_count,importance')
        .eq('id', args.memory_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!row) return { ok: false, error: 'not found' };
      const { error: uerr } = await db
        .from('user_memories')
        .update({
          reinforced_count: (row.reinforced_count ?? 0) + 1,
          importance: Math.min(5, (row.importance ?? 3) + 1),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', args.memory_id)
        .eq('user_id', userId);
      return { ok: !uerr, error: uerr?.message };
    }
    if (op === 'contradict') {
      const { data: row } = await db
        .from('user_memories')
        .select('contradicted_count,importance')
        .eq('id', args.memory_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!row) return { ok: false, error: 'not found' };
      const nextContradicted = (row.contradicted_count ?? 0) + 1;
      const nextImportance = Math.max(1, (row.importance ?? 3) - 1);
      const update: Record<string, unknown> = {
        contradicted_count: nextContradicted,
        importance: nextImportance,
        last_used_at: new Date().toISOString(),
      };
      if (nextContradicted >= 2) update.user_deleted = true;
      const { error: uerr } = await db
        .from('user_memories')
        .update(update)
        .eq('id', args.memory_id)
        .eq('user_id', userId);
      return { ok: !uerr, error: uerr?.message };
    }
    return { ok: false, error: 'unknown operation' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}