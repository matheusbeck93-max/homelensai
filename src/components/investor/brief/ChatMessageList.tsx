import { cn } from '@/lib/utils';
import { Wrench } from 'lucide-react';
import type { ChatTurn } from '@/contexts/InvestorBriefContext';
import { getAiTool } from '@/lib/investorBrief/aiTools';
import type { CurrentTurn } from '@/lib/investorChat/turnTypes';
import { MacroAnswerCard, getMacroAnswer } from '@/lib/conversationalIntelligence/MacroAnswerCard';

interface Props {
  turns: ChatTurn[];
  pending?: boolean;
  currentTurn?: CurrentTurn;
}

export function ChatMessageList({ turns, pending, currentTurn }: Props) {
  const visible = turns.filter((t) => t.role !== 'system');
  return (
    <div className="space-y-3">
      {visible.map((t) => (
        <div key={t.id} className={cn('flex flex-col', t.role === 'user' ? 'items-end' : 'items-start')}>
          {t.role === 'assistant' && (() => {
            const macro = getMacroAnswer(t.signals);
            return macro ? (
              <div className="w-full max-w-[90%] mb-2">
                <MacroAnswerCard answer={macro} surface="investor_chat" turnKey={t.id} />
              </div>
            ) : null;
          })()}
          <div
            className={cn(
              'max-w-[90%] rounded-md px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
              t.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-foreground',
            )}
          >
            {t.content}
            {t.toolEvents && t.toolEvents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.toolEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`tool-${ev.id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium hover:bg-background"
                    title={ev.anchor}
                  >
                    <Wrench className="h-3 w-3" /> {ev.anchor}
                  </button>
                ))}
              </div>
            )}
            {!t.toolEvents && t.toolCalls && t.toolCalls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.toolCalls.map((id) => {
                  const tool = getAiTool(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium"
                      title={tool?.description}
                    >
                      <Wrench className="h-3 w-3" /> {tool?.label ?? id}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Currently streaming turn */}
      {currentTurn && currentTurn.status === 'streaming' && (
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-md bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
            {currentTurn.text || (
              <span className="text-xs text-muted-foreground">Thinking…</span>
            )}
            {currentTurn.toolEvents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {currentTurn.toolEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`tool-${ev.id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      ev.status === 'running' && 'bg-background/60 text-muted-foreground animate-pulse',
                      ev.status === 'done' && 'bg-emerald-500/15 text-emerald-700',
                      ev.status === 'error' && 'bg-destructive/15 text-destructive',
                    )}
                  >
                    <Wrench className="h-3 w-3" /> {ev.anchor}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {currentTurn && currentTurn.status === 'error' && (
        <div className="flex justify-start">
          <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-xs">
            {currentTurn.error ?? 'Something went wrong.'}
          </div>
        </div>
      )}
      {pending && !currentTurn && (
        <div className="flex justify-start">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Thinking…</div>
        </div>
      )}
    </div>
  );
}