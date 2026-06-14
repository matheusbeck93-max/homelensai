import { useState } from 'react';
import { Flame } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStickiness } from '@/hooks/useStickiness';
import { StreakPopover } from './StreakPopover';

/**
 * Compact header pill showing the user's current daily streak.
 * Hidden when the user opted out of streak tracking, or when no streak
 * has been recorded yet.
 */
export function StreakIndicator() {
  const { streak } = useStickiness();
  const [open, setOpen] = useState(false);

  if (!streak || streak.disabled) return null;
  if (streak.daily_current < 1) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Current streak: ${streak.daily_current} day${streak.daily_current === 1 ? '' : 's'}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors touch-manipulation"
        >
          <Flame className="h-3.5 w-3.5" />
          <span>{streak.daily_current}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <StreakPopover />
      </PopoverContent>
    </Popover>
  );
}