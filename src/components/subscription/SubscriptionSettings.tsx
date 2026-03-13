import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, ArrowUpRight, Check, X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

export function SubscriptionSettings() {
  const navigate = useNavigate();
  const { tier, loading } = useSubscription();
  const [canceling, setCanceling] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
          <CardDescription>Carregando detalhes da assinatura...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentPlan = SUBSCRIPTION_PLANS[tier];
  const isPremium = tier === 'premium';
  const isFree = tier === 'free';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Assinatura
          {isPremium && <Crown className="h-5 w-5 text-amber-500" />}
        </CardTitle>
        <CardDescription>Gerencie sua assinatura do HomeLens</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">Plano {currentPlan.name}</h3>
              <Badge variant={isPremium ? "default" : "secondary"}>
                {currentPlan.price}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isFree && "Sem cartão de crédito"}
              {isPremium && "Cancele quando quiser"}
            </p>
          </div>
          {isPremium && <Crown className="h-8 w-8 text-amber-500" />}
        </div>

        {/* Features por categoria */}
        <div className="space-y-4">
          {/* Chat & IA */}
          <div>
            <h4 className="text-sm font-medium mb-2">Chat & IA</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentPlan.features.chatAndAI.slice(0, 4).map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
              {currentPlan.features.chatAndAI.length > 4 && (
                <li className="text-primary text-xs">+ {currentPlan.features.chatAndAI.length - 4} mais recursos</li>
              )}
            </ul>
          </div>

          {/* Calculadoras */}
          <div>
            <h4 className="text-sm font-medium mb-2">Calculadoras</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentPlan.features.calculators.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Chrome Extension */}
          <div>
            <h4 className="text-sm font-medium mb-2">Chrome Extension</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentPlan.features.chromeExtension.slice(0, 3).map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Limitações (Free only) */}
          {currentPlan.limitations && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Não incluído:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {currentPlan.limitations.slice(0, 3).map((limitation) => (
                  <li key={limitation} className="flex items-start gap-2">
                    <X className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                    {limitation}
                  </li>
                ))}
                {currentPlan.limitations.length > 3 && (
                  <li className="text-xs text-muted-foreground">+ {currentPlan.limitations.length - 3} mais</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t">
          {isFree && (
            <Button onClick={() => navigate('/pricing')} className="w-full">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Fazer Upgrade para Premium
            </Button>
          )}

          {isPremium && (
            <Button 
              variant="outline" 
              onClick={() => navigate('/pricing')} 
              className="w-full"
            >
              <Crown className="h-4 w-4 mr-2" />
              Ver Detalhes do Plano
            </Button>
          )}

          {isPremium && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={canceling}
              onClick={() => {
                setCanceling(true);
                setTimeout(() => {
                  alert('Fluxo de cancelamento será implementado com a integração de billing');
                  setCanceling(false);
                }, 1000);
              }}
            >
              {canceling ? "Processando..." : "Cancelar Assinatura"}
            </Button>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Dúvidas sobre billing? <a href="/chat" className="text-primary hover:underline">Fale com o suporte</a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
