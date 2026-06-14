import { Flame, Shield, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStickiness } from '@/hooks/useStickiness';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const TIERS = [3, 7, 14, 30, 60, 90, 180, 365];

export function StreakPopover() {
  const { streak } = useStickiness();
  if (!streak) return null;
  const nextTier = TIERS.find((t) => t > streak.daily_current) ?? null;
  const remaining = nextTier ? nextTier - streak.daily_current : null;

  const disable = async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ streak_tracking_disabled: true })
      .eq('id', userId);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Streak tracking turned off', description: 'You can re-enable it in account settings later.' });
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {streak.daily_current}-day streak
          </p>
          <p className="text-xs text-muted-foreground">
            Longest ever: {streak.daily_longest}
          </p>
        </div>
      </div>
      {nextTier && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5" />
          {remaining} day{remaining === 1 ? '' : 's'} to {nextTier}-day milestone
        </div>
      )}
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Shield className="h-3.5 w-3.5" />
        {streak.weekly_skip_used ? 'Weekly skip used' : '1 free skip available this week'}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={disable}
      >
        Turn off streak tracking
      </Button>
    </div>
  );
}