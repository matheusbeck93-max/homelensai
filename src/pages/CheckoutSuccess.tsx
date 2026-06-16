import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutSuccess() {
  // Refresh subscription state so gated UI unlocks immediately.
  useEffect(() => {
    supabase.functions.invoke("check-subscription").catch(() => {});
  }, []);

  return (
    <>
      <Helmet>
        <title>Subscription confirmed — HomeLens</title>
        <meta name="description" content="Your HomeLens subscription is active. Start exploring premium features." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <div className="w-full max-w-md text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">You're all set</h1>
          <p className="mt-2 text-muted-foreground">
            Your subscription is active. Premium features are unlocked across HomeLens.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/chats">Start a chat</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/console?tab=plan">
                <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                View my plan
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}