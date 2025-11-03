import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Home, TrendingUp, DollarSign, MapPin } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [buyerType, setBuyerType] = useState<string>("regular-buyer");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [desiredPayment, setDesiredPayment] = useState("");
  const [riskLevel, setRiskLevel] = useState<string>("moderate");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState("");
  const [commuteTime, setCommuteTime] = useState("");
  const [walkability, setWalkability] = useState<string>("moderate");

  const propertyTypeOptions = [
    { value: "condo", label: "Condo" },
    { value: "townhome", label: "Townhome" },
    { value: "single-family", label: "Single Family" },
    { value: "multi-family", label: "Multi-Family" },
  ];

  const handlePropertyTypeToggle = (type: string) => {
    setPropertyTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
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
          onboarding_completed: true,
        })
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
            Let's personalize your home search experience (Step {step} of 3)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  What type of buyer are you?
                </Label>
                <RadioGroup value={buyerType} onValueChange={setBuyerType}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="first-time-buyer" id="ftb" />
                    <Label htmlFor="ftb" className="cursor-pointer flex-1">
                      First-Time Buyer 🏠
                      <p className="text-sm text-muted-foreground">Looking to buy my first home</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="investor" id="investor" />
                    <Label htmlFor="investor" className="cursor-pointer flex-1">
                      Investor 💰
                      <p className="text-sm text-muted-foreground">Looking for investment opportunities</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="regular-buyer" id="regular" />
                    <Label htmlFor="regular" className="cursor-pointer flex-1">
                      Regular Buyer 🏡
                      <p className="text-sm text-muted-foreground">Looking to buy a home</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Budget & Payment Preferences
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="budgetMin">Minimum Budget</Label>
                    <Input
                      id="budgetMin"
                      type="number"
                      placeholder="$200,000"
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="budgetMax">Maximum Budget</Label>
                    <Input
                      id="budgetMax"
                      type="number"
                      placeholder="$500,000"
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="payment">Desired Monthly Payment (optional)</Label>
                  <Input
                    id="payment"
                    type="number"
                    placeholder="$2,500"
                    value={desiredPayment}
                    onChange={(e) => setDesiredPayment(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Risk Level
                </Label>
                <RadioGroup value={riskLevel} onValueChange={setRiskLevel}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="conservative" id="conservative" />
                    <Label htmlFor="conservative">Conservative - Safe & stable investments</Label>
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

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-lg">Property Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {propertyTypeOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => handlePropertyTypeToggle(option.value)}
                    >
                      <Checkbox
                        checked={propertyTypes.includes(option.value)}
                        onCheckedChange={() => handlePropertyTypeToggle(option.value)}
                      />
                      <Label className="cursor-pointer">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Preferences
                </Label>
                <div>
                  <Label htmlFor="locations">Preferred Cities (comma-separated)</Label>
                  <Input
                    id="locations"
                    placeholder="Arlington, Alexandria, Washington DC"
                    value={locations}
                    onChange={(e) => setLocations(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="commute">Max Commute Time (minutes, optional)</Label>
                  <Input
                    id="commute"
                    type="number"
                    placeholder="30"
                    value={commuteTime}
                    onChange={(e) => setCommuteTime(e.target.value)}
                  />
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
                      <Label htmlFor="walk-mod">Moderate - Some walkability preferred</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="high" id="walk-high" />
                      <Label htmlFor="walk-high">High - Very walkable neighborhood</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Previous
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} className="ml-auto">
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="ml-auto">
                {loading ? "Saving..." : "Complete Setup"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
