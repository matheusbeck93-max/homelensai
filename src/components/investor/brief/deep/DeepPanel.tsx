import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInvestorBriefSurface } from '@/contexts/InvestorBriefContext';
import { renderToolEvent } from '@/components/investor/chat/visualRegistry';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';
import { SourceCardVisual } from './SourceCardVisual';
import { StarterPrompts } from './StarterPrompts';
import { defaultDeepDiveStarters } from '@/lib/investorBrief/deepDiveStarters';

interface Props {
  onBack: () => void;
}

/**
 * Right-hand Deep Dive surface.
 *
 * When the user enters Deep Dive from a card, we seed the panel with that
 * card's visual at a larger density plus starter follow-up prompts — so the
 * user never sees an empty placeholder right after clicking Deep Dive.
 * Subsequent AI tool calls stack below the seeded visual.
 */
export function DeepPanel({ onBack }: Props) {
  const { currentThread, currentTurn, activeCardContext, sendTurn } =
    useInvestorBriefSurface();

  const historyEvents: ToolEvent[] = currentThread
    .flatMap((t) => t.toolEvents ?? [])
    .filter(Boolean);
  const allEvents = [...historyEvents, ...currentTurn.toolEvents];

  const sourceCard = activeCardContext?.card ?? null;
  const isStreaming = currentTurn.status === 'streaming';
  const starters = sourceCard
    ? defaultDeepDiveStarters(sourceCard.cardType, sourceCard.title)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to brief
        </Button>
        <div className="text-xs text-muted-foreground truncate">
          {sourceCard?.title ?? 'Free conversation'}
        </div>
      </div>

      {sourceCard && (
        <>
          <div className="text-xs text-muted-foreground">
            You're deep-diving on <span className="font-medium text-foreground">{sourceCard.title}</span>.
            Ask a follow-up below or pick a suggestion.
          </div>
          <SourceCardVisual card={sourceCard} />
          {allEvents.length === 0 && (
            <StarterPrompts
              prompts={starters}
              disabled={isStreaming}
              onPick={(p) => sendTurn(p)}
            />
          )}
        </>
      )}

      {allEvents.length > 0 && (
        <div className="space-y-3">
          {[...allEvents].reverse().map((ev) => (
            <div key={ev.id}>{renderToolEvent(ev)}</div>
          ))}
        </div>
      )}

      {!sourceCard && allEvents.length === 0 && !isStreaming && (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          Ask anything about your portfolio or markets — supporting data and visuals will appear here.
        </div>
      )}
    </div>
  );
}