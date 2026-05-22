import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SavePropertyInput, SavePropertyResult } from "@/hooks/useSavedProperties";

interface SavePropertyButtonProps {
  url: string;
  address: string;
  city?: string | null;
  state?: string | null;
  isSaved: boolean;
  onSave: (input: SavePropertyInput) => Promise<SavePropertyResult>;
}

/**
 * Small bookmark button shown on assistant messages that include a
 * property listing URL. Adds the property to the sidebar "Saved Properties"
 * shelf using the address as the reference label.
 */
export function SavePropertyButton({
  url,
  address,
  city,
  state,
  isSaved,
  onSave,
}: SavePropertyButtonProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (isSaved || busy) return;
    setBusy(true);
    const result = await onSave({
      propertyUrl: url,
      propertyAddress: address,
      city: city ?? null,
      state: state ?? null,
    });
    setBusy(false);
    if (result.ok) {
      toast({
        title: "Saved",
        description: `${address} added to your Saved Properties.`,
      });
    } else if (result.error === "already_saved") {
      toast({ title: "Already saved", description: address });
    } else if (result.error === "unauthorized") {
      toast({
        title: "Sign in required",
        description: "Sign in to bookmark properties.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Couldn't save",
        description: result.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 gap-2"
      onClick={handleClick}
      disabled={isSaved || busy}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isSaved ? (
        <BookmarkCheck className="h-3 w-3 fill-current" />
      ) : (
        <Bookmark className="h-3 w-3" />
      )}
      {isSaved ? "Saved" : "Save Property"}
    </Button>
  );
}