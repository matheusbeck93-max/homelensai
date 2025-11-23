import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";

interface NeighborhoodPersonalityProps {
  address: string;
  city: string;
  state: string;
  zip: string;
  onPersonalityGenerated?: (personality: string) => void;
}

export function NeighborhoodPersonality({ address, city, state, zip, onPersonalityGenerated }: NeighborhoodPersonalityProps) {
  const [personality, setPersonality] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { toast } = useToast();
  const { hasAccess } = useSubscription();

  const hasNeighborhoodPersonalityAccess = hasAccess('NEIGHBORHOOD_PERSONALITY');

  const handleGenerate = async () => {
    if (!hasNeighborhoodPersonalityAccess) {
      setUpgradeModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("neighborhood-personality", {
        body: { address, city, state, zip },
      });

      if (error) throw error;

      if (data?.personality) {
        setPersonality(data.personality);
        onPersonalityGenerated?.(data.personality);
      }
    } catch (error: any) {
      console.error('Error generating neighborhood personality:', error);
      toast({
        title: "Could not generate neighborhood personality",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Neighborhood Personality
              </CardTitle>
              <CardDescription>
                AI-powered insights into the vibe, lifestyle, and culture of this area
              </CardDescription>
            </div>
            {!hasNeighborhoodPersonalityAccess && (
              <Badge variant="secondary">Pro</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!personality ? (
            <div className="text-center py-8">
              {!hasNeighborhoodPersonalityAccess ? (
                <div className="space-y-4">
                  <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    Unlock AI-powered neighborhood personality insights
                  </p>
                  <Button onClick={() => setUpgradeModalOpen(true)}>
                    Upgrade to Pro
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={handleGenerate}
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Discover the Neighborhood Vibe
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{personality}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      <UpgradeModal 
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature="Neighborhood Personality AI"
      />
    </>
  );
}
