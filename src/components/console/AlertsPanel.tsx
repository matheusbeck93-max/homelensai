import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, TrendingDown, Home, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";

type AlertEvent = {
  id: string;
  type: string;
  property_id: string;
  property_snapshot: any;
  message: string;
  created_at: string;
  read: boolean;
};

type AlertPreferences = {
  enabled: boolean;
  frequency: string;
  channels: string[];
};

export function AlertsPanel() {
  const { tier, userId } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<AlertPreferences>({
    enabled: true,
    frequency: "daily",
    channels: ["email", "in_app"],
  });
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const hasAccess = tier === "pro" || tier === "premium";

  useEffect(() => {
    if (userId && hasAccess) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [userId, hasAccess]);

  const loadData = async () => {
    if (!userId) return;

    try {
      // Load preferences
      const { data: prefsData } = await supabase
        .from("alert_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefsData) {
        setPreferences({
          enabled: prefsData.enabled,
          frequency: prefsData.frequency,
          channels: prefsData.channels as string[],
        });
      } else {
        // Create default preferences
        await supabase.from("alert_preferences").insert({
          user_id: userId,
          enabled: true,
          frequency: "daily",
          channels: ["email", "in_app"],
        });
      }

      // Load recent events
      const { data: eventsData } = await supabase
        .from("alert_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      setEvents(eventsData || []);
    } catch (error) {
      console.error("Error loading alert data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<AlertPreferences>) => {
    if (!userId) return;

    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);

    try {
      await supabase
        .from("alert_preferences")
        .upsert({
          user_id: userId,
          enabled: newPrefs.enabled,
          frequency: newPrefs.frequency,
          channels: newPrefs.channels,
          updated_at: new Date().toISOString(),
        });

      toast.success("Alert preferences updated");
    } catch (error) {
      console.error("Error updating preferences:", error);
      toast.error("Failed to update preferences");
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      await supabase
        .from("alert_events")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      setEvents(events.map((e) => ({ ...e, read: true })));
      toast.success("All alerts marked as read");
    } catch (error) {
      console.error("Error marking alerts as read:", error);
      toast.error("Failed to mark alerts as read");
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "price_drop":
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      case "status_change":
        return <Bell className="w-4 h-4 text-blue-500" />;
      case "new_match":
        return <Home className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <>
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Bell className="w-8 h-8 text-primary" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Smart Alerts (Pro feature)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get notified when your favorite homes change price or when new properties match
                your searches.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Available with HomeLens Pro & Premium.
              </p>
              <Button onClick={() => setUpgradeModalOpen(true)}>Upgrade to Pro</Button>
            </div>
          </div>
        </Card>
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          feature="Smart Alerts"
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings panel */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Smart Alerts Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="alerts-enabled">Enable Smart Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Monitor favorites and searches for changes
              </p>
            </div>
            <Switch
              id="alerts-enabled"
              checked={preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Alert Frequency</Label>
            <Select
              value={preferences.frequency}
              onValueChange={(value) => updatePreferences({ frequency: value })}
            >
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Alert Channels</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="email-alerts"
                  checked={preferences.channels.includes("email")}
                  onCheckedChange={(checked) => {
                    const newChannels = checked
                      ? [...preferences.channels, "email"]
                      : preferences.channels.filter((c) => c !== "email");
                    updatePreferences({ channels: newChannels });
                  }}
                />
                <Label htmlFor="email-alerts" className="cursor-pointer">
                  Email alerts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="in-app-alerts"
                  checked={preferences.channels.includes("in_app")}
                  onCheckedChange={(checked) => {
                    const newChannels = checked
                      ? [...preferences.channels, "in_app"]
                      : preferences.channels.filter((c) => c !== "in_app");
                    updatePreferences({ channels: newChannels });
                  }}
                />
                <Label htmlFor="in-app-alerts" className="cursor-pointer">
                  In-app alerts
                </Label>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Smart Alerts monitor your favorites and saved searches for price drops, status changes,
            and new matches.
          </p>
        </div>
      </Card>

      {/* Events list */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Alerts</h3>
          {events.some((e) => !e.read) && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No alerts yet. We'll notify you when there are changes to your favorites or new matches
            for your searches.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  event.read ? "bg-background/50" : "bg-primary/5 border-primary/20"
                }`}
              >
                {getEventIcon(event.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.message}</p>
                  {event.property_snapshot?.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.property_snapshot.address}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(event.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/property/${event.property_id}`)}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}