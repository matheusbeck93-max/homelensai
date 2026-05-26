import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Send, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { InsightBullet } from '@/lib/investorBrief/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ContextCard } from './ContextCard';
import { ChatMessageList } from './ChatMessageList';
import { useInvestorBriefSurface } from '@/contexts/InvestorBriefContext';
import { PersonaSummary } from '@/components/preferences/PersonaSummary';
import { usePersona } from '@/lib/personas/usePersona';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState as useReactState } from 'react';
import { recordPersonaEvent } from '@/lib/personas/telemetry';

interface Props {
  introText: string;
  insights: InsightBullet[];
  followups?: string[];
  generatedAt?: string;
  isStale?: boolean;
  refreshing?: boolean;
  loading?: boolean;
  onRefresh: () => void;
}

const severityClass: Record<InsightBullet['severity'], string> = {
  info: 'bg-muted-foreground/50',
  opportunity: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

export function BriefCard({
  introText,
  insights,
  followups,
  generatedAt,
  isStale,
  refreshing,
  loading,
  onRefresh,
}: Props) {
  const [userId, setUserId] = useReactState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  const { persona, def: personaDef } = usePersona(userId);
  const {
    mode,
    activeCardContext,
    currentThread,
    currentTurn,
    enterChatModeFromQuery,
    exitChatMode,
    sendTurn,
  } = useInvestorBriefSurface();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pending = currentTurn.status === 'streaming';

  useEffect(() => {
    if (mode === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mode, currentThread, currentTurn.text, currentTurn.toolEvents.length, pending]);

  const submitQuery = async () => {
    const q = query.trim();
    if (!q || pending) return;
    setQuery('');
    if (mode === 'brief') {
      enterChatModeFromQuery(q);
      // enterChatModeFromQuery already adds the user turn; replace with sendTurn-only flow
    }
    void sendTurn(q);
  };

  const inChat = mode === 'chat';

  return (
    <Card className="lg:sticky lg:top-24 self-start">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {inChat ? 'Investigating' : 'Prepared by HomeLens'}
          </div>
          {!inChat && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          )}
        </div>
        {!inChat && generatedAt && (
          <div className="text-[11px] text-muted-foreground">
            {format(new Date(generatedAt), 'MMM d, h:mma')}
            {isStale && <span className="ml-2 text-amber-600">Refresh recommended</span>}
          </div>
        )}
        {!inChat && <PersonaSummary persona={persona} className="mt-1" />}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {inChat ? (
          <div className="space-y-3">
            {activeCardContext && (
              <ContextCard context={activeCardContext} onBack={exitChatMode} />
            )}
            {!activeCardContext && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 -ml-2 px-1.5 text-xs text-muted-foreground"
                onClick={exitChatMode}
              >
                ← Back to brief
              </Button>
            )}
            <div
              ref={scrollRef}
              className="max-h-[420px] overflow-y-auto pr-1"
            >
              <ChatMessageList turns={currentThread} pending={pending} currentTurn={currentTurn} />
              {currentThread.filter((t) => t.role !== 'system').length === 0 &&
                currentTurn.status !== 'streaming' && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Try asking ({personaDef.displayName})
                    </div>
                    {personaDef.suggestedStarterPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          void recordPersonaEvent(userId, persona, 'investor_persona_starter_clicked', { prompt });
                          void sendTurn(prompt);
                        }}
                        className="block w-full text-left text-xs text-primary hover:underline"
                      >
                        → {prompt}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {introText || 'Your daily brief will appear here once generated.'}
            </p>
            {insights.length > 0 && (
              <ul className="space-y-2.5">
                {insights.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span
                      className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', severityClass[b.severity])}
                    />
                    <span className="leading-relaxed">{b.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {followups && followups.length > 0 && (
              <div className="pt-2 border-t space-y-1.5">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Suggested follow-ups
                </div>
                {followups.slice(0, 3).map((f, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      enterChatModeFromQuery(f);
                      void sendTurn(f);
                    }}
                    className="block w-full text-left text-xs text-primary hover:underline"
                  >
                    → {f}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="pt-2 border-t">
          <div className="relative">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitQuery();
                }
              }}
              placeholder={inChat ? 'Ask a follow-up...' : 'Ask something about your brief...'}
              rows={2}
              className="resize-none pr-10 text-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-1 right-1 h-7 w-7"
              onClick={submitQuery}
              disabled={!query.trim() || pending}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
