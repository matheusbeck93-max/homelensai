/**
 * Engagement streak engine.
 *
 * Tracks one streak per user with a single free "skip" per Mon–Sun week.
 * Rules:
 *   - Engaging today (UTC, or user TZ in future) keeps the streak alive.
 *   - Missing exactly one day inside the same Mon–Sun week and not having
 *     used the weekly skip yet → skip is consumed, streak preserved.
 *   - Missing >1 day, or missing a day after the skip is already used →
 *     streak resets to 1 on the next engagement.
 *   - Weekly skip resets every Monday.
 *
 * Crossing one of the milestone tiers (3/7/14/30/60/90/180/365) returns a
 * `crossedTier` so callers can fire the celebration + reward.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const STREAK_TIERS = [3, 7, 14, 30, 60, 90, 180, 365] as const;
export type StreakTier = (typeof STREAK_TIERS)[number];

export type EngagementAction =
  | 'app_open'
  | 'chat_send'
  | 'analysis_run'
  | 'artifact_generated'
  | 'brief_opened'
  | 'property_saved'
  | 'calculator_used';

export interface EngagementResult {
  daily_current: number;
  daily_longest: number;
  weekly_skip_used: boolean;
  skip_consumed: boolean;
  crossed_tier: StreakTier | null;
  disabled: boolean;
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
/** ISO week-Monday for given date (UTC). */
function weekStart(d: Date): string {
  const day = d.getUTCDay(); // 0..6 Sun..Sat
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - offset * 86_400_000);
  return ymd(monday);
}
function crossedTier(prev: number, next: number): StreakTier | null {
  for (const t of STREAK_TIERS) {
    if (prev < t && next >= t) return t;
  }
  return null;
}

export async function recordEngagement(
  userId: string,
  action: EngagementAction,
  nowOverride?: Date,
): Promise<EngagementResult> {
  const sb = adminClient();
  const now = nowOverride ?? new Date();
  const today = ymd(now);
  const thisWeek = weekStart(now);

  // Honor opt-out: still count total actions silently but don't surface streak.
  const { data: profile } = await sb
    .from('profiles')
    .select('streak_tracking_disabled')
    .eq('id', userId)
    .maybeSingle();
  const disabled = !!profile?.streak_tracking_disabled;

  const { data: existing } = await sb
    .from('user_engagement_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let dailyCurrent = existing?.daily_current ?? 0;
  let dailyLongest = existing?.daily_longest ?? 0;
  let weeklySkipUsed = existing?.weekly_skip_used ?? false;
  let currentWeekStart = existing?.current_week_start ?? thisWeek;
  const lastDate = parseDate(existing?.last_engagement_date);
  const totalActions = (existing?.total_actions ?? 0) + 1;

  // Reset weekly skip when a new week begins.
  if (currentWeekStart !== thisWeek) {
    weeklySkipUsed = false;
    currentWeekStart = thisWeek;
  }

  let skipConsumed = false;
  const prev = dailyCurrent;

  if (!existing || dailyCurrent === 0) {
    dailyCurrent = 1;
  } else if (lastDate && ymd(lastDate) === today) {
    // already engaged today — no streak change
  } else if (lastDate && diffDays(now, lastDate) === 1) {
    dailyCurrent += 1;
  } else if (lastDate && diffDays(now, lastDate) === 2 && !weeklySkipUsed) {
    // exactly one missed day, skip available → preserve & consume
    dailyCurrent += 1;
    weeklySkipUsed = true;
    skipConsumed = true;
  } else {
    dailyCurrent = 1;
  }

  if (dailyCurrent > dailyLongest) dailyLongest = dailyCurrent;

  const tier = crossedTier(prev, dailyCurrent);
  const highestReached = Math.max(existing?.highest_milestone_reached ?? 0, tier ?? 0);

  const upsert = {
    user_id: userId,
    daily_current: dailyCurrent,
    daily_longest: dailyLongest,
    last_engagement_date: today,
    current_week_start: currentWeekStart,
    weekly_skip_used: weeklySkipUsed,
    highest_milestone_reached: highestReached,
    total_actions: totalActions,
    last_action: action,
  };

  const { error } = await sb
    .from('user_engagement_streaks')
    .upsert(upsert, { onConflict: 'user_id' });
  if (error) console.error('[streaks] upsert failed', error);

  return {
    daily_current: dailyCurrent,
    daily_longest: dailyLongest,
    weekly_skip_used: weeklySkipUsed,
    skip_consumed: skipConsumed,
    crossed_tier: tier,
    disabled,
  };
}

export interface StreakSummary {
  daily_current: number;
  daily_longest: number;
  weekly_skip_used: boolean;
  last_engagement_date: string | null;
  disabled: boolean;
}

export async function loadStreak(userId: string): Promise<StreakSummary | null> {
  const sb = adminClient();
  const [{ data: row }, { data: profile }] = await Promise.all([
    sb.from('user_engagement_streaks').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('profiles').select('streak_tracking_disabled').eq('id', userId).maybeSingle(),
  ]);
  if (!row) {
    return {
      daily_current: 0,
      daily_longest: 0,
      weekly_skip_used: false,
      last_engagement_date: null,
      disabled: !!profile?.streak_tracking_disabled,
    };
  }
  return {
    daily_current: row.daily_current,
    daily_longest: row.daily_longest,
    weekly_skip_used: row.weekly_skip_used,
    last_engagement_date: row.last_engagement_date,
    disabled: !!profile?.streak_tracking_disabled,
  };
}