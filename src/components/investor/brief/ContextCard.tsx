import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActiveCardContext } from '@/contexts/InvestorBriefContext';

interface Props {
  context: ActiveCardContext;
  onBack: () => void;
}

const severityClass: Record<ActiveCardContext['severity'], string> = {
  info: 'bg-muted-foreground/15 text-foreground',
  opportunity: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

export function ContextCard({ context, onBack }: Props) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 -ml-2 px-1.5 text-xs text-muted-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to brief
        </Button>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            severityClass[context.severity],
          )}
        >
          {context.severity}
        </span>
      </div>
      <p className="text-sm font-semibold leading-tight">{context.card.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{context.summary}</p>
    </div>
  );
}