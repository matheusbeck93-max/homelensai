import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface WeeklyReview {
  weekStartIso: string;
  savedCount: number;
  analysesCount: number;
  milestonesCount: number;
}

const CACHE_KEY = 'homelens.weeklyReview.v1';
const DISMISS_KEY = 'homelens.weeklyReview.dismissed';

function isSundayAfternoonLocal(d = new Date()): boolean {
  // Sunday = 0, between 14:00 and 20:00 local time.
  return d.getDay() === 0 && d.getHours() >= 14 && d.getHours() < 20;
}

function weekStartIso(d = new Date()): string {
  const day = d.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/**
 * Dashboard card aggregating the past week's HomeLens activity. Renders
 * only on Sunday afternoons (14:00–20:00 local). Cached per week in
 * localStorage to keep the read cheap.
 */
export function WeeklyReviewCard() {
  const [review, setReview] = useState<WeeklyReview | null>(null);

  useEffect(() => {
    if (!isSundayAfternoonLocal()) return;
    const week = weekStartIso();
    if (sessionStorage.getItem(`${DISMISS_KEY}.${week}`)) return;

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as WeeklyReview;
        if (parsed.weekStartIso === week) {
          setReview(parsed);
          return;
        }
      } catch {
        /* ignore */
      }
    }

    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;
      const sinceIso = new Date(`${week}T00:00:00`).toISOString();
      const [savedRes, analysesRes, milestonesRes] = await Promise.all([
        supabase
          .from('saved_properties')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
        supabase
          .from('analyses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', sinceIso),
        supabase
          .from('delivered_milestones')
          .select('id', { count: 'exact', head: true })
          .gte('detected_at', sinceIso),
      ]);
      const next: WeeklyReview = {
        weekStartIso: week,
        savedCount: savedRes.count ?? 0,
        analysesCount: analysesRes.count ?? 0,
        milestonesCount: milestonesRes.count ?? 0,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      setReview(next);
    })();
  }, []);

  if (!review) return null;
  const total = review.savedCount + review.analysesCount + review.milestonesCount;
  if (total === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5 flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
            Your week on HomeLens
          </p>
          <p className="text-sm text-foreground">
            {review.savedCount > 0 && (
              <>
                <strong>{review.savedCount}</strong> propert{review.savedCount === 1 ? 'y' : 'ies'} saved
              </>
            )}
            {review.savedCount > 0 && (review.analysesCount > 0 || review.milestonesCount > 0) && ' · '}
            {review.analysesCount > 0 && (
              <>
                <strong>{review.analysesCount}</strong> analys{review.analysesCount === 1 ? 'is' : 'es'}
              </>
            )}
            {review.analysesCount > 0 && review.milestonesCount > 0 && ' · '}
            {review.milestonesCount > 0 && (
              <>
                <strong>{review.milestonesCount}</strong> milestone{review.milestonesCount === 1 ? '' : 's'}
              </>
            )}
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                sessionStorage.setItem(`${DISMISS_KEY}.${review.weekStartIso}`, '1');
                setReview(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}