import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInvestorBriefSurface } from '@/contexts/InvestorBriefContext';
import { renderToolEvent } from '@/components/investor/chat/visualRegistry';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

interface Props {
  onBack: () => void;
}

/**
 * Collects every tool event from the entire active thread (history + currently
 * streaming turn) and renders them top-to-bottom. Newest at the top so the user
 * always sees fresh data without scrolling.
 */
export function DeepPanel({ onBack }: Props) {
  const { currentThread, currentTurn, activeCardContext } = useInvestorBriefSurface();

  const historyEvents: ToolEvent[] = currentThread
    .flatMap((t) => t.toolEvents ?? [])
    .filter(Boolean);
  const allEvents = [...historyEvents, ...currentTurn.toolEvents];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to brief
        </Button>
        <div className="text-xs text-muted-foreground truncate">
          {activeCardContext?.card.title ?? 'Free conversation'}
        </div>
      </div>

      {allEvents.length === 0 && currentTurn.status !== 'streaming' ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          Ask a question on the left — supporting data and visuals will appear here as the AI runs tools.
        </div>
      ) : (
        <div className="space-y-3">
          {[...allEvents].reverse().map((ev) => (
            <div key={ev.id}>{renderToolEvent(ev)}</div>
          ))}
        </div>
      )}
    </div>
  );
}