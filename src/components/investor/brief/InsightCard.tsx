import { ReactNode, useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pin,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
  onPinTalkingPoint?: (text: string) => void;
  onDismiss?: (briefCardId: string) => void;
  /** When provided, Investigate calls this instead of navigating to /chats. */
  onInvestigate?: () => void;
  className?: string;
}

/**
 * Generic card chrome used by every brief insight type.
 * Owns: header, body slot, action footer (Investigate, thumbs, copy, open-in-new, overflow).
 */
export function InsightCard({
  briefCardId,
  cardType,
  userId,
  title,
  subtitle,
  children,
  investigatePrompt,
  summary,
  isEstimate,
  onPinTalkingPoint,
  onDismiss,
  onInvestigate,
  className,
}: InsightCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);

  const writeSignal = async (
    signal: 'up' | 'down' | 'investigated' | 'copied' | 'pinned' | 'dismissed',
  ) => {
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n${subtitle ?? ''}\n${summary}`);
      await writeSignal('copied');
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
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
        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={handleInvestigate}
        >
          <Search className="h-3.5 w-3.5" /> Investigate
        </Button>
        <div className="flex items-center gap-0.5">
          <Button
            variant={reaction === 'up' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setReaction('up');
              writeSignal('up');
            }}
            aria-label="Thumbs up"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={reaction === 'down' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setReaction('down');
              writeSignal('down');
            }}
            aria-label="Thumbs down"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
            aria-label="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleInvestigate}
            aria-label="Open in chat"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}