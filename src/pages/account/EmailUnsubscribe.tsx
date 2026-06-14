import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already_used" | "invalid" | "confirming" | "done" | "error";

export default function EmailUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
          body: undefined,
          method: "GET" as never,
          // Supabase JS sdk doesn't support GET params on invoke; use direct fetch instead.
        } as never);
        // Fallback to direct fetch — see below.
        if (error) throw error;
        if ((data as { valid?: boolean }).valid === false) setStatus("invalid");
        else if ((data as { alreadyUsed?: boolean }).alreadyUsed) setStatus("already_used");
        else setStatus("valid");
      } catch {
        // Fallback using fetch directly.
        try {
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
          const res = await fetch(url, {
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
          });
          const body = await res.json();
          if (body.valid === false) setStatus("invalid");
          else if (body.alreadyUsed) setStatus("already_used");
          else setStatus("valid");
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      }
    })();
  }, [token]);

  async function confirm() {
    setStatus("confirming");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pt-24 pb-12">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Email preferences</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Manage how HomeLens emails you.
        </p>

        {status === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking your link…
          </div>
        )}

        {status === "invalid" && (
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">This unsubscribe link is invalid.</div>
              <div className="text-sm text-muted-foreground mt-1">It may have expired. You can adjust email preferences from your account.</div>
            </div>
          </div>
        )}

        {status === "already_used" && (
          <div className="flex items-start gap-3 text-foreground">
            <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">You're already unsubscribed.</div>
              <div className="text-sm text-muted-foreground mt-1">No further action needed.</div>
            </div>
          </div>
        )}

        {status === "valid" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Click below to unsubscribe from all HomeLens emails. You can re-enable specific
              emails any time from your account.
            </p>
            <Button onClick={confirm} className="w-full">Unsubscribe me from all emails</Button>
          </div>
        )}

        {status === "confirming" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Updating your preferences…
          </div>
        )}

        {status === "done" && (
          <div className="flex items-start gap-3 text-foreground">
            <CheckCircle2 className="h-5 w-5 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">You're unsubscribed.</div>
              <div className="text-sm text-muted-foreground mt-1">
                You won't receive any more emails from HomeLens.
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Something went wrong.</div>
              {error && <div className="text-sm text-muted-foreground mt-1">{error}</div>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}