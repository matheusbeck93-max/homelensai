import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('free');

  // Load user's current subscription
  useEffect(() => {
    const loadSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', user.id)
          .maybeSingle();
        
        if (data) {
          setCurrentTier(data.subscription_status || 'free');
        }
      }
    };
    loadSubscription();
  }, []);

  const handleUpgrade = async (tier: 'premium') => {
    setLoading(tier);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Por favor, faça login para fazer upgrade",
        variant: "destructive"
      });
      setLoading(null);
      navigate('/auth');
      return;
    }

    try {
      const priceId = 'price_1SXAIIDNPbNbmEcljT5VEjT8'; // Premium only

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecionando para checkout",
          description: "Complete seu pagamento na nova aba"
        });
      }
    } catch (error: any) {
      toast({
        title: "Falha no checkout",
        description: error.message || "Falha ao iniciar processo de checkout",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    SUBSCRIPTION_PLANS.free,
    SUBSCRIPTION_PLANS.premium
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Escolha seu Plano</h1>
            <p className="text-muted-foreground text-lg">
              Comece gratuitamente. Faça upgrade quando quiser.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const isUpgrade = currentTier === 'free' && plan.tier === 'premium';
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.tier === 'premium' ? 'border-amber-500 shadow-lg' : ''}`}
                >
                  {plan.tier === 'premium' && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500">
                      <Crown className="h-3 w-3 mr-1" />
                      Recomendado
                    </Badge>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      {plan.tier === 'premium' && <Crown className="h-6 w-6 text-amber-500" />}
                    </div>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      {plan.tier !== 'free' && (
                        <span className="text-muted-foreground"> /mês</span>
                      )}
                    </CardDescription>
                    {plan.tier === 'free' && (
                      <p className="text-xs text-muted-foreground mt-1">Sem cartão de crédito</p>
                    )}
                    {plan.tier === 'premium' && (
                      <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Chat & IA */}
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
                        Chat & IA
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.chatAndAI.slice(0, 4).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {plan.features.chatAndAI.length > 4 && (
                          <li className="text-xs text-primary">
                            + {plan.features.chatAndAI.length - 4} mais recursos
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Calculadoras */}
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
                        Calculadoras
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.calculators.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Chrome Extension */}
                    <div>
                      <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">
                        Chrome Extension
                      </h4>
                      <ul className="space-y-2">
                        {plan.features.chromeExtension.slice(0, 3).map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Limitações (Free only) */}
                    {plan.limitations && (
                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Não incluído:</p>
                        <ul className="space-y-1">
                          {plan.limitations.slice(0, 4).map((limitation) => (
                            <li key={limitation} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-red-500">×</span>
                              {limitation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : plan.tier === 'premium' ? "default" : "outline"}
                      disabled={isCurrent || loading !== null}
                      onClick={() => {
                        if (plan.tier === 'free') {
                          toast({
                            title: "Plano Free ativo",
                            description: "Você está usando o plano gratuito"
                          });
                        } else if (isUpgrade) {
                          handleUpgrade('premium');
                        }
                      }}
                    >
                      {isCurrent 
                        ? "Plano Atual" 
                        : loading === plan.tier 
                          ? "Processando..." 
                          : isUpgrade 
                            ? <><Sparkles className="h-4 w-4 mr-2" />Fazer Upgrade</>
                            : "Começar"
                      }
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Plano pago pode ser cancelado a qualquer momento. Sem taxas ocultas.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Precisa de ajuda? <a href="/chat" className="text-primary hover:underline">Fale conosco</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
