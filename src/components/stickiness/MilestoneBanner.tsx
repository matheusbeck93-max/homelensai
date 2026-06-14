import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStickiness, type PendingMilestone } from '@/hooks/useStickiness';
import { MilestoneShareDialog } from './MilestoneShareDialog';

const SEEN_KEY = 'homelens.milestone.confetti.seen';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-200)));
  } catch {
    /* ignore */
  }
}

function fireConfetti() {
  const end = Date.now() + 700;
  const colors = ['#6B8DB5', '#2C3E55', '#FFD27A'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/**
 * Single banner host for stickiness milestones. Mount once at the app shell
 * level. Shows the highest-priority pending milestone for the current route
 * category, with a one-time confetti burst per `major` milestone.
 */
export function MilestoneBanner() {
  const { pendingMilestones, acknowledge } = useStickiness();
  const [shareTarget, setShareTarget] = useState<PendingMilestone | null>(null);
  const [seen, setSeen] = useState<Set<string>>(loadSeen);

  const current = useMemo(() => {
    if (pendingMilestones.length === 0) return null;
    const order: Record<string, number> = { major: 0, notable: 1, minor: 2 };
    return [...pendingMilestones].sort(
      (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9),
    )[0];
  }, [pendingMilestones]);

  useEffect(() => {
    if (!current || current.severity !== 'major') return;
    if (seen.has(current.id)) return;
    fireConfetti();
    const next = new Set(seen);
    next.add(current.id);
    saveSeen(next);
    setSeen(next);
  }, [current, seen]);

  if (!current) return null;

  return (
    <>
      <div className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-40 animate-in slide-in-from-bottom-4">
        <div className="rounded-lg border border-primary/30 bg-card shadow-lg p-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
              {current.severity === 'major' ? 'Big milestone' : 'Milestone'}
            </p>
            <p className="text-sm font-semibold text-foreground leading-snug">
              {current.headline}
            </p>
            {current.context && (
              <p className="text-xs text-muted-foreground mt-1">{current.context}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShareTarget(current)}
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
              <Button size="sm" variant="ghost" onClick={() => acknowledge(current.id)}>
                Got it
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => acknowledge(current.id)}
            className="text-muted-foreground hover:text-foreground p-1 -m-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <MilestoneShareDialog
        milestone={shareTarget}
        open={!!shareTarget}
        onOpenChange={(o) => {
          if (!o) setShareTarget(null);
        }}
      />
    </>
  );
}