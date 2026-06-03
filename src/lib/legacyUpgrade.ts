import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionTier } from '@/lib/subscriptionPlans';

/**
 * Legacy-pricing upgrade nudge.
 *
 * Identifies subscribers still on a legacy Stripe Price ID (e.g. the
 * pre-migration $4.97 tier) and gates a soft nudge inviting them to move
 * to current pricing. Anti-spam baked in: max once every 90 days, snooze
 * on "later" (30d) or "no thanks" (90d), never on free users.
 */

export interface LegacyNudgeRow {
  id: string;
  shown_at: string | null;
  dismissed_at: string | null;
  accepted_at: string | null;
  deferred_until: string | null;
  upgrade_completed_at: string | null;
}

interface LegacyState {
  loading: boolean;
  isLegacy: boolean;
  tier: SubscriptionTier;
  shouldShow: boolean;
  legacyPriceId: string | null;
}

const DAY = 86_400_000;

function pickLatest(rows: LegacyNudgeRow[]): LegacyNudgeRow | null {
  if (!rows.length) return null;
  return rows.reduce((acc, r) => {
    const a = acc?.shown_at ? Date.parse(acc.shown_at) : 0;
    const b = r.shown_at ? Date.parse(r.shown_at) : 0;
    return b > a ? r : acc;
  }, rows[0]);
}

function shouldShowGiven(
  isLegacy: boolean,
  rows: LegacyNudgeRow[],
): boolean {
  if (!isLegacy) return false;
  const latest = pickLatest(rows);
  if (!latest) return true;
  if (latest.accepted_at || latest.upgrade_completed_at) return false;
  if (latest.deferred_until && Date.parse(latest.deferred_until) > Date.now()) return false;
  const shown = latest.shown_at ? Date.parse(latest.shown_at) : 0;
  const daysSince = (Date.now() - shown) / DAY;
  return daysSince >= 90;
}

export function useLegacyUpgrade(surface: string): LegacyState & {
  recordShown: () => Promise<void>;
  dismiss: (kind: 'dismissed' | 'later' | 'no_thanks') => Promise<void>;
  openPortal: () => Promise<void>;
} {
  const [state, setState] = useState<LegacyState>({
    loading: true,
    isLegacy: false,
    tier: 'free',
    shouldShow: false,
    legacyPriceId: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [{ data: profile }, { data: nudges }] = await Promise.all([
        supabase
          .from('profiles')
          .select('subscription_status, stripe_price_id')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('legacy_upgrade_nudges')
          .select('id, shown_at, dismissed_at, accepted_at, deferred_until, upgrade_completed_at')
          .eq('user_id', user.id)
          .order('shown_at', { ascending: false, nullsFirst: false })
          .limit(20),
      ]);
      if (cancelled) return;

      const tier = (profile?.subscription_status as SubscriptionTier) ?? 'free';
      const legacyPriceId = profile?.stripe_price_id ?? null;
      // Frontend treats "has a stripe_price_id that doesn't match a known
      // current monthly/annual id" as legacy. The backend enforces the
      // authoritative legacy check via env var, so this is best-effort UI
      // gating only; the portal endpoint will reject false positives.
      const isLegacy = !!legacyPriceId && (tier === 'buyer' || tier === 'investor')
        && !isKnownCurrentPriceId(legacyPriceId);
      const shouldShow = shouldShowGiven(isLegacy, (nudges ?? []) as LegacyNudgeRow[]);
      setState({ loading: false, isLegacy, tier, shouldShow, legacyPriceId });
    })();
    return () => { cancelled = true; };
  }, [surface]);

  const post = useCallback(async (action: 'shown' | 'dismissed' | 'later' | 'no_thanks') => {
    try {
      await supabase.functions.invoke('legacy-upgrade-track', {
        body: { action, surface },
      });
    } catch (err) {
      console.warn('[legacyUpgrade] track failed', err);
    }
  }, [surface]);

  const recordShown = useCallback(async () => {
    await post('shown');
  }, [post]);

  const dismiss = useCallback(async (kind: 'dismissed' | 'later' | 'no_thanks') => {
    await post(kind);
    setState((s) => ({ ...s, shouldShow: false }));
  }, [post]);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('legacy-upgrade-portal', {
      body: { surface },
    });
    if (error || !data?.url) {
      console.error('[legacyUpgrade] portal failed', error);
      return;
    }
    window.location.href = data.url;
  }, [surface]);

  return { ...state, recordShown, dismiss, openPortal };
}

// Keep in sync with src/lib/subscriptionPlans.ts. Used to suppress the
// nudge for users already on a current price. Not authoritative — the
// edge function does the final legacy/current check via env vars.
const KNOWN_CURRENT_PRICE_IDS = new Set<string>([
  'price_1TSMm0PfVIpcDpxSMzUCGAvN', // Buyer monthly
  'price_1TSMm1PfVIpcDpxSFmwVN4Ip', // Buyer annual
  'price_1TZt4aPfVIpcDpxShMu0UEwn', // Investor monthly
  'price_1TZt4uPfVIpcDpxSgnUotVmn', // Investor annual
]);

function isKnownCurrentPriceId(priceId: string): boolean {
  return KNOWN_CURRENT_PRICE_IDS.has(priceId);
}