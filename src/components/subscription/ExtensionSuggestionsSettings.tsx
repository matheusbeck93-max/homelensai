import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Chrome } from "lucide-react";

/**
 * Toggle for the Chrome extension's Smart Preference Follow-ups.
 * When off, the extension popup hides all follow-up cards.
 */
export function ExtensionSuggestionsSettings() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("extension_smart_suggestions_enabled")
        .eq("id", user.id)
        .single();
      if (data) setEnabled(data.extension_smart_suggestions_enabled ?? true);
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ extension_smart_suggestions_enabled: next })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setEnabled(!next);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Chrome className="h-5 w-5" />
          Chrome Extension
        </CardTitle>
        <CardDescription>
          Control HomeLens behavior inside the Chrome extension.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-medium">Smart preference suggestions</h3>
            <p className="text-sm text-muted-foreground">
              When a listing doesn't match your saved preferences, the extension can offer one-tap
              updates (e.g. "Add Fort Washington, MD to your locations"). Turn this off to hide them.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading || saving}
            aria-label="Toggle smart preference suggestions"
          />
        </div>
      </CardContent>
    </Card>
  );
}