import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingUrl: string;
  address?: string;
}

export function AskGrokModal({ open, onOpenChange, listingUrl, address }: Props) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState(
    `Using my HomeLens tools, analyze this listing and tell me whether to walk away, dig deeper, or make a move: ${listingUrl}\n\n` +
      (address ? `Property: ${address}\n` : "") +
      `Give me the Match Score against my profile, the two biggest risks, and a sensible offer band.`,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast({ title: "Prompt copied", description: "Paste it into Grok." });
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy it manually.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask Grok about this deal</DialogTitle>
          <DialogDescription>
            Grok talks to HomeLens through your connection. Copy this prompt and paste it into Grok.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={7}
          className="text-sm"
          aria-label="Prompt for Grok"
        />

        <p className="text-xs text-muted-foreground">
          Not connected yet? Set it up once on the{" "}
          <Link to="/integrations" className="underline underline-offset-2">
            integrations page
          </Link>
          .
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <Link to="/integrations">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Grok
            </Link>
          </Button>
          <Button onClick={copy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
