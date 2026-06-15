import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock } from "lucide-react";

interface CreditsExhaustedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function nextResetDate(): Date {
  // Daily credits reset at next UTC midnight (matches _shared/aiCredits.ts).
  const now = new Date();
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return reset;
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function CreditsExhaustedDialog({ open, onOpenChange }: CreditsExhaustedDialogProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  const reset = nextResetDate();
  const resetLocal = reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const countdown = formatCountdown(reset.getTime() - now);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">You've used today's AI credits</DialogTitle>
          <DialogDescription className="text-center">
            The Free plan includes 100 AI credits per day. Upgrade to Premium for
            unlimited access, or wait for your daily reset.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm flex items-center justify-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Credits reset at <span className="font-medium text-foreground">{resetLocal}</span>
            {" "}(in {countdown})
          </span>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-2">
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate('/pricing');
            }}
          >
            Upgrade to Buyer — $9.97/mo
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreditsExhaustedDialog;