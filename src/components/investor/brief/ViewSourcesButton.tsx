import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  relativeAsOf,
  type CardSources,
} from '@/lib/investorBrief/sources';

interface Props {
  sources?: CardSources;
}

/**
 * Click-through footer button that opens a popover listing every metric on
 * the card with its SourceKind, source label, and last-updated timestamp.
 */
export function ViewSourcesButton({ sources }: Props) {
  const entries = sources ? Object.entries(sources) : [];
  if (entries.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Database className="h-3.5 w-3.5" />
          View sources
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0 text-xs">
        <div className="px-3 py-2 border-b font-semibold text-foreground">
          Data sources
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {entries.map(([metric, src]) => (
            <div key={metric} className="px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground capitalize">
                  {metric.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {src.kind.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-foreground/80">{src.label}</div>
              <div className="text-muted-foreground">
                {src.asOf
                  ? `Updated ${relativeAsOf(src.asOf)}`
                  : 'No automatic refresh'}
              </div>
              {src.note && (
                <div className="text-muted-foreground italic">{src.note}</div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}