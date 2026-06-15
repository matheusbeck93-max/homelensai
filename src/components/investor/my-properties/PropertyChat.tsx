import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBudgetCap, parseAndRecordBudget402 } from '@/lib/ai/budgetCap';
import { BudgetCapBanner } from '@/components/ai/BudgetCapBanner';
import { BudgetCapBlocker } from '@/components/ai/BudgetCapBlocker';
import {
  ConversationalIntelligence,
  useConversationalIntelligenceState,
  type ChatTurn,
} from '@/lib/conversationalIntelligence';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  signals?: ChatTurn['signals'];
};

const STORAGE_PREFIX = 'homelens.ownedPropertyChat.v1.';

const SUGGESTIONS = [
  'Should I refinance this property?',
  'Is rent under market right now?',
  'What would my returns look like if I sold today?',
  'How much equity could I tap with a HELOC?',
];

function loadHistory(propertyId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + propertyId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(propertyId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + propertyId, JSON.stringify(msgs.slice(-40)));
  } catch {
    /* ignore */
  }
}

interface PropertyChatProps {
  propertyId: string;
}

export function PropertyChat({ propertyId }: PropertyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(propertyId));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cap = useBudgetCap();
  const capExceeded = cap.warningLevel === 'exceeded';
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const ci = useConversationalIntelligenceState(userId);

  useEffect(() => {
    setMessages(loadHistory(propertyId));
  }, [propertyId]);

  useEffect(() => {
    saveHistory(propertyId, messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, propertyId]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [propertyId, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('owned-property-chat', {
        body: { property_id: propertyId, messages: next },
      });
      if (error) throw error;
      const reply = (data as any)?.message ?? '';
      if (!reply) throw new Error('Empty response');
      const sig = (data as any)?.signals;
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: reply,
          signals: sig && typeof sig === 'object' ? sig : undefined,
        },
      ]);
    } catch (e: any) {
      if (await parseAndRecordBudget402(e, 'owned_property_chat')) {
        setMessages(messages);
        return;
      }
      toast.error(e?.message ?? 'Chat failed');
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }

  function clear() {
    setMessages([]);
    localStorage.removeItem(STORAGE_PREFIX + propertyId);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <Card>
      <CardContent className="p-0 flex flex-col h-[560px]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-primary" />
            Ask about this property
          </div>
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear} className="h-7 text-xs">
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {cap.warningLevel === 'approaching' && (
            <BudgetCapBanner surface="owned_property_chat" />
          )}
          {capExceeded && <BudgetCapBlocker surface="owned_property_chat" compact />}
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask anything about this property — refinance, equity, rent, returns, hold vs sell. The AI has your numbers loaded.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={capExceeded}
                    className="text-left text-xs rounded-md border bg-muted/40 hover:bg-muted px-3 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {m.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-primary text-primary-foreground whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <div className="border-t p-3">
          {ci.loaded && ci.smartSuggestionsEnabled && (
            <ConversationalIntelligence
              active={{ kind: 'owned_property', propertyId }}
              thread={messages as ChatTurn[]}
              preferences={ci.preferences}
              dismissals={ci.dismissals}
              enabled={ci.smartSuggestionsEnabled}
              onSendMessage={(t) => void send(t)}
              onAcceptFollowup={ci.onAccept}
              onDismissFollowup={ci.onDismiss}
              onSaveException={ci.onSaveException}
              onGenerateArtifact={ci.generateArtifact}
            />
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                capExceeded
                  ? 'Daily AI cap reached. Resets at midnight UTC.'
                  : 'Ask something about this property…'
              }
              rows={2}
              className="resize-none min-h-[44px]"
              disabled={sending || capExceeded}
            />
            <Button
              size="icon"
              onClick={() => send(input)}
              disabled={sending || !input.trim() || capExceeded}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}