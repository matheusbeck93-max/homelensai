import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";
import { PreferencesChat } from "@/components/console/PreferencesChat";
import { Navigation } from "@/components/Navigation";
import { PersonaPicker } from "@/components/preferences/PersonaPicker";
import { PERSONAS, type PersonaId, getPersona } from "@/lib/personas/personaRegistry";
import { Card } from "@/components/ui/card";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<'prefs' | 'persona'>('prefs');
  const [savingPersona, setSavingPersona] = useState(false);
  const [initialPersona, setInitialPersona] = useState<PersonaId | null>(null);
  const [initialSecondary, setInitialSecondary] = useState<PersonaId[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('persona, persona_secondary')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.persona) setInitialPersona(data.persona as PersonaId);
      if (data?.persona_secondary) setInitialSecondary(data.persona_secondary as PersonaId[]);
    });
  }, []);

  const advanceToPersona = () => {
    setStep('persona');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePersona = async (primary: PersonaId, secondary: PersonaId[]) => {
    if (!userId) { navigate('/auth'); return; }
    setSavingPersona(true);
    try {
      const def = getPersona(primary);
      const updates: Record<string, unknown> = {
        persona: primary,
        persona_secondary: secondary,
        persona_set_at: new Date().toISOString(),
        onboarding_completed: true,
      };
      // Pre-fill persona defaults if the user hasn't set them.
      if (def.preferenceDefaults?.risk_level) {
        updates.risk_level = def.preferenceDefaults.risk_level;
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;
      await supabase.from('investor_persona_telemetry').insert({
        user_id: userId,
        persona: primary,
        event_type: initialPersona === primary ? 'investor_persona_changed' : 'investor_persona_set',
        payload: { from: initialPersona ?? 'mixed', to: primary, secondary, source: 'onboarding' } as never,
      });
      toast({ title: 'Welcome to HomeLens!', description: 'Your investor focus is set.' });
      navigate('/investor');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPersona(false);
    }
  };

  const handleSaveAndContinue = async () => {
    advanceToPersona();
  };

  const handleSkip = async () => {
    advanceToPersona();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pt-24 pb-24 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-4">
            <Home className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 'prefs' ? 'Set Up Your Profile' : 'Pick your investor focus'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {step === 'prefs'
              ? 'Have a personalized experience with HomeLens.'
              : "We use this to tune your Brief, calculator defaults, and AI tool selection."}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className={step === 'prefs' ? 'text-primary font-medium' : ''}>1. Preferences</span>
            <span>·</span>
            <span className={step === 'persona' ? 'text-primary font-medium' : ''}>2. Investor focus</span>
          </div>
        </div>

        {step === 'prefs' ? (
          <PreferencesChat
            onSaveComplete={handleSaveAndContinue}
            continueLabel="Continue to investor focus"
            onSkip={handleSkip}
          />
        ) : (
          <Card className="p-6">
            <PersonaPicker
              value={initialPersona ?? undefined}
              secondary={initialSecondary}
              onChange={handleSavePersona}
              saving={savingPersona}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
