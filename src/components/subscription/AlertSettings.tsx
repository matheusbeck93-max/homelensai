import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, TrendingDown, RefreshCw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "./UpgradeModal";

export function AlertSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true);
  const [alertPriceDrops, setAlertPriceDrops] = useState(true);
  const [alertStatusChanges, setAlertStatusChanges] = useState(true);
  const { toast } = useToast();
  const { hasAccess, isPremium } = useSubscription();

  const hasSmartAlertsAccess = hasAccess('PROPERTY_ALERTS');

  useEffect(() => {
    loadAlertPreferences();
  }, []);

  const loadAlertPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('alert_email_enabled, alert_price_drops, alert_status_changes')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setAlertEmailEnabled(data.alert_email_enabled ?? true);
        setAlertPriceDrops(data.alert_price_drops ?? true);
        setAlertStatusChanges(data.alert_status_changes ?? true);
      }
    } catch (error) {
      console.error('Error loading alert preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (field: string, value: boolean) => {
    if (!hasSmartAlertsAccess) {
      setUpgradeModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Your alert preferences have been saved",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Revert the change on error
      if (field === 'alert_email_enabled') setAlertEmailEnabled(!value);
      if (field === 'alert_price_drops') setAlertPriceDrops(!value);
      if (field === 'alert_status_changes') setAlertStatusChanges(!value);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Smart Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Smart Alerts
                {!hasSmartAlertsAccess && <Badge variant="secondary">Premium</Badge>}
              </CardTitle>
              <CardDescription>
                Get notified when favorited properties change
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasSmartAlertsAccess ? (
            <div className="text-center py-8 space-y-4">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold mb-2">Upgrade to Premium for Smart Alerts</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Get instant email notifications when properties you love drop in price or change status
                </p>
                <Button onClick={() => setUpgradeModalOpen(true)}>
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="email-alerts" className="font-medium cursor-pointer">
                      Email Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-alerts"
                  checked={alertEmailEnabled}
                  onCheckedChange={(checked) => {
                    setAlertEmailEnabled(checked);
                    updatePreference('alert_email_enabled', checked);
                  }}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingDown className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="price-alerts" className="font-medium cursor-pointer">
                      Price Drop Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when prices decrease
                    </p>
                  </div>
                </div>
                <Switch
                  id="price-alerts"
                  checked={alertPriceDrops}
                  onCheckedChange={(checked) => {
                    setAlertPriceDrops(checked);
                    updatePreference('alert_price_drops', checked);
                  }}
                  disabled={saving || !alertEmailEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <RefreshCw className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="status-alerts" className="font-medium cursor-pointer">
                      Status Change Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when listing status changes
                    </p>
                  </div>
                </div>
                <Switch
                  id="status-alerts"
                  checked={alertStatusChanges}
                  onCheckedChange={(checked) => {
                    setAlertStatusChanges(checked);
                    updatePreference('alert_status_changes', checked);
                  }}
                  disabled={saving || !alertEmailEnabled}
                />
              </div>

              {isPremium && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>How it works:</strong> We check your favorited properties regularly for price drops and status changes. 
                    When detected, you'll receive an instant email notification.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <UpgradeModal 
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="Smart Alerts for favorited properties"
      />
    </>
  );
}
