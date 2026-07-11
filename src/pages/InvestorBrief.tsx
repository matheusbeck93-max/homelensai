import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';
import { BriefCard } from '@/components/investor/brief/BriefCard';
import { BriefCardRenderer } from '@/components/investor/brief/BriefCardRenderer';
import { useInvestorBrief } from '@/hooks/useInvestorBrief';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  InvestorBriefProvider,
  useInvestorBriefSurface,
} from '@/contexts/InvestorBriefContext';
import { DeepPanel } from '@/components/investor/brief/deep/DeepPanel';
import type { ComposedCard } from '@/lib/investorBrief/types';
import { LegacyUpgradeModal } from '@/components/upgrade/LegacyUpgradeModal';
import { TierGate } from '@/components/subscription/TierGate';
import { useSubscription } from '@/hooks/useSubscription';
import { Home, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

function InvestorBriefInner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const {
    mode,
    enterChatModeFromCard,
    exitChatMode,
  } = useInvestorBriefSurface();
  const { loading: subLoading } = useSubscription();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth?redirect=/investor');
        return;
      }
      setUserId(session.user.id);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate('/auth?redirect=/investor');
      else setUserId(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { bundle, loading, refreshing, isStale, regenerate, effectiveIntro, effectiveInsights } =
    useInvestorBrief(userId);

  const handlePinTalkingPoint = async (text: string) => {
    if (!userId) return;
    const { error } = await supabase.from('investor_talking_points').insert({
      user_id: userId,
      text,
      status: 'active',
    });
    if (error) {
      toast({ title: 'Could not pin', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pinned as talking point' });
    }
  };

  const cards = bundle ? Object.values(bundle.composedById) : [];

  const severityForCard = (cardId: string): 'info' | 'opportunity' | 'warning' => {
    const match = effectiveInsights.find((b) => b.citedCardIds?.includes(cardId));
    return match?.severity ?? 'info';
  };

  const handleInvestigate = (card: ComposedCard) => {
    enterChatModeFromCard(card, severityForCard(card.id));
  };

  if (!authReady) return null;

  const today = format(new Date(), 'MMM d, yyyy');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Investor Brief — Daily Real Estate Intelligence | HomeLens</title>
        <meta
          name="description"
          content="Your daily Investor Brief: cap-rate trends, watchlist signals, price-reduction hot zones and missing-input alerts — grounded in your portfolio."
        />
        <link rel="canonical" href="https://homelensais.com/investor" />
      </Helmet>
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl">
            <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-1.5">
                  Investor Brief
                </h1>
                <p className="text-sm text-muted-foreground">
                  {mode === 'chat'
                    ? 'Deep dive — supporting data on the right, conversation on the left.'
                    : "Today's grounded read on your portfolio and markets."}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Home className="h-3 w-3" />
                  </span>
                  <span className="font-medium text-foreground/80">Prepared by Homelens</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {today}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1">
                    <Calendar className="h-3.5 w-3.5" /> {today} — {today}
                  </span>
                </div>
              </div>
            </header>
            {subLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
            <TierGate
              feature="INVESTOR_CALCULATOR"
              featureName="Investor Brief"
              description="Your daily investor intelligence — cap-rate trends, watchlist signals and grounded insights on your portfolio. Included with the Investor plan."
            >
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
              <BriefCard
                introText={effectiveIntro}
                insights={effectiveInsights}
                followups={bundle?.brief.followups ?? []}
                generatedAt={bundle?.brief.generated_at}
                isStale={isStale}
                refreshing={refreshing}
                loading={loading && !bundle}
                onRefresh={() => regenerate()}
              />
              <section>
                {mode === 'chat' ? (
                  <DeepPanel onBack={exitChatMode} />
                ) : loading && cards.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-44 w-full" />
                    ))}
                  </div>
                ) : cards.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
                    No insights yet. Save a property or run an analysis to populate your brief.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 brief-stagger">
                    {cards.map((card) => (
                      <BriefCardRenderer
                        key={card.id}
                        card={card}
                        userId={userId}
                        onPinTalkingPoint={handlePinTalkingPoint}
                        onInvestigate={handleInvestigate}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
            </TierGate>
            )}
          </div>
        </main>
      </div>
      <LegacyUpgradeModal surface="investor_brief" />
    </div>
  );
}

export default function InvestorBrief() {
  return (
    <InvestorBriefProvider>
      <InvestorBriefInner />
    </InvestorBriefProvider>
  );
}
