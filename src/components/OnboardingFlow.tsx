import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Home, TrendingUp, DollarSign, MapPin, Users, CloudSun, Shield } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
  initialData?: any;
}

const TOTAL_STEPS = 5;

export function OnboardingFlow({ onComplete, initialData }: OnboardingFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Buyer type & goal
  const [buyerType, setBuyerType] = useState<string>(initialData?.buyer_type || "regular-buyer");

  // Step 2: Budget & financials
  const [budgetMin, setBudgetMin] = useState(initialData?.budget_min?.toString() || "");
  const [budgetMax, setBudgetMax] = useState(initialData?.budget_max?.toString() || "");
  const [desiredPayment, setDesiredPayment] = useState(initialData?.desired_monthly_payment?.toString() || "");
  const [riskLevel, setRiskLevel] = useState<string>(initialData?.risk_level || "moderate");

  // Step 3: Investment profile
  const [investmentStrategy, setInvestmentStrategy] = useState<string>(initialData?.investment_strategy || "");
  const [holdPeriod, setHoldPeriod] = useState(initialData?.hold_period_years?.toString() || "");
  const [financingPreference, setFinancingPreference] = useState<string>(initialData?.financing_preference || "");

  // Step 4: Property types & locations
  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialData?.property_types || []);
  const [locations, setLocations] = useState(
    Array.isArray(initialData?.location_preferences) ? initialData.location_preferences.join(", ") : ""
  );
  const [minBathrooms, setMinBathrooms] = useState(initialData?.min_bathrooms?.toString() || "");
  const [mustHaveFeatures, setMustHaveFeatures] = useState<string[]>(initialData?.must_have_features || []);
  const [commuteTime, setCommuteTime] = useState(
    (initialData?.commute_preferences as any)?.max_commute_minutes?.toString() || ""
  );
  const [walkability, setWalkability] = useState<string>(
    (initialData?.commute_preferences as any)?.walkability_preference || "moderate"
  );

  // Step 5: Lifestyle
  const [hasChildren, setHasChildren] = useState<boolean>(initialData?.has_children || false);
  const [childrenAges, setChildrenAges] = useState<string[]>(initialData?.children_ages || []);
  const [climatePreference, setClimatePreference] = useState<string>(initialData?.climate_preference || "");
  const [safetyPriority, setSafetyPriority] = useState<string>(initialData?.safety_priority || "");

  const propertyTypeOptions = [
    { value: "condo", label: "Condo" },
    { value: "townhome", label: "Townhome" },
    { value: "single-family", label: "Single Family" },
    { value: "multi-family", label: "Multi-Family" },
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

  const handleToggle = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const locationArray = locations.split(",").map(l => l.trim()).filter(Boolean);

      const { error } = await supabase
        .from("profiles")
        .update({
          buyer_type: buyerType,
          budget_min: budgetMin ? parseFloat(budgetMin) : null,
          budget_max: budgetMax ? parseFloat(budgetMax) : null,
          desired_monthly_payment: desiredPayment ? parseFloat(desiredPayment) : null,
          risk_level: riskLevel,
          property_types: propertyTypes,
          location_preferences: locationArray,
          commute_preferences: {
            max_commute_minutes: commuteTime ? parseInt(commuteTime) : null,
            walkability_preference: walkability,
          },
          investment_strategy: investmentStrategy || null,
          hold_period_years: holdPeriod ? parseInt(holdPeriod) : null,
          financing_preference: financingPreference || null,
          min_bathrooms: minBathrooms ? parseInt(minBathrooms) : null,
          must_have_features: mustHaveFeatures.length > 0 ? mustHaveFeatures : null,
          has_children: hasChildren,
          children_ages: hasChildren && childrenAges.length > 0 ? childrenAges : null,
          climate_preference: climatePreference || null,
          safety_priority: safetyPriority || null,
          onboarding_completed: true,
        } as any)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile saved!",
        description: "Your preferences have been saved successfully.",
      });

      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to HomeLens! 🏡</CardTitle>
          <CardDescription>
            Let's personalize your experience (Step {step} of {TOTAL_STEPS})
            <br />
            <span className="text-xs">Share as much or as little as you'd like — all fields are optional.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Buyer Type */}
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                What type of buyer are you?
              </Label>
              <RadioGroup value={buyerType} onValueChange={setBuyerType}>
                {[
                  { value: "first-time-buyer", label: "First-Time Buyer 🏠", desc: "Looking to buy my first home" },
                  { value: "investor", label: "Investor 💰", desc: "Looking for investment opportunities" },
                  { value: "regular-buyer", label: "Regular Buyer 🏡", desc: "Looking to buy a home" },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="cursor-pointer flex-1">
                      {opt.label}
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Budget & Financials */}
          {step === 2 && (
            <div className="space-y-4">
              <Label className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget & Payment Preferences
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budgetMin">Minimum Budget</Label>
                  <Input id="budgetMin" type="number" placeholder="$200,000" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="budgetMax">Maximum Budget</Label>
                  <Input id="budgetMax" type="number" placeholder="$500,000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="payment">Desired Monthly Payment</Label>
                <Input id="payment" type="number" placeholder="$2,500" value={desiredPayment} onChange={(e) => setDesiredPayment(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Risk Level
                </Label>
                <RadioGroup value={riskLevel} onValueChange={setRiskLevel}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="conservative" id="conservative" />
                    <Label htmlFor="conservative">Conservative - Safe & stable</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate">Moderate - Balanced approach</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="aggressive" id="aggressive" />
                    <Label htmlFor="aggressive">Aggressive - Higher risk, higher reward</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 3: Investment Profile */}
          {step === 3 && (
            <div className="space-y-4">
              <Label className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Investment Profile
              </Label>
              <p className="text-sm text-muted-foreground">Help us tailor investment insights to your strategy.</p>

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
                <Input id="holdPeriod" type="number" placeholder="5" value={holdPeriod} onChange={(e) => setHoldPeriod(e.target.value)} />
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
            </div>
          )}

          {/* Step 4: Property Types & Locations */}
          {step === 4 && (
            <div className="space-y-4">
              <Label className="text-lg">Property Types</Label>
              <div className="grid grid-cols-2 gap-3">
                {propertyTypeOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer" onClick={() => handleToggle(propertyTypes, setPropertyTypes, option.value)}>
                    <Checkbox checked={propertyTypes.includes(option.value)} onCheckedChange={() => handleToggle(propertyTypes, setPropertyTypes, option.value)} />
                    <Label className="cursor-pointer">{option.label}</Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Preferences
                </Label>
                <Input placeholder="Arlington, Alexandria, Washington DC" value={locations} onChange={(e) => setLocations(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commute">Max Commute (min)</Label>
                  <Input id="commute" type="number" placeholder="30" value={commuteTime} onChange={(e) => setCommuteTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="minBaths">Min Bathrooms</Label>
                  <Input id="minBaths" type="number" placeholder="2" value={minBathrooms} onChange={(e) => setMinBathrooms(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Must-Have Features</Label>
                <div className="grid grid-cols-2 gap-2">
                  {featureOptions.map((f) => (
                    <div key={f.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer" onClick={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)}>
                      <Checkbox checked={mustHaveFeatures.includes(f.value)} onCheckedChange={() => handleToggle(mustHaveFeatures, setMustHaveFeatures, f.value)} />
                      <Label className="cursor-pointer text-sm">{f.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Walkability Preference</Label>
                <RadioGroup value={walkability} onValueChange={setWalkability}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="walk-low" />
                    <Label htmlFor="walk-low">Low - Car-dependent is fine</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="walk-mod" />
                    <Label htmlFor="walk-mod">Moderate - Some walkability</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="walk-high" />
                    <Label htmlFor="walk-high">High - Very walkable</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Step 5: Lifestyle */}
          {step === 5 && (
            <div className="space-y-6">
              <Label className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lifestyle & Family
              </Label>
              <p className="text-sm text-muted-foreground">This helps us prioritize schools, safety, and climate in our recommendations.</p>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Do you have children?</Label>
                  <p className="text-sm text-muted-foreground">We'll prioritize school quality in recommendations</p>
                </div>
                <Switch checked={hasChildren} onCheckedChange={setHasChildren} />
              </div>

              {hasChildren && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                  <Label>Children's Age Groups</Label>
                  <div className="space-y-2">
                    {childAgeOptions.map((opt) => (
                      <div key={opt.value} className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer" onClick={() => handleToggle(childrenAges, setChildrenAges, opt.value)}>
                        <Checkbox checked={childrenAges.includes(opt.value)} onCheckedChange={() => handleToggle(childrenAges, setChildrenAges, opt.value)} />
                        <Label className="cursor-pointer text-sm">{opt.label}</Label>
                      </div>
                    ))}
                  </div>
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
                    <RadioGroupItem value="high" id="safety-high" />
                    <Label htmlFor="safety-high">High - Top priority, very low crime areas</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="safety-mod" />
                    <Label htmlFor="safety-mod">Moderate - Balanced with other factors</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="safety-low" />
                    <Label htmlFor="safety-low">Low - Not a major factor</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step < TOTAL_STEPS && (
                <Button variant="ghost" onClick={() => setStep(step + 1)}>
                  Skip
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button onClick={() => setStep(step + 1)}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Saving..." : "Complete Setup"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
