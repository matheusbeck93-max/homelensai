import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useLegacyUpgrade } from '@/lib/legacyUpgrade';

interface Copy {
  headline: string;
  body: string;
  subLine: string;
  primaryCta: string;
}

const COPY: Record<'buyer' | 'investor', Copy> = {
  buyer: {
    headline: "We've added a lot to Buyer since you joined",
    body:
      "You signed up for HomeLens Buyer at $4.97/mo — thanks for being an early subscriber. Since then we've added the personalized AI chat agent, HomeLens chat on any tab (Chrome extension), saved analyses, and property alerts. The current Buyer plan is $9.97/mo. Want to move over?",
    subLine: 'Or stay on your $4.97 plan — your existing features keep working.',
    primaryCta: 'Move to $9.97 Buyer',
  },
  investor: {
    headline: 'Investor has grown — want the latest pricing?',
    body:
      "You're on a legacy Investor plan. The current Investor plan is $24.97/mo and includes 20-year IRR projections, stress scenarios, ARM modeling, the Market Comparator, and investor-grade Excel exports. Want to move over?",
    subLine: 'Or stay on your current plan — your existing access is preserved.',
    primaryCta: 'Move to $24.97 Investor',
  },
};

interface Props {
  surface: string;
}

/**
 * Mount on tier-relevant surfaces (Investor, My Properties, Console). Renders
 * nothing unless the user is on legacy pricing AND the anti-spam rules
 * permit a show. Records `shown` once when it first becomes visible.
 */
export function LegacyUpgradeModal({ surface }: Props) {
  const { loading, shouldShow, tier, recordShown, dismiss, openPortal } =
    useLegacyUpgrade(surface);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const shownRecorded = useRef(false);

  useEffect(() => {
    if (loading || !shouldShow) return;
    setOpen(true);
    if (!shownRecorded.current) {
      shownRecorded.current = true;
      void recordShown();
    }
  }, [loading, shouldShow, recordShown]);

  if (tier !== 'buyer' && tier !== 'investor') return null;
  const copy = COPY[tier];

  const handleOpenChange = (next: boolean) => {
    if (!next && open) {
      // Plain close (X / outside click) = soft dismiss; no snooze override.
      void dismiss('dismissed');
    }
    setOpen(next);
  };

  const handleUpgrade = async () => {
    setSubmitting(true);
    try {
      await openPortal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleLater = async () => {
    await dismiss('later');
    setOpen(false);
  };

  const handleNoThanks = async () => {
    await dismiss('no_thanks');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>{copy.headline}</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            {copy.body}
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground italic">{copy.subLine}</p>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleUpgrade} disabled={submitting} className="w-full">
            {submitting ? 'Opening Stripe…' : copy.primaryCta}
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleLater}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              Remind me later
            </Button>
            <Button
              onClick={handleNoThanks}
              variant="ghost"
              className="flex-1"
              disabled={submitting}
            >
              No thanks
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}