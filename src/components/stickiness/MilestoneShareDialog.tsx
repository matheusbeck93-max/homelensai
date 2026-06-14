import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Copy, Loader2 } from 'lucide-react';
import { useStickiness, type PendingMilestone, type ShareResult } from '@/hooks/useStickiness';

interface Props {
  milestone: PendingMilestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MilestoneShareDialog({ milestone, open, onOpenChange }: Props) {
  const { share } = useStickiness();
  const { toast } = useToast();
  const [result, setResult] = useState<ShareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !milestone) {
      setResult(null);
      return;
    }
    setLoading(true);
    share(milestone.id)
      .then((r) => {
        if (!r) {
          toast({
            title: 'Could not build share image',
            description: 'Please try again in a moment.',
            variant: 'destructive',
          });
        }
        setResult(r);
      })
      .finally(() => setLoading(false));
  }, [open, milestone, share, toast]);

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tweetText);
    toast({ title: 'Copied', description: 'Tweet text copied to clipboard.' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this milestone</DialogTitle>
          <DialogDescription>
            {milestone?.headline ?? 'Generating your share card…'}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
          {loading || !result ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <img
              src={result.url}
              alt={milestone?.headline ?? 'Milestone share card'}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        {result && (
          <p className="text-xs text-muted-foreground italic">
            {result.tweetText}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={!result}
            onClick={() => {
              if (!result) return;
              const a = document.createElement('a');
              a.href = result.url;
              a.download = `homelens-milestone.${result.format}`;
              a.click();
            }}
          >
            <Download className="h-4 w-4" />
            Download image
          </Button>
          <Button className="w-full" disabled={!result} onClick={handleCopy}>
            <Copy className="h-4 w-4" />
            Copy tweet text
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}