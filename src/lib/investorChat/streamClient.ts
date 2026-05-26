import { supabase } from '@/integrations/supabase/client';

export type SseEvent =
  | { type: 'thread'; threadId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; id: string; name: string; input: any }
  | { type: 'tool_use_result'; id: string; name: string; output: any }
  | { type: 'tool_use_error'; id: string; error: string }
  | { type: 'turn_done'; messageId: string | null; threadId: string }
  | { type: 'error'; message: string };

export interface StreamTurnArgs {
  threadId?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  activeCardContext?: any;
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
    }),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
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
        args.onEvent({ type: event as any, ...data });
      } catch (e) {
        console.error('SSE parse error', e, dataStr);
      }
    }
  }
}