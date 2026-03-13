import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Sparkles, Lock, Calendar, DollarSign, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { UpgradeModal } from "./UpgradeModal";

export function WeeklyPicksSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [preferredDay, setPreferredDay] = useState('monday');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('2');
  const [preferredCities, setPreferredCities] = useState('');
  const { toast } = useToast();
  const { hasAccess, isPremium } = useSubscription();

  const hasWeeklyPicksAccess = hasAccess('FULL_CHAT_HISTORY');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('weekly_picks_enabled, weekly_picks_day, max_price_range, min_bedrooms, preferred_cities, budget_max')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setEnabled(data.weekly_picks_enabled ?? false);
        setPreferredDay(data.weekly_picks_day ?? 'monday');
        setMaxPrice(data.max_price_range?.toString() || data.budget_max?.toString() || '');
        setMinBedrooms(data.min_bedrooms?.toString() || '2');
        setPreferredCities(data.preferred_cities?.join(', ') || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasWeeklyPicksAccess) {
      setUpgradeModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Parse cities
      const citiesArray = preferredCities
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const { error } = await supabase
        .from('profiles')
        .update({
          weekly_picks_enabled: enabled,
          weekly_picks_day: preferredDay,
          max_price_range: maxPrice ? parseFloat(maxPrice) : null,
          min_bedrooms: minBedrooms ? parseInt(minBedrooms) : null,
          preferred_cities: citiesArray.length > 0 ? citiesArray : null
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your weekly picks preferences have been updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Weekly Property Picks
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
                <Sparkles className="h-5 w-5" />
                Weekly Property Picks
                {!hasWeeklyPicksAccess && <Badge variant="secondary">Premium</Badge>}
              </CardTitle>
              <CardDescription>
                Get AI-curated property recommendations every week
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasWeeklyPicksAccess ? (
            <div className="text-center py-8 space-y-4">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-semibold mb-2">Upgrade to Premium for Weekly Picks</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Receive personalized property recommendations every week based on your preferences and favorites
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
                    <Label htmlFor="weekly-picks-enabled" className="font-medium cursor-pointer">
                      Enable Weekly Picks
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive curated property recommendations via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="weekly-picks-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="delivery-day">Delivery Day</Label>
                </div>
                <Select value={preferredDay} onValueChange={setPreferredDay} disabled={!enabled}>
                  <SelectTrigger id="delivery-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which day you'd like to receive your picks
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="max-price">Maximum Price</Label>
                </div>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="e.g., 500000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Only show properties under this price
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="min-bedrooms">Minimum Bedrooms</Label>
                </div>
                <Select value={minBedrooms} onValueChange={setMinBedrooms} disabled={!enabled}>
                  <SelectTrigger id="min-bedrooms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1+ Bedrooms</SelectItem>
                    <SelectItem value="2">2+ Bedrooms</SelectItem>
                    <SelectItem value="3">3+ Bedrooms</SelectItem>
                    <SelectItem value="4">4+ Bedrooms</SelectItem>
                    <SelectItem value="5">5+ Bedrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred-cities">Preferred Cities (Optional)</Label>
                <Input
                  id="preferred-cities"
                  placeholder="e.g., Austin, Denver, Portland"
                  value={preferredCities}
                  onChange={(e) => setPreferredCities(e.target.value)}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of cities. Leave blank to include all cities.
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>

              {isPremium && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>How it works:</strong> Our AI analyzes your favorited properties and preferences to curate 
                    5 personalized property recommendations every {preferredDay}. Picks are tailored to match your 
                    demonstrated interests and investment goals.
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
        feature="Weekly Property Picks - AI-Curated Recommendations"
      />
    </>
  );
}
