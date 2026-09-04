/**
 * Post-verdict agent action bar (Agentic v1).
 *
 * Appears directly under a Match Score / verdict. The agent proposes; the
 * person decides. Nothing here contacts anyone or makes an offer.
 *   - Watch similar        -> creates a `watch_similar` Watch Goal
 *   - Notify on price drop -> creates a `watch_price_drop` Watch Goal
 *   - Save                 -> caller-supplied Save Analysis control
 *   - Draft offer memo     -> placeholder, disabled in v1
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Eye, TrendingDown, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { createWatchGoal, type SeedProperty } from "@/lib/watchGoals";

interface Props {
  seed: SeedProperty;
  /** Existing Save control (SaveAnalysisButton) rendered inline. */
  saveSlot?: ReactNode;
  className?: string;
}

export function AgentActionBar({ seed, saveSlot, className }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"similar" | "drop" | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const locationOf = () =>
    [seed.city, seed.state].filter(Boolean).join(", ").trim();

  const handleWatchSimilar = async () => {
    const location = locationOf();
    if (!location) {
      toast({
        title: "Nothing to watch yet",
        description: "This listing has no city and state, so a watch goal can't be created.",
        variant: "destructive",
      });
      return;
    }
    setBusy("similar");
    const price = Number(seed.price ?? 0);
    const result = await createWatchGoal({
      label: `Similar to ${seed.address ?? location}`,
      goalKind: "watch_similar",
      location,
      cadence: "weekly",
      priceMin: price ? Math.round(price * 0.85) : undefined,
      priceMax: price ? Math.round(price * 1.1) : undefined,
      bedsMin: seed.beds,
      seedProperty: seed,
    });
    setBusy(null);
    if (result.ok !== true) {
      toast({ title: "Could not create watch goal", description: result.error, variant: "destructive" });
      return;
    }
    setConfirmation(`Watch goal created (${result.id.slice(0, 8)}) — similar homes in ${location}, weekly.`);
    toast({
      title: "Watching similar homes",
      description: `Goal ${result.id.slice(0, 8)} created for ${location}. I'll score new matches weekly.`,
    });
  };

  const handleWatchPriceDrop = async () => {
    const location = locationOf();
    if (!location) {
      toast({
        title: "Nothing to watch yet",
        description: "This listing has no city and state, so a watch goal can't be created.",
        variant: "destructive",
      });
      return;
    }
    setBusy("drop");
    const price = Number(seed.price ?? 0);
    const result = await createWatchGoal({
      label: `Price drop — ${seed.address ?? location}`,
      goalKind: "watch_price_drop",
      location,
      cadence: "daily",
      priceMax: price || undefined,
      bedsMin: seed.beds,
      seedProperty: seed,
    });
    setBusy(null);
    if (result.ok !== true) {
      toast({ title: "Could not create watch goal", description: result.error, variant: "destructive" });
      return;
    }
    setConfirmation(
      `Watch goal created (${result.id.slice(0, 8)}) — I'll flag anything below ${
        price ? `$${price.toLocaleString("en-US")}` : "this price"
      }, checked daily.`,
    );
    toast({
      title: "Watching for a price drop",
      description: `Goal ${result.id.slice(0, 8)} created. Checked daily.`,
    });
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleWatchSimilar} disabled={busy !== null}>
          {busy === "similar" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Eye className="h-4 w-4 mr-2" />
          )}
          Watch similar
        </Button>

        <Button variant="outline" size="sm" onClick={handleWatchPriceDrop} disabled={busy !== null}>
          {busy === "drop" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TrendingDown className="h-4 w-4 mr-2" />
          )}
          Notify on price drop
        </Button>

        {saveSlot}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="ghost" size="sm" disabled>
                  <FileText className="h-4 w-4 mr-2" />
                  Draft offer memo
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon — you'll always review before anything is sent.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {confirmation && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          {confirmation}{" "}
          <Link to="/saved-searches" className="underline underline-offset-2">
            Manage watch goals
          </Link>
        </p>
      )}
    </div>
  );
}
