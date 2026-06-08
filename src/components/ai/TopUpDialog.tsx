import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useBudgetCap } from "@/lib/ai/budgetCap";
import { TopUpPacks } from "./TopUpPacks";

interface TopUpDialogProps {
  /** Surface label for telemetry. */
  surface?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

/**
 * Proactive top-up purchase dialog. Mounted from the Console's plan tab so
 * paid users can buy credits before they hit the cap.
 */
export function TopUpDialog({
  surface = "console_plan",
  triggerLabel = "Buy AI credits",
  triggerVariant = "outline",
}: TopUpDialogProps) {
  const cap = useBudgetCap();
  if (!cap.topup.available || cap.topup.packs.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Top up AI credits</DialogTitle>
          <DialogDescription>
            Credits are used after your daily {cap.tierDisplay} cap is reached.
            Bigger packs include a bonus. Credits expire 30 days after purchase.
          </DialogDescription>
        </DialogHeader>
        <TopUpPacks packs={cap.topup.packs} surface={surface} />
      </DialogContent>
    </Dialog>
  );
}

export default TopUpDialog;