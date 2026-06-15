import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  enforceDailyQuota,
  resolveRentcastTier,
  RentcastQuotaError,
  RentcastUpgradeRequiredError,
} from '../rentcast.ts';

// ────────────────────────────────────────────────────────────────────────────
// Stub Supabase client (only implements the chained calls these helpers use)
// ────────────────────────────────────────────────────────────────────────────

function makeProfileClient(profile: { subscription_status?: string; stripe_price_id?: string } | null) {
  return {
    from(table: string) {
      assertEquals(table, 'profiles');
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: profile, error: null }),
      } as any;
    },
  };
}

function makeUsageCountClient(count: number) {
  return {
    from(table: string) {
      assertEquals(table, 'rentcast_usage_log');
      return {
        select() { return this; },
        eq() { return this; },
        gte: async () => ({ count, error: null }),
      } as any;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// resolveRentcastTier
// ────────────────────────────────────────────────────────────────────────────

Deno.test('resolveRentcastTier: investor price ID → investor', async () => {
  Deno.env.set('STRIPE_INVESTOR_MONTHLY_PRICE_ID', 'price_inv_monthly');
  Deno.env.set('STRIPE_INVESTOR_ANNUAL_PRICE_ID', 'price_inv_annual');
  const sb = makeProfileClient({ subscription_status: 'active', stripe_price_id: 'price_inv_monthly' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'investor');
});

Deno.test('resolveRentcastTier: legacy "premium" status → investor', async () => {
  const sb = makeProfileClient({ subscription_status: 'premium', stripe_price_id: '' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'investor');
});

Deno.test('resolveRentcastTier: legacy "buyer" status → buyer', async () => {
  const sb = makeProfileClient({ subscription_status: 'buyer', stripe_price_id: '' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'buyer');
});

Deno.test('resolveRentcastTier: generic active sub w/o investor price → buyer', async () => {
  Deno.env.set('STRIPE_INVESTOR_MONTHLY_PRICE_ID', 'price_inv_monthly');
  const sb = makeProfileClient({ subscription_status: 'active', stripe_price_id: 'price_buyer_monthly' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'buyer');
});

Deno.test('resolveRentcastTier: trialing → buyer', async () => {
  const sb = makeProfileClient({ subscription_status: 'trialing', stripe_price_id: '' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'buyer');
});

Deno.test('resolveRentcastTier: no profile → free', async () => {
  const sb = makeProfileClient(null);
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'free');
});

Deno.test('resolveRentcastTier: canceled / inactive → free', async () => {
  const sb = makeProfileClient({ subscription_status: 'canceled', stripe_price_id: '' });
  assertEquals(await resolveRentcastTier(sb, 'u1'), 'free');
});

// ────────────────────────────────────────────────────────────────────────────
// enforceDailyQuota — boundary tests
// ────────────────────────────────────────────────────────────────────────────

Deno.test('enforceDailyQuota: free always throws UpgradeRequired', async () => {
  const sb = makeUsageCountClient(0);
  let err: unknown;
  try { await enforceDailyQuota(sb, 'u1', 'free'); } catch (e) { err = e; }
  assert(err instanceof RentcastUpgradeRequiredError, 'expected upgrade-required for free tier');
});

Deno.test('enforceDailyQuota: buyer at 4/5 → ok', async () => {
  const sb = makeUsageCountClient(4);
  await enforceDailyQuota(sb, 'u1', 'buyer'); // does not throw
});

Deno.test('enforceDailyQuota: buyer at 5/5 → quota error', async () => {
  const sb = makeUsageCountClient(5);
  let err: unknown;
  try { await enforceDailyQuota(sb, 'u1', 'buyer'); } catch (e) { err = e; }
  assert(err instanceof RentcastQuotaError);
  assertEquals((err as RentcastQuotaError).tier, 'buyer');
  assertEquals((err as RentcastQuotaError).limit, 5);
});

Deno.test('enforceDailyQuota: investor at 49/50 → ok', async () => {
  const sb = makeUsageCountClient(49);
  await enforceDailyQuota(sb, 'u1', 'investor');
});

Deno.test('enforceDailyQuota: investor at 50/50 → quota error', async () => {
  const sb = makeUsageCountClient(50);
  let err: unknown;
  try { await enforceDailyQuota(sb, 'u1', 'investor'); } catch (e) { err = e; }
  assert(err instanceof RentcastQuotaError);
  assertEquals((err as RentcastQuotaError).limit, 50);
});

Deno.test('enforceDailyQuota: investor at 51/50 → quota error (still blocked)', async () => {
  const sb = makeUsageCountClient(51);
  let err: unknown;
  try { await enforceDailyQuota(sb, 'u1', 'investor'); } catch (e) { err = e; }
  assert(err instanceof RentcastQuotaError);
});