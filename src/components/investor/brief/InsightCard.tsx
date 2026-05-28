import { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import {
  MoreHorizontal,
  Pin,
  Search,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ViewSourcesButton } from './ViewSourcesButton';
import type { CardSources } from '@/lib/investorBrief/sources';

interface InsightCardProps {
  briefCardId: string;
  cardType: string;
  userId: string | null;
  title: string;
  subtitle?: string;
  children: ReactNode;
  investigatePrompt: string;
  summary: string;
  isEstimate?: boolean;
  sources?: CardSources;
  onPinTalkingPoint?: (text: string) => void;
  onDismiss?: (briefCardId: string) => void;
  /** When provided, Deep Dive calls this instead of navigating to /chats. */
  onInvestigate?: () => void;
  className?: string;
}

/**
 * Generic card chrome used by every brief insight type.
 * Owns: header, body slot, action footer (Deep Dive, thumbs, copy, open-in-new, overflow).
 */
export function InsightCard({
  briefCardId,
  cardType,
  userId,
  title,
  subtitle,
  children,
  investigatePrompt,
  isEstimate,
  sources,
  onPinTalkingPoint,
  onDismiss,
  onInvestigate,
  className,
}: InsightCardProps) {
  const navigate = useNavigate();

  const writeSignal = async (
    signal: 'investigated' | 'pinned' | 'dismissed',
  ) => {
    // Telemetry: kept legacy "investigated" signal name for analytics continuity
    // even though the user-facing CTA is now "Deep Dive".
    if (!userId) return;
    await supabase.from('investor_card_feedback').insert({
      user_id: userId,
      card_type: cardType,
      brief_card_id: briefCardId,
      signal,
    });
  };

  const handleInvestigate = async () => {
    await writeSignal('investigated');
    if (onInvestigate) {
      onInvestigate();
      return;
    }
    navigate('/chats', {
      state: { initialMessage: investigatePrompt },
    });
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight flex items-center gap-2 flex-wrap">
              <span>{title}</span>
              {isEstimate && (
                <span
                  className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  title="Values shown are internal estimates, not backed by a live data source."
                >
                  Estimate
                </span>
              )}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-2 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  writeSignal('pinned');
                  onPinTalkingPoint?.(title);
                }}
              >
                <Pin className="h-4 w-4 mr-2" /> Pin as talking point
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  writeSignal('dismissed');
                  onDismiss?.(briefCardId);
                }}
              >
                <X className="h-4 w-4 mr-2" /> Dismiss
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => writeSignal('dismissed')}>
                <X className="h-4 w-4 mr-2" /> Hide this card type
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
      <CardFooter className="justify-between gap-2 border-t pt-3 pb-3">
        <div className="flex items-center gap-1">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={handleInvestigate}
            title="Open a deep dive on this card with AI follow-up."
            aria-label={`Open deep dive on ${title}`}
          >
            <Search className="h-3.5 w-3.5" /> Deep Dive
          </Button>
          <ViewSourcesButton sources={sources} />
        </div>
      </CardFooter>
    </Card>
  );
}