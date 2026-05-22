import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { MapPin, DollarSign, TrendingUp, Users, CloudSun, Shield, Plus, X, MessageSquare, Save } from "lucide-react";
import { PrimaryGoalSelector } from "@/components/console/PrimaryGoalSelector";
import { CityAutocomplete } from "@/components/console/CityAutocomplete";

const PERSONA_OPTIONS = [
  { value: "first_time_buyer", label: "First-time Buyer" },
  { value: "move_up_buyer", label: "Move-up Buyer" },
  { value: "investor", label: "Investor" },
  { value: "downsizer", label: "Downsizer" },
  { value: "relocator", label: "Relocator" },
];

const STRATEGY_OPTIONS = [
  { value: "primary_residence", label: "Primary Residence" },
  { value: "buy_and_hold", label: "Buy & Hold (Rental)" },
  { value: "flip", label: "Fix & Flip" },
  { value: "vacation_home", label: "Vacation Home" },
  { value: "brrrr", label: "BRRRR Strategy" },
  { value: "house_hack", label: "House Hacking" },
];

const FINANCING_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "conventional", label: "Conventional Loan" },
  { value: "fha", label: "FHA Loan" },
  { value: "va", label: "VA Loan" },
  { value: "usda", label: "USDA Loan" },
  { value: "hard_money", label: "Hard Money" },
];

const featureOptions = [
  { value: "garage", label: "Garage" },
  { value: "pool", label: "Pool" },
  { value: "yard", label: "Yard" },
  { value: "basement", label: "Basement" },
  { value: "central-ac", label: "Central A/C" },
  { value: "updated-kitchen", label: "Updated Kitchen" },
  { value: "home-office", label: "Home Office" },
  { value: "open-floor-plan", label: "Open Floor Plan" },
];

const childAgeOptions = [
  { value: "infant", label: "Infant (0-2)" },
  { value: "toddler", label: "Toddler (3-5)" },
  { value: "elementary", label: "Elementary (6-10)" },
  { value: "middle-school", label: "Middle School (11-13)" },
  { value: "high-school", label: "High School (14-18)" },
];

interface PreferencesPanelProps {
  /** If true, hides save button (parent handles saving) */
  embedded?: boolean;
  /** Called with preference data when save is triggered in embedded mode */
  onSave?: (data: any) => void;
  /** Show the Primary Goal selector */
  showPrimaryGoal?: boolean;
  /** Show Default Search Preferences (cities, personas, budget) */
  showSearchPrefs?: boolean;
}

export function PreferencesPanel({ embedded = false, onSave, showPrimaryGoal = true, showSearchPrefs = true }: PreferencesPanelProps) {
  const [loading, setLoading] = useState(false);

  // Multi-value cities
  const [cities, setCities] = useState<{ city: string; state: string }[]>([{ city: "", state: "" }]);
  const [buyerTypes, setBuyerTypes] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [investmentStrategies, setInvestmentStrategies] = useState<string[]>([]);
  const [holdPeriod, setHoldPeriod] = useState("");
  const [financingPreferences, setFinancingPreferences] = useState<string[]>([]);
  const [minBedrooms, setMinBedrooms] = useState("");
  const [minBathrooms, setMinBathrooms] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [mustHaveFeatures, setMustHaveFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [hasChildren, setHasChildren] = useState(false);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [climatePreference, setClimatePreference] = useState("");
  const [safetyPriority, setSafetyPriority] = useState("");
  const [aboutMe, setAboutMe] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleToggle = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      const p = profile as any;
      if (p.preferred_cities && p.preferred_cities.length > 0) {
        setCities(p.preferred_cities.map((c: string) => {
          const parts = c.split(", ");
          return { city: parts[0] || "", state: parts[1] || "" };
        }));
      } else if (p.location_preferences) {
        const loc = p.location_preferences as any;
        if (loc.city || loc.state) {
          setCities([{ city: loc.city || "", state: loc.state || "" }]);
        }
      }

      if (p.buyer_types && p.buyer_types.length > 0) {
        setBuyerTypes(p.buyer_types);
      } else if (p.buyer_type && p.buyer_type !== "unspecified") {
        setBuyerTypes([p.buyer_type]);
      }

      setBudgetMin(p.budget_min?.toString() || "");
      setBudgetMax(p.budget_max?.toString() || "");

      if (p.investment_strategies && p.investment_strategies.length > 0) {
        setInvestmentStrategies(p.investment_strategies);
      } else if (p.investment_strategy) {
        setInvestmentStrategies([p.investment_strategy]);
      }

      setHoldPeriod(p.hold_period_years?.toString() || "");

      if (p.financing_preferences && p.financing_preferences.length > 0) {
        setFinancingPreferences(p.financing_preferences);
      } else if (p.financing_preference) {
        setFinancingPreferences([p.financing_preference]);
      }

      setMinBathrooms(p.min_bathrooms?.toString() || "");
      setMinBedrooms(p.min_bedrooms?.toString() || "");
      setMinSqft(p.min_sqft?.toString() || "");
      setMaxSqft(p.max_sqft?.toString() || "");
      setMustHaveFeatures(p.must_have_features || []);
      setHasChildren(p.has_children || false);
      setChildrenAges(p.children_ages || []);
      setClimatePreference(p.climate_preference || "");
      setSafetyPriority(p.safety_priority || "");
      setAboutMe(p.about_me || "");
    }
  };

  const buildUpdatePayload = () => {
    const validCities = cities.filter(c => c.city.trim() || c.state.trim());
    const preferredCities = validCities.map(c => `${c.city.trim()}, ${c.state.trim().toUpperCase()}`);

    // Legacy buyer_type column has a CHECK constraint allowing only
    // 'investor' | 'first-time-buyer' | 'regular-buyer'. Map the new persona
    // values to that set, fall back to null for unsupported personas.
    const LEGACY_BUYER_TYPE_MAP: Record<string, string> = {
      investor: "investor",
      first_time_buyer: "first-time-buyer",
    };
    const legacyBuyerType = buyerTypes[0] ? (LEGACY_BUYER_TYPE_MAP[buyerTypes[0]] ?? null) : null;

    const updates: any = {
      buyer_type: legacyBuyerType,
      buyer_types: buyerTypes.length > 0 ? buyerTypes : null,
      budget_min: budgetMin ? parseInt(budgetMin) : null,
      budget_max: budgetMax ? parseInt(budgetMax) : null,
      investment_strategy: investmentStrategies[0] || null,
      investment_strategies: investmentStrategies.length > 0 ? investmentStrategies : null,
      hold_period_years: holdPeriod ? parseInt(holdPeriod) : null,
      financing_preference: financingPreferences[0] || null,
      financing_preferences: financingPreferences.length > 0 ? financingPreferences : null,
      min_bathrooms: minBathrooms ? parseInt(minBathrooms) : null,
      min_bedrooms: minBedrooms ? parseInt(minBedrooms) : null,
      min_sqft: minSqft ? parseInt(minSqft) : null,
      max_sqft: maxSqft ? parseInt(maxSqft) : null,
      must_have_features: mustHaveFeatures.length > 0 ? mustHaveFeatures : null,
      has_children: hasChildren,
      children_ages: hasChildren && childrenAges.length > 0 ? childrenAges : null,
      climate_preference: climatePreference || null,
      safety_priority: safetyPriority || null,
      preferred_cities: preferredCities.length > 0 ? preferredCities : null,
      about_me: aboutMe.trim() || null,
    };

    if (validCities.length > 0) {
      updates.location_preferences = { city: validCities[0].city, state: validCities[0].state };
    }

    return updates;
  };

  const handleSave = async () => {
    if (embedded && onSave) {
      onSave(buildUpdatePayload());
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update(buildUpdatePayload())
        .eq("id", user.id);

      if (error) throw error;
      toast({ title: "Success", description: "Preferences updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Multi-value helpers
  const addCity = () => setCities(prev => [...prev, { city: "", state: "" }]);
  const removeCity = (i: number) => setCities(prev => prev.filter((_, idx) => idx !== i));
  const updateCity = (i: number, field: "city" | "state", value: string) => {
    setCities(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const addToList = (list: string[], setter: (v: string[]) => void) => {
    setter([...list, ""]);
  };
  const removeFromList = (list: string[], setter: (v: string[]) => void, i: number) => {
    setter(list.filter((_, idx) => idx !== i));
  };
  const updateInList = (list: string[], setter: (v: string[]) => void, i: number, value: string) => {
    setter(list.map((v, idx) => idx === i ? value : v));
  };

  const addCustomFeature = () => {
    const trimmed = customFeature.trim();
    if (trimmed && !mustHaveFeatures.includes(trimmed.toLowerCase().replace(/\s+/g, '-'))) {
      setMustHaveFeatures(prev => [...prev, trimmed.toLowerCase().replace(/\s+/g, '-')]);
      setCustomFeature("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Goal */}
      {showPrimaryGoal && <PrimaryGoalSelector />}

      {/* Default Search Preferences */}
      {showSearchPrefs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Default Search Preferences
            </CardTitle>
            <CardDescription>Set default values for your property searches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preferred Cities</Label>
              {cities.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CityAutocomplete
                    city={c.city}
                    state={c.state}
                    onChange={(city, state) => {
                      setCities(prev => prev.map((cc, idx) => idx === i ? { city, state } : cc));
                    }}
                  />
                  {cities.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeCity(i)} className="shrink-0">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCity} className="mt-1">
                <Plus className="h-3 w-3 mr-1" /> Add City
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Buyer Persona(s)</Label>
              {(buyerTypes.length === 0 ? [""] : buyerTypes).map((bt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={bt || ""} onValueChange={(val) => { buyerTypes.length === 0 ? setBuyerTypes([val]) : updateInList(buyerTypes, setBuyerTypes, i, val); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select persona..." /></SelectTrigger>
                    <SelectContent>
                      {PERSONA_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {buyerTypes.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeFromList(buyerTypes, setBuyerTypes, i)} className="shrink-0">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addToList(buyerTypes, setBuyerTypes)} className="mt-1">
                <Plus className="h-3 w-3 mr-1" /> Add Persona
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pref-budgetMin">Min Budget</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input id="pref-budgetMin" type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="200000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-budgetMax">Max Budget</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input id="pref-budgetMax" type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="500000" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pref-minBeds">Min Bedrooms</Label>
                <Input id="pref-minBeds" type="number" min={0} value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} placeholder="3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-minBaths">Min Bathrooms</Label>
                <Input id="pref-minBaths" type="number" min={0} value={minBathrooms} onChange={(e) => setMinBathrooms(e.target.value)} placeholder="2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pref-minSqft">Min Sqft</Label>
                <Input id="pref-minSqft" type="number" min={0} value={minSqft} onChange={(e) => setMinSqft(e.target.value)} placeholder="1200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pref-maxSqft">Max Sqft</Label>
                <Input id="pref-maxSqft" type="number" min={0} value={maxSqft} onChange={(e) => setMaxSqft(e.target.value)} placeholder="3000" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Investment Profile
          </CardTitle>
          <CardDescription>Tailor investment analysis to your strategy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Investment Strategy</Label>
            {(investmentStrategies.length === 0 ? [""] : investmentStrategies).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={s || ""} onValueChange={(val) => { investmentStrategies.length === 0 ? setInvestmentStrategies([val]) : updateInList(investmentStrategies, setInvestmentStrategies, i, val); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select strategy..." /></SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                {investmentStrategies.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeFromList(investmentStrategies, setInvestmentStrategies, i)} className="shrink-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addToList(investmentStrategies, setInvestmentStrategies)} className="mt-1">
              <Plus className="h-3 w-3 mr-1" /> Add Strategy
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pref-holdPeriod">Hold Period (years)</Label>
            <Input id="pref-holdPeriod" type="number" value={holdPeriod} onChange={(e) => setHoldPeriod(e.target.value)} placeholder="5" />
          </div>

          <div className="space-y-2">
            <Label>Financing Preference</Label>
            {(financingPreferences.length === 0 ? [""] : financingPreferences).map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={f || ""} onValueChange={(val) => { financingPreferences.length === 0 ? setFinancingPreferences([val]) : updateInList(financingPreferences, setFinancingPreferences, i, val); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select financing..." /></SelectTrigger>
                  <SelectContent>
                    {FINANCING_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                {financingPreferences.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeFromList(financingPreferences, setFinancingPreferences, i)} className="shrink-0">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => addToList(financingPreferences, setFinancingPreferences)} className="mt-1">
              <Plus className="h-3 w-3 mr-1" /> Add Financing Option
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Must-Have Features */}
      <Card>
        <CardHeader>
          <CardTitle>Must-Have Features</CardTitle>
          <CardDescription>Select features you consider essential</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {featureOptions.map((f) => (
              <div key={f.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer" onClick={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)}>
                <Checkbox checked={mustHaveFeatures.includes(f.value)} onCheckedChange={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)} />
                <Label className="cursor-pointer text-sm">{f.label}</Label>
              </div>
            ))}
          </div>

          {mustHaveFeatures.filter(f => !featureOptions.find(o => o.value === f)).length > 0 && (
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Custom features:</Label>
              <div className="flex flex-wrap gap-2">
                {mustHaveFeatures.filter(f => !featureOptions.find(o => o.value === f)).map(f => (
                  <div key={f} className="flex items-center gap-1 bg-accent rounded-full px-3 py-1 text-sm">
                    {f.replace(/-/g, ' ')}
                    <button onClick={() => setMustHaveFeatures(prev => prev.filter(x => x !== f))} className="ml-1 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input value={customFeature} onChange={(e) => setCustomFeature(e.target.value)} placeholder="Add a custom feature..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomFeature())} className="flex-1" />
            <Button variant="outline" size="sm" onClick={addCustomFeature} disabled={!customFeature.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lifestyle & Family */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lifestyle & Family
          </CardTitle>
          <CardDescription>Helps us prioritize schools, safety, and climate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">Do you have children?</Label>
              <p className="text-sm text-muted-foreground">We'll prioritize school quality</p>
            </div>
            <Switch checked={hasChildren} onCheckedChange={setHasChildren} />
          </div>

          {hasChildren && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label>Children's Age Groups</Label>
              {childAgeOptions.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer" onClick={() => handleToggle(childrenAges, setChildrenAges, opt.value)}>
                  <Checkbox checked={childrenAges.includes(opt.value)} onCheckedChange={() => handleToggle(childrenAges, setChildrenAges, opt.value)} />
                  <Label className="cursor-pointer text-sm">{opt.label}</Label>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CloudSun className="h-4 w-4" />
              Climate Preference
            </Label>
            <Select value={climatePreference} onValueChange={setClimatePreference}>
              <SelectTrigger><SelectValue placeholder="Select climate..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm (Sun Belt)</SelectItem>
                <SelectItem value="cold">Cold (Northeast/Midwest)</SelectItem>
                <SelectItem value="moderate">Moderate (Pacific NW, Mid-Atlantic)</SelectItem>
                <SelectItem value="no_preference">No Preference</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Safety Priority
            </Label>
            <RadioGroup value={safetyPriority} onValueChange={setSafetyPriority}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="pref-sp-high" />
                <Label htmlFor="pref-sp-high">High - Very low crime areas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="pref-sp-mod" />
                <Label htmlFor="pref-sp-mod">Moderate - Balanced</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="pref-sp-low" />
                <Label htmlFor="pref-sp-low">Low - Not a major factor</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* About You */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            What should I know about you?
          </CardTitle>
          <CardDescription>Share anything that helps the AI give you better, more personalized analysis and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder="E.g., I'm a military veteran relocating to Texas with my family. I work remotely and need a home office. I'm interested in multi-family properties for house hacking..."
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Save button */}
      {!embedded && (
        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Save All Preferences
        </Button>
      )}
      {embedded && (
        <Button onClick={handleSave} disabled={loading} className="w-full" data-profile-setup-save>
          <Save className="mr-2 h-4 w-4" />
          Save & Continue
        </Button>
      )}
    </div>
  );
}
