import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";
import { PreferencesPanel } from "@/components/console/PreferencesPanel";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSaveAndContinue = async (data: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { error } = await supabase.from("profiles").update(data).eq("id", user.id);
      if (error) throw error;

      toast({ title: "Welcome to HomeLens!", description: "Your preferences have been saved." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 pb-24 max-w-2xl">
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

        {/* Preferences */}
        <PreferencesPanel embedded onSave={handleSaveAndContinue} showSearchPrefs={false} />

        {/* Skip link */}
        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
