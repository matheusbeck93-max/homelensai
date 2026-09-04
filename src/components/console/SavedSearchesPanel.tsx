import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, BellOff, Search, Trash2, Calendar } from "lucide-react";
import { WatchGoalControls } from "@/components/watchGoals/WatchGoalControls";
import { GOAL_KIND_LABEL, readGoalFields } from "@/lib/watchGoals";

interface SavedSearch {
  id: string;
  query_text: string;
  filters_json: any;
  alert_enabled: boolean;
  alert_frequency: string;
  last_alert_sent: string | null;
  created_at: string;
}

export function SavedSearchesPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSearches(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading searches",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAlert = async (searchId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({ alert_enabled: !currentState })
        .eq("id", searchId);

      if (error) throw error;

      setSearches(searches.map(s => 
        s.id === searchId ? { ...s, alert_enabled: !currentState } : s
      ));

      toast({
        title: !currentState ? "Alerts enabled" : "Alerts disabled",
        description: !currentState 
          ? "You'll receive notifications when new matches are found"
          : "You won't receive alerts for this search anymore",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateAlertFrequency = async (searchId: string, frequency: string) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .update({ alert_frequency: frequency })
        .eq("id", searchId);

      if (error) throw error;

      setSearches(searches.map(s => 
        s.id === searchId ? { ...s, alert_frequency: frequency } : s
      ));

      toast({
        title: "Alert frequency updated",
        description: `You'll now receive ${frequency} alerts`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteSearch = async (searchId: string) => {
    try {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", searchId);

      if (error) throw error;

      setSearches(searches.filter(s => s.id !== searchId));

      toast({
        title: "Search deleted",
        description: "Your saved search has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const runSearch = (query: string) => {
    navigate(`/?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (searches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">No Watch Goals yet</h2>
        <p className="text-muted-foreground mb-4">
          Create a watch goal and HomeLens keeps checking live listings for you, scoring each one against your profile.
        </p>
        <Button onClick={() => navigate("/")}>Create Your First Watch Goal</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {searches.map((search) => (
        <Card key={search.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{search.query_text}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Saved on {new Date(search.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {search.alert_enabled ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100">
                    <Bell className="h-3 w-3 mr-1" />
                    Watching
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <BellOff className="h-3 w-3 mr-1" />
                    Paused
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters Display */}
            {search.filters_json && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {GOAL_KIND_LABEL[readGoalFields(search.filters_json).goalKind]}
                </Badge>
                <Badge variant="secondary">
                  Match {readGoalFields(search.filters_json).matchThreshold}/10+
                </Badge>
                {search.filters_json.price_max && (
                  <Badge variant="secondary">
                    Max Price: ${search.filters_json.price_max.toLocaleString()}
                  </Badge>
                )}
                {search.filters_json.beds_min && (
                  <Badge variant="secondary">
                    {search.filters_json.beds_min}+ beds
                  </Badge>
                )}
                {search.filters_json.city && (
                  <Badge variant="secondary">
                    {search.filters_json.city}, {search.filters_json.state}
                  </Badge>
                )}
                {search.filters_json.property_type && (
                  <Badge variant="secondary" className="capitalize">
                    {search.filters_json.property_type}
                  </Badge>
                )}
              </div>
            )}

            {/* Watch Goal controls */}
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Switch
                checked={search.alert_enabled}
                onCheckedChange={() => toggleAlert(search.id, search.alert_enabled)}
              />
              <div>
                <p className="font-medium text-sm">Watching</p>
                <p className="text-xs text-muted-foreground">
                  HomeLens checks live listings, scores them against your profile, and tells you about the strong ones.
                </p>
              </div>
            </div>

            {search.alert_enabled && (
              <WatchGoalControls
                goalId={search.id}
                filters={search.filters_json}
                cadence={search.alert_frequency}
                onFiltersChange={(filters) =>
                  setSearches((prev) =>
                    prev.map((s) => (s.id === search.id ? { ...s, filters_json: filters } : s)),
                  )
                }
                onCadenceChange={(cadence) => updateAlertFrequency(search.id, cadence)}
              />
            )}

            {search.last_alert_sent && (
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(search.last_alert_sent).toLocaleString()}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={() => runSearch(search.query_text)}
                className="flex-1"
              >
                <Search className="h-4 w-4 mr-2" />
                Run Search Again
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete watch goal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This stops the watching and removes the goal. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSearch(search.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
