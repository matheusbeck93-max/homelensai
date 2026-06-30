import { supabase } from '@/integrations/supabase/client';
import { recordBudgetExceededFrom402 } from '@/lib/ai/budgetCap';

export type SseEvent =
  | { type: 'thread'; threadId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; id: string; name: string; input: any }
  | { type: 'tool_use_result'; id: string; name: string; output: any }
  | { type: 'tool_use_error'; id: string; error: string }
  | {
      type: 'signals';
      mismatch_signals?: Array<Record<string, unknown>>;
      suggested_followups?: Array<{ label: string; action: Record<string, unknown> }>;
      macro_answer?: Record<string, unknown>;
    }
  | { type: 'turn_done'; messageId: string | null; threadId: string }
  | { type: 'quota_exceeded'; code: 'BUDGET_EXCEEDED' | 'QUOTA_EXCEEDED'; message?: string; upgradeUrl?: string; [k: string]: unknown }
  | { type: 'error'; message: string };

/**
 * Thrown when the AI router returns 402 budget_exceeded. The global budget
 * cap store is already updated before this throws; callers can short-circuit
 * their generic error toast by checking `err.name === 'BudgetExceededError'`.
 */
export class BudgetExceededError extends Error {
  constructor(message = 'Daily AI cap reached') {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/** PR #6: thrown when a per-feature monthly quota (free/buyer tier) trips. */
export class FeatureQuotaExceededError extends Error {
  constructor(message = 'Monthly AI quota reached') {
    super(message);
    this.name = 'FeatureQuotaExceededError';
  }
}

export interface StreamTurnArgs {
  threadId?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  activeCardContext?: any;
  sessionFilters?: any;
  onEvent: (ev: SseEvent) => void;
  signal?: AbortSignal;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/investor-chat`;

export async function streamInvestorChat(args: StreamTurnArgs): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      threadId: args.threadId,
      messages: args.messages,
      activeCardContext: args.activeCardContext,
      sessionFilters: args.sessionFilters ?? null,
    }),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    if (res.status === 402) {
      try {
        const body = JSON.parse(text);
        // PR #6: accept both legacy and canonical envelopes.
        if (body && (body.code === 'BUDGET_EXCEEDED' || body.error === 'budget_exceeded')) {
          recordBudgetExceededFrom402(body, 'investor_chat');
          throw new BudgetExceededError();
        }
        if (body && (body.code === 'QUOTA_EXCEEDED' || body.error === 'feature_quota_exceeded')) {
          throw new FeatureQuotaExceededError(body.message || 'Monthly AI quota reached');
        }
      } catch (e) {
        if (e instanceof BudgetExceededError) throw e;
        if (e instanceof FeatureQuotaExceededError) throw e;
      }
    }
    throw new Error(`investor-chat ${res.status}: ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = raw.split('\n');
      let event = 'message';
      let dataStr = '';
      for (const ln of lines) {
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        const data = JSON.parse(dataStr);
        // PR #6: mid-stream quota trip — record into the budget store and
        // forward as a typed event so the UI can render <BudgetCapBlocker />
        // or the credits-exhausted dialog without a generic toast.
        if (event === 'quota_exceeded' && data && typeof data === 'object') {
          if (data.code === 'BUDGET_EXCEEDED' || data.error === 'budget_exceeded') {
            recordBudgetExceededFrom402(data, 'investor_chat');
          }
        }
        args.onEvent({ type: event as any, ...data });
      } catch (e) {
        console.error('SSE parse error', e, dataStr);
      }
    }
  }
}