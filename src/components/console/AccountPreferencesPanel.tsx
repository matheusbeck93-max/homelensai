import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Save, Trash2, AlertTriangle, MapPin, DollarSign, TrendingUp, Users, CloudSun, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PrimaryGoalSelector } from "@/components/console/PrimaryGoalSelector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AccountPreferencesPanel() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultState, setDefaultState] = useState("");
  const [defaultPersona, setDefaultPersona] = useState<string>("unspecified");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  // New fields
  const [investmentStrategy, setInvestmentStrategy] = useState("");
  const [holdPeriod, setHoldPeriod] = useState("");
  const [financingPreference, setFinancingPreference] = useState("");
  const [minBathrooms, setMinBathrooms] = useState("");
  const [mustHaveFeatures, setMustHaveFeatures] = useState<string[]>([]);
  const [hasChildren, setHasChildren] = useState(false);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [climatePreference, setClimatePreference] = useState("");
  const [safetyPriority, setSafetyPriority] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

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

  const handleToggle = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || user.email || "");
      
      if (profile.location_preferences) {
        const loc = profile.location_preferences as any;
        setDefaultCity(loc.city || "");
        setDefaultState(loc.state || "");
      }
      
      setDefaultPersona(profile.buyer_type || "unspecified");
      setBudgetMin(profile.budget_min?.toString() || "");
      setBudgetMax(profile.budget_max?.toString() || "");

      // Load new fields
      const p = profile as any;
      setInvestmentStrategy(p.investment_strategy || "");
      setHoldPeriod(p.hold_period_years?.toString() || "");
      setFinancingPreference(p.financing_preference || "");
      setMinBathrooms(p.min_bathrooms?.toString() || "");
      setMustHaveFeatures(p.must_have_features || []);
      setHasChildren(p.has_children || false);
      setChildrenAges(p.children_ages || []);
      setClimatePreference(p.climate_preference || "");
      setSafetyPriority(p.safety_priority || "");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates: any = {
        full_name: fullName,
        buyer_type: defaultPersona,
        budget_min: budgetMin ? parseInt(budgetMin) : null,
        budget_max: budgetMax ? parseInt(budgetMax) : null,
        investment_strategy: investmentStrategy || null,
        hold_period_years: holdPeriod ? parseInt(holdPeriod) : null,
        financing_preference: financingPreference || null,
        min_bathrooms: minBathrooms ? parseInt(minBathrooms) : null,
        must_have_features: mustHaveFeatures.length > 0 ? mustHaveFeatures : null,
        has_children: hasChildren,
        children_ages: hasChildren && childrenAges.length > 0 ? childrenAges : null,
        climate_preference: climatePreference || null,
        safety_priority: safetyPriority || null,
      };

      if (defaultCity && defaultState) {
        updates.location_preferences = { city: defaultCity, state: defaultState };
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      toast({ title: "Success", description: "Preferences updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").delete().eq("id", user.id);
      await supabase.from("conversations").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
      toast({ title: "Account deleted", description: "Your account has been successfully deleted" });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Goal */}
      <PrimaryGoalSelector />

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Input id="email" value={email} disabled className="bg-muted" />
            </div>
            <p className="text-sm text-muted-foreground">Email cannot be changed</p>
          </div>
        </CardContent>
      </Card>

      {/* Default Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Default Search Preferences
          </CardTitle>
          <CardDescription>Set default values for your property searches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultCity">Default City</Label>
              <Input id="defaultCity" value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} placeholder="e.g., Austin" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultState">Default State</Label>
              <Input id="defaultState" value={defaultState} onChange={(e) => setDefaultState(e.target.value)} placeholder="e.g., TX" maxLength={2} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultPersona">Buyer Persona</Label>
            <Select value={defaultPersona} onValueChange={setDefaultPersona}>
              <SelectTrigger id="defaultPersona"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Unspecified</SelectItem>
                <SelectItem value="first_time_buyer">First-time Buyer</SelectItem>
                <SelectItem value="move_up_buyer">Move-up Buyer</SelectItem>
                <SelectItem value="investor">Investor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budgetMin">Min Budget</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input id="budgetMin" type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="200000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetMax">Max Budget</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input id="budgetMax" type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="500000" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minBaths">Min Bathrooms</Label>
            <Input id="minBaths" type="number" value={minBathrooms} onChange={(e) => setMinBathrooms(e.target.value)} placeholder="2" />
          </div>
        </CardContent>
      </Card>

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
            <Select value={investmentStrategy} onValueChange={setInvestmentStrategy}>
              <SelectTrigger><SelectValue placeholder="Select strategy..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary_residence">Primary Residence</SelectItem>
                <SelectItem value="buy_and_hold">Buy & Hold (Rental)</SelectItem>
                <SelectItem value="flip">Fix & Flip</SelectItem>
                <SelectItem value="vacation_home">Vacation Home</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="holdPeriod">Hold Period (years)</Label>
            <Input id="holdPeriod" type="number" value={holdPeriod} onChange={(e) => setHoldPeriod(e.target.value)} placeholder="5" />
          </div>
          <div className="space-y-2">
            <Label>Financing Preference</Label>
            <Select value={financingPreference} onValueChange={setFinancingPreference}>
              <SelectTrigger><SelectValue placeholder="Select financing..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="conventional">Conventional Loan</SelectItem>
                <SelectItem value="fha">FHA Loan</SelectItem>
                <SelectItem value="va">VA Loan</SelectItem>
                <SelectItem value="usda">USDA Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Must-Have Features */}
      <Card>
        <CardHeader>
          <CardTitle>Must-Have Features</CardTitle>
          <CardDescription>Select features you consider essential</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {featureOptions.map((f) => (
              <div key={f.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer" onClick={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)}>
                <Checkbox checked={mustHaveFeatures.includes(f.value)} onCheckedChange={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)} />
                <Label className="cursor-pointer text-sm">{f.label}</Label>
              </div>
            ))}
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
                <RadioGroupItem value="high" id="sp-high" />
                <Label htmlFor="sp-high">High - Very low crime areas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="sp-mod" />
                <Label htmlFor="sp-mod">Moderate - Balanced</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="sp-low" />
                <Label htmlFor="sp-low">Low - Not a major factor</Label>
              </div>
            </RadioGroup>
          </div>

          <Button onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save All Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Theme</h3>
              <p className="text-sm text-muted-foreground">Toggle between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account
                  and remove all your data from our servers, including all your
                  conversations and settings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-sm text-muted-foreground mt-2">Once deleted, there is no way to recover your account</p>
        </CardContent>
      </Card>
    </div>
  );
}
