import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';

/**
 * Investor Console — chat-first surface.
 * For v1 we forward to the shared /chats experience with any grounding
 * prompt that came from a brief Investigate action, while preserving the
 * sidebar shell so the user sees they're still in the Investor section.
 */
export default function InvestorConsole() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth?redirect=/investor/console');
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  if (!ready) return null;

  // Forward grounding state into /chats so the existing chat infra owns the conversation.
  const initialMessage = (location.state as { initialMessage?: string } | null)?.initialMessage;
  if (initialMessage) {
    return <Navigate to="/chats" replace state={{ initialMessage }} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Investor Console — Grounded Chat | HomeLens</title>
        <meta
          name="description"
          content="Ask grounded real-estate questions with your saved properties, analyses, and brief context attached."
        />
      </Helmet>
      <Navigation />
      <div className="flex flex-1 pt-20 lg:pt-16">
        <ConsoleSidebar expanded />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-8 max-w-3xl">
            <h1 className="text-2xl font-bold mb-2">Investor Console</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Continue a conversation about your brief in the chat workspace.
            </p>
            <div className="border rounded-lg p-6 bg-card">
              <p className="text-sm mb-4">
                Your investor chats use the full HomeLens chat workspace with file uploads,
                voice, and grounded context from your portfolio.
              </p>
              <button
                onClick={() => navigate('/chats')}
                className="text-sm font-medium text-primary hover:underline"
              >
                Open chat workspace →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
