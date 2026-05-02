import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, BookmarkCheck, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import {
  useSavedAnalyses,
  type SaveAnalysisInput,
} from "@/hooks/useSavedAnalyses";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  analysis: SaveAnalysisInput;
}

export function SaveAnalysisButton({ analysis }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPremium, loading: subLoading } = useSubscription();
  const { saveAnalysis, isUrlSaved } = useSavedAnalyses();
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const alreadySaved = useMemo(
    () => savedNow || isUrlSaved(analysis.propertyUrl ?? undefined),
    [savedNow, isUrlSaved, analysis.propertyUrl],
  );

  const handleClick = async () => {
    if (subLoading) return;
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }
    if (alreadySaved) return;

    setSaving(true);
    const result = await saveAnalysis(analysis);
    setSaving(false);

    if (result.ok) {
      setSavedNow(true);
      toast({
        title: "Analysis saved",
        description: "Available in Saved Analyses.",
      });
    } else if (result.error === "premium_required") {
      setShowUpgrade(true);
    } else if (result.error === "already_saved") {
      setSavedNow(true);
    } else if (result.error === "unauthorized") {
      navigate("/auth");
    } else {
      toast({
        title: "Couldn't save analysis",
        description: result.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 gap-2"
        onClick={handleClick}
        disabled={saving || alreadySaved}
        aria-label={alreadySaved ? "Analysis saved" : "Save analysis"}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : alreadySaved ? (
          <BookmarkCheck className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />
        ) : (
          <Bookmark className="h-3.5 w-3.5" />
        )}
        <span className={alreadySaved ? "text-[hsl(var(--chart-2))]" : ""}>
          {alreadySaved ? "Saved" : saving ? "Saving..." : "Save Analysis"}
        </span>
      </Button>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Premium feature
            </DialogTitle>
            <DialogDescription>
              Save Analysis is a Premium feature. Upgrade to keep your
              investment history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgrade(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setShowUpgrade(false);
                navigate("/pricing");
              }}
            >
              Upgrade to Premium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}