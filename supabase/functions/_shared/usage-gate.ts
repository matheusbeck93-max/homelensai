import type { Tier } from "./ai/types.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type FeatureKind = "chat" | "photos" | "briefs";

export interface QuotaLimits {
  chat: number;
  photos: number;
  briefs: number;
}

export const TIER_LIMITS: Record<Tier, QuotaLimits> = {
  free:     { chat: 20,   photos: 1,  briefs: 3 },
  buyer:    { chat: 500,  photos: 10, briefs: 30 },
  investor: { chat: 2000, photos: 50, briefs: 100 },
};

export class FeatureQuotaExceededError extends Error {
  constructor(public tier: Tier, public feature: FeatureKind, public limit: number) {
    super(`Feature quota exceeded for feature='${feature}' on tier='${tier}' (limit=${limit}/mo)`);
    this.name = "FeatureQuotaExceededError";
  }
}

let cachedClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function checkAndIncrementFeatureQuota(
  userId: string,
  tier: Tier,
  feature: FeatureKind,
  client?: SupabaseClient | null
): Promise<{ allowed: boolean; remaining: number }> {
  if (!userId) return { allowed: true, remaining: 999 };

  const svc = client ?? getServiceClient();
  if (!svc) return { allowed: true, remaining: 999 };

  const { data: profile, error } = await svc
    .from("profiles")
    .select("is_staff, monthly_chat_count, monthly_photos_count, monthly_briefs_count, monthly_quota_reset_date")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) return { allowed: true, remaining: 999 };

  if ((profile as any)?.is_staff) {
    return { allowed: true, remaining: 9999 };
  }

  const now = new Date();
  const firstOfMonthStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const resetDate = (profile as any)?.monthly_quota_reset_date;

  let counts = {
    chat: (profile as any)?.monthly_chat_count ?? 0,
    photos: (profile as any)?.monthly_photos_count ?? 0,
    briefs: (profile as any)?.monthly_briefs_count ?? 0,
  };

  if (resetDate !== firstOfMonthStr) {
    counts = { chat: 0, photos: 0, briefs: 0 };
    await svc.from("profiles").update({
      monthly_chat_count: 0,
      monthly_photos_count: 0,
      monthly_briefs_count: 0,
      monthly_quota_reset_date: firstOfMonthStr
    }).eq("id", userId);
  }

  const limit = TIER_LIMITS[tier]?.[feature] ?? TIER_LIMITS.free[feature];
  const current = counts[feature];

  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const colMap: Record<FeatureKind, string> = {
    chat: "monthly_chat_count",
    photos: "monthly_photos_count",
    briefs: "monthly_briefs_count",
  };
  const targetCol = colMap[feature];

  await svc.from("profiles").update({
    [targetCol]: current + 1,
    monthly_quota_reset_date: firstOfMonthStr
  }).eq("id", userId);

  return { allowed: true, remaining: limit - (current + 1) };
}