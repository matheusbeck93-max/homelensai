import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  relativeAsOf,
  type CardSources,
  type MetricSource,
} from '@/lib/investorBrief/sources';

interface Props {
  /** Visible value (already formatted). */
  children: React.ReactNode;
  /** Metric key — must exist on `sources` to render the (i). */
  metric: string;
  sources?: CardSources;
  /** Override the lookup with an explicit source. */
  source?: MetricSource;
  className?: string;
  /** Render the (i) icon inline next to the value. Default true. */
  showIcon?: boolean;
}

export function MetricWithSource({
  children,
  metric,
  sources,
  source: explicit,
  className,
  showIcon = true,
}: Props) {
  const source = explicit ?? sources?.[metric];
  if (!source) return <span className={className}>{children}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{children}</span>
      {showIcon && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Show data source"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -m-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-3 text-xs">
            <div className="space-y-1.5">
              <div className="font-semibold text-foreground">Source</div>
              <div className="text-foreground/90">{source.label}</div>
              <div className="text-muted-foreground">
                {source.asOf ? `Updated ${relativeAsOf(source.asOf)}` : 'No automatic refresh'}
              </div>
              {source.note && (
                <div className="text-muted-foreground border-t pt-1.5 mt-1.5">{source.note}</div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

/** Compact footer line: "Sources: A, B, C · updated 2d ago". */
export function CardSourceFooter({ sources }: { sources?: CardSources }) {
  if (!sources) return null;
  const entries = Object.values(sources);
  if (entries.length === 0) return null;
  const labels = Array.from(new Set(entries.map((s) => s.label)));
  const newestAsOf = entries
    .map((s) => s.asOf)
    .filter(Boolean)
    .sort()
    .pop();
  return (
    <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground">
      Sources: {labels.join(' · ')}
      {newestAsOf && <> · updated {relativeAsOf(newestAsOf)}</>}
    </div>
  );
}