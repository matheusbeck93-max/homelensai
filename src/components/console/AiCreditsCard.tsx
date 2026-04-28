import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Infinity as InfinityIcon, Clock } from "lucide-react";
import { useAiCredits } from "@/hooks/useAiCredits";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0h 0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function msUntilNextUtcReset(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return next.getTime() - now.getTime();
}

export function AiCreditsCard() {
  const navigate = useNavigate();
  const { loading, used, remaining, total, isUnlimited } = useAiCredits();
  const [countdown, setCountdown] = useState<string>(() => formatCountdown(msUntilNextUtcReset()));

  useEffect(() => {
    if (isUnlimited) return;
    const tick = () => setCountdown(formatCountdown(msUntilNextUtcReset()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isUnlimited]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-12 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (isUnlimited) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <InfinityIcon className="h-5 w-5 text-primary" />
            <span className="font-semibold">Unlimited</span>
            <span className="text-muted-foreground">— Premium plan</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.round((used / total) * 100);
  const ratio = remaining / total;
  const exhausted = remaining <= 0;
  const low = ratio > 0 && ratio <= 0.2;

  return (
    <Card className={exhausted ? "border-destructive" : low ? "border-warning" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-bold">{remaining}</span>
            <span className="text-xs text-muted-foreground">of {total} left today</span>
          </div>
          <Progress value={percent} className="h-2" />
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Resets in {countdown}</span>
          </div>
        </div>

        {exhausted ? (
          <p className="text-xs text-destructive">
            0 credits left. Resets in {countdown}, or upgrade to Premium for unlimited access now.
          </p>
        ) : low ? (
          <p className="text-xs text-warning-foreground">
            Only {remaining} of {total} credits left. Resets in {countdown}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Credits reset every 24 hours. Different requests use different amounts.
          </p>
        )}

        <Button
          size="sm"
          variant={exhausted ? "default" : "outline"}
          className="w-full"
          onClick={() => navigate("/pricing")}
        >
          {exhausted ? "Upgrade to Premium" : "Get unlimited with Premium"}
        </Button>
      </CardContent>
    </Card>
  );
}