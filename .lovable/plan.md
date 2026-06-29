# PR #6 — Feature Quota Leak Lockdown & Frontend Upsell Wiring

## Executive Summary
We just shipped PR #1 through #5 of the AI Cost Optimization & Spend Controls architecture, plus activated the background cron pause (`PRELAUNCH_PAUSE_BACKGROUND_JOBS=true`). 

Our post-deploy verification audit identified **one remaining production leak in PR #2 (Feature Quotas)** that must land before final sign-off:
When `completeWithFallback` in `_shared/ai/router.ts` throws a `FeatureQuotaExceededError` (e.g., a Free user hits their 20 chats/month cap), the consumer edge functions catch the error in their outer fallback blocks, assume the gateway failed, and fall back to calling the Lovable AI Gateway directly. **This makes feature quotas ineffective in production.**

---

## Scope of Work

### 1. Edge Function Quota Interception
Update `routerErrorResponse` and fallback `catch` blocks across primary AI chat endpoints:
- `supabase/functions/ai-chat/index.ts`
- `supabase/functions/investor-chat/index.ts`
- `supabase/functions/owned-property-chat/index.ts`
- `supabase/functions/preferences-chat/index.ts`

**Implementation:**
Explicitly check for `FeatureQuotaExceededError` alongside `BudgetExceededError`. When caught, immediately short-circuit and return HTTP `402 Payment Required` with a structured payload:
```json
{
  "error": "You've reached your monthly AI limit on your current plan. Upgrade to continue.",
  "code": "QUOTA_EXCEEDED"
}
```

### 2. Frontend Upsell Nudge Wiring
Update client-side chat hooks and error boundaries:
- `src/hooks/useAiChat.ts`
- `src/components/...` (Chat input / messages UI)

**Implementation:**
When a chat API call returns `status === 402` or `code === 'QUOTA_EXCEEDED'`, suppress generic error toasts and automatically present the `<PricingModal />` (or navigate to `/pricing`) to convert the paywall into an immediate upgrade conversion.

### 3. Phase 6 Operational Verification (24h Sign-off)
- Confirm on `/admin/ai-spend` that prompt cache hit rate stabilizes >70%.
- Confirm in Anthropic Console billing dashboard that direct SDK billing drops to $0.00.

---

## Verification Plan
1. **Automated Tests:** Update TypeScript edge unit tests (`router_test.ts`, etc.) to assert `402 Payment Required` is returned when feature quotas are exhausted.
2. **Live Preview Check:** Temporarily set a profile's `monthly_chat_count` to 20 on Free tier and verify sending a chat prompt surfaces the upgrade paywall dialog cleanly.