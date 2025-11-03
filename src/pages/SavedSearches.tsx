import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, BellOff, Search, Trash2, Calendar, ArrowLeft, Save } from "lucide-react";

interface SavedSearch {
  id: string;
  query_text: string;
  filters_json: any;
  alert_enabled: boolean;
  alert_frequency: string;
  last_alert_sent: string | null;
  created_at: string;
}

export default function SavedSearches() {
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
      if (!user) {
        navigate("/auth");
        return;
      }

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
    navigate(`/chat?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto py-8 px-4 pt-24">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            <h1 className="text-4xl font-bold mb-2">Saved Searches & Alerts</h1>
            <p className="text-muted-foreground">
              Manage your saved property searches and get notified of new listings
            </p>
          </div>
          <Button onClick={() => navigate("/chat")}>
            <Search className="h-4 w-4 mr-2" />
            New Search
          </Button>
        </div>

        {searches.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No Saved Searches"
            description="Start a property search and save it to get notified when new matching properties become available."
            actionLabel="Start Your First Search"
            onAction={() => navigate("/chat")}
          />
        ) : (
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
                          Alerts On
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <BellOff className="h-3 w-3 mr-1" />
                          Alerts Off
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters Display */}
                  {search.filters_json && (
                    <div className="flex flex-wrap gap-2">
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

                  {/* Alert Controls */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={search.alert_enabled}
                        onCheckedChange={() => toggleAlert(search.id, search.alert_enabled)}
                      />
                      <div>
                        <p className="font-medium text-sm">Email Alerts</p>
                        <p className="text-xs text-muted-foreground">
                          Get notified when new properties match this search
                        </p>
                      </div>
                    </div>
                    {search.alert_enabled && (
                      <Select
                        value={search.alert_frequency}
                        onValueChange={(value) => updateAlertFrequency(search.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {search.last_alert_sent && (
                    <p className="text-xs text-muted-foreground">
                      Last alert sent: {new Date(search.last_alert_sent).toLocaleString()}
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
                          <AlertDialogTitle>Delete saved search?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the search and stop all alerts. This action cannot be undone.
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
        )}
      </div>
    </div>
  );
}
