import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";
import { PreferencesChat } from "@/components/console/PreferencesChat";
import { Navigation } from "@/components/Navigation";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSaveAndContinue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      if (error) throw error;

      toast({ title: "Welcome to HomeLens!", description: "Your preferences have been saved." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 pb-24 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-4">
            <Home className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Set Up Your Profile</h1>
          <p className="text-lg text-muted-foreground">
            Have a personalized experience with HomeLens.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            All fields are optional — you can always update them later.
          </p>
        </div>

        <PreferencesChat
          onSaveComplete={handleSaveAndContinue}
          continueLabel="Save and continue"
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
