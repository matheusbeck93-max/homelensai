import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Key } from "lucide-react";

interface MapboxTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenSaved: (token: string) => void;
}

export function MapboxTokenDialog({ open, onOpenChange, onTokenSaved }: MapboxTokenDialogProps) {
  const [token, setToken] = useState("");
  const [existingToken, setExistingToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mapbox_public_token");
    setExistingToken(stored);
    if (stored) setToken(stored);
  }, [open]);

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem("mapbox_public_token", token.trim());
      onTokenSaved(token.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Mapbox Public Token Required
          </DialogTitle>
          <DialogDescription>
            Enter your Mapbox public token to view the interactive map with property location, schools, and amenities.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm">
              <div className="space-y-2">
                <p className="font-medium">How to get your Mapbox token:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Visit <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                    mapbox.com <ExternalLink className="h-3 w-3" />
                  </a></li>
                  <li>Sign up or log in to your account</li>
                  <li>Go to your Account → Tokens section</li>
                  <li>Copy your default public token</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Mapbox Public Token
            </label>
            <Input
              id="token"
              placeholder="pk.eyJ1..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
            {existingToken && (
              <p className="text-xs text-muted-foreground">
                Token is already saved. You can update it above.
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!token.trim()}>
              Save Token
            </Button>
          </div>

          <Alert className="mt-4">
            <AlertDescription className="text-xs">
              <p className="font-medium mb-1">🔒 For Production:</p>
              <p>Store your token securely in Project Settings → Secrets as <code className="bg-muted px-1 py-0.5 rounded">MAPBOX_PUBLIC_TOKEN</code></p>
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
