import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, X, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

export function SubscriptionPanel() {
  const navigate = useNavigate();
  const { tier } = useSubscription();

  const currentPlan = SUBSCRIPTION_PLANS[tier];
  const isPremium = tier === "premium";

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <Card className={isPremium ? "border-amber-500/50 shadow-lg" : "border-muted"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Seu Plano Atual
                <Badge variant={isPremium ? "default" : "secondary"} className="capitalize">
                  {tier}
                </Badge>
              </CardTitle>
              <CardDescription className="text-lg mt-2 font-semibold">
                {currentPlan.price}
              </CardDescription>
            </div>
            {isPremium && (
              <div className="text-4xl">
                <Crown className="h-12 w-12 text-amber-500" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chat & IA */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Chat & IA
            </h4>
            <div className="space-y-2">
              {currentPlan.features.chatAndAI.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculadoras */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Calculadoras
            </h4>
            <div className="space-y-2">
              {currentPlan.features.calculators.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chrome Extension */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Chrome Extension
            </h4>
            <div className="space-y-2">
              {currentPlan.features.chromeExtension.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Suporte (Premium only) */}
          {currentPlan.features.support && (
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                Suporte
              </h4>
              <div className="space-y-2">
                {currentPlan.features.support.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Limitações (Free only) */}
          {currentPlan.limitations && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                Não incluído no plano Free
              </h4>
              <div className="space-y-2">
                {currentPlan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{limitation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h3 className="text-2xl font-bold mb-6">Compare os Planos</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
            const isCurrent = key === tier;
            const canUpgrade = !isPremium && key === "premium";
            
            return (
              <Card 
                key={key} 
                className={isCurrent ? (isPremium ? "border-amber-500 shadow-lg" : "border-primary shadow-lg") : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="capitalize">{plan.name}</CardTitle>
                      {key === "premium" && <Crown className="h-5 w-5 text-amber-500" />}
                    </div>
                    {isCurrent && (
                      <Badge variant="default">Atual</Badge>
                    )}
                  </div>
                  <CardDescription className="text-2xl font-bold text-foreground">
                    {plan.price}
                  </CardDescription>
                  {key === "free" && (
                    <p className="text-xs text-muted-foreground mt-1">Sem cartão de crédito</p>
                  )}
                  {key === "premium" && (
                    <p className="text-xs text-muted-foreground mt-1">Cancele quando quiser</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {/* Chat & IA */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Chat & IA</h5>
                      <ul className="space-y-1">
                        {plan.features.chatAndAI.slice(0, 4).map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-xs">{f}</span>
                          </li>
                        ))}
                        {plan.features.chatAndAI.length > 4 && (
                          <li className="text-xs text-primary">+ {plan.features.chatAndAI.length - 4} mais</li>
                        )}
                      </ul>
                    </div>
                    
                    {/* Calculadoras */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Calculadoras</h5>
                      <ul className="space-y-1">
                        {plan.features.calculators.map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-xs">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Extensão */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Chrome Extension</h5>
                      <ul className="space-y-1">
                        {plan.features.chromeExtension.slice(0, 3).map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <Check className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-xs">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {canUpgrade && (
                    <Button 
                      className="w-full" 
                      onClick={() => navigate("/pricing")}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Fazer Upgrade
                    </Button>
                  )}
                  {isCurrent && (
                    <Button variant="outline" className="w-full" disabled>
                      Plano Atual
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
