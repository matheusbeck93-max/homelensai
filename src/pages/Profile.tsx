import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { PreferencesChat } from "@/components/console/PreferencesChat";

import { User, LogOut, Home, DollarSign, MapPin, TrendingUp, Settings, ArrowLeft } from "lucide-react";


export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    setUser(user);

    // Fetch user profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileData);

    setLoading(false);
  };


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSaveAndContinue = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { navigate("/auth"); return; }

      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", authUser.id);
      if (error) throw error;

      toast({ title: "Welcome to HomeLens!", description: "Your preferences have been saved." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-16 w-64 mb-8" />
          <Skeleton className="h-48 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // First-time setup: show the same preferences panel as My HomeLens
  if (profile && !profile.onboarding_completed) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
      <div className="container mx-auto px-4 py-8 pb-24 max-w-5xl">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center mb-4">
              <Home className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Set Up Your Profile</h1>
            <p className="text-lg text-muted-foreground">
              Have a personalized experience with HomeLens.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              All fields are optional — you can always update them later.
            </p>
          </div>

          <PreferencesChat
            onSaveComplete={handleSaveAndContinue}
            continueLabel="Save and continue"
            onSkip={async () => {
              const { data: { user: u } } = await supabase.auth.getUser();
              if (u) await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", u.id);
              navigate("/");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Back Button */}
      <div className="container mx-auto px-4 pt-20">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
      
      <div className="container mx-auto px-4 pb-24 lg:pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">My Profile</h1>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/profile-setup")}
              >
                <Settings className="mr-2 h-4 w-4" />
                Edit Preferences
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>

          {/* Preferences Summary */}
          {profile && profile.onboarding_completed && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Your Preferences</CardTitle>
                <CardDescription>
                  We use these to personalize your search results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Home className="h-4 w-4" />
                      Buyer Type
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {profile.buyer_type?.replace("-", " ")}
                    </Badge>
                  </div>

                  {profile.budget_min && profile.budget_max && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        Budget Range
                      </div>
                      <div className="text-sm font-medium">
                        {formatCurrency(profile.budget_min)} - {formatCurrency(profile.budget_max)}
                      </div>
                    </div>
                  )}

                  {profile.property_types && profile.property_types.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Home className="h-4 w-4" />
                        Property Types
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {profile.property_types.map((type: string) => (
                          <Badge key={type} variant="outline" className="text-xs capitalize">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.location_preferences && profile.location_preferences.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Locations
                      </div>
                      <div className="text-sm">
                        {profile.location_preferences.join(", ")}
                      </div>
                    </div>
                  )}

                  {profile.risk_level && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <TrendingUp className="h-4 w-4" />
                        Risk Level
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {profile.risk_level}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
