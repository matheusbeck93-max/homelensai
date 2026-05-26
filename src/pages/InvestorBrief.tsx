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

function InvestorBriefInner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { mode, activeCardContext, enterChatModeFromCard, exitChatMode } =
    useInvestorBriefSurface();

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
            <header className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Investor Brief</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'chat'
                  ? 'Deep dive — supporting data on the right, conversation on the left.'
                  : "Today's grounded read on your portfolio and markets."}
              </p>
            </header>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </main>
      </div>
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
