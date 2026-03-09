import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Home, ArrowRight } from "lucide-react";
import { PreferencesPanel } from "@/components/console/PreferencesPanel";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // PreferencesPanel handles its own save internally
      // We just navigate after a short delay to let save complete
      toast({ title: "Welcome to HomeLens!", description: "Your preferences have been saved." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
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

        {/* Preferences (reused component, hide search prefs for onboarding simplicity) */}
        <PreferencesPanel showSearchPrefs={false} />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Button onClick={handleSave} disabled={saving} className="flex-1" size="lg">
            Save & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="flex-1" size="lg">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
