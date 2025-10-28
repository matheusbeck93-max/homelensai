import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserCircle, TrendingUp, Home } from "lucide-react";

type UserProfile = "first-time-buyer" | "investor" | "regular-buyer";

interface ProfileSelectorProps {
  onProfileChange?: (profile: UserProfile) => void;
}

export default function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_profile")
      .eq("id", user.id)
      .single();

    if (data && !error) {
      setSelectedProfile(data.user_profile as UserProfile);
    }
  };

  const handleProfileSelect = async (profile: UserProfile) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ user_profile: profile })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      setSelectedProfile(profile);
      onProfileChange?.(profile);
      toast({
        title: "Profile Updated",
        description: "Your buyer profile has been updated",
      });
    }
    setLoading(false);
  };

  const profiles = [
    {
      id: "first-time-buyer" as UserProfile,
      title: "First-Time Buyer",
      description: "Looking for your first home",
      icon: Home,
    },
    {
      id: "investor" as UserProfile,
      title: "Investor",
      description: "Analyzing investment properties",
      icon: TrendingUp,
    },
    {
      id: "regular-buyer" as UserProfile,
      title: "Regular Buyer",
      description: "General home shopping",
      icon: UserCircle,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {profiles.map((profile) => {
        const Icon = profile.icon;
        const isSelected = selectedProfile === profile.id;
        return (
          <Card
            key={profile.id}
            className={`p-4 cursor-pointer transition-all ${
              isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
            }`}
            onClick={() => handleProfileSelect(profile.id)}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <Icon className={`h-8 w-8 ${isSelected ? "text-primary" : ""}`} />
              <h3 className="font-semibold">{profile.title}</h3>
              <p className="text-sm text-muted-foreground">{profile.description}</p>
              {isSelected && (
                <span className="text-xs text-primary font-medium">Selected</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
