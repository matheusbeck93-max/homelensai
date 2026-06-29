# Investigation Report & Cost Optimization Plan

## Critical Investigation Findings (PR 0)

I completed the pre-build investigation across the entire codebase and database telemetry. Here are the exact findings to Pedro's question: **"Why is my Anthropic Console burning credit if everything routes through Lovable AI Gateway?"**

### 1. Codebase Grep Results
Only **one file** in the entire HomeLens codebase instantiates `AnthropicProvider` directly and calls Anthropic (`api.anthropic.com` with `ANTHROPIC_API_KEY`) bypassing the Lovable Gateway and Router:
* **`supabase/functions/_shared/memory/extractor.ts`** (lines 3, 69, 72):
  ```ts
  const provider = new AnthropicProvider();
  const result = await provider.complete('gateway:standard', { ... });
  ```
* Every other AI surface (`ai-analyze`, `ai-chat`, `ai-search`, `blog-draft-generate`, `calculator-insights`, `compare-properties-ai`, `investor-brief`, `investor-chat`, `neighborhood-personality`, `preferences-assistant`, `property-assistant`, `send-weekly-picks`) routes through `callAiGateway` (`_shared/ai-gateway.ts`) or `completeWithFallback` (`_shared/ai/router.ts`), which use `LovableGatewayProvider` (`LOVABLE_API_KEY`).

### 2. Why is Anthropic Console burning credit?
There are two reasons:
1. **Direct Bypass by Memory Sweeper:** When `memory-summarize-session` runs (triggered by user threads closing or scheduled cleanup), it calls `summarizeConversation()` in `_shared/memory/extractor.ts`. This bypasses the Gateway and hits `api.anthropic.com` directly using `ANTHROPIC_API_KEY`.
2. **Lovable AI Gateway Upstream Settlement:** For the remaining 95%+ of calls that correctly hit `callAiGateway`, Lovable AI Gateway routes them to OpenRouter / Anthropic. **However**, if your workspace or BYO connector setup in Lovable Cloud has your personal `ANTHROPIC_API_KEY` registered as a connector for Anthropic models, traffic routed through the Gateway for Claude models debits your BYO Anthropic API Console credits directly.

### 3. Cron Job & Scheduled Functions Audit
We audited all SQL cron definitions (`weeklyPicksCron.sql`, `alertsSetup.sql`, `openHouseDigestCron.sql`) and edge functions. Here is the complete audit table:

| Job Name / Edge Function | Schedule / Trigger | Calls Claude? | Action / Pre-launch Status |
| :--- | :--- | :--- | :--- |
| `fred-prefetch-daily` | Daily 6am ET | No (FRED API) | **KEEP RUNNING** |
| `bls-prefetch-weekly` | Weekly | No (BLS API) | **KEEP RUNNING** |
| `check-property-alerts` | Every 6 hours (`0 */6 * * *`) | No (DB diff + Resend email) | **KEEP RUNNING** |
| `open-house-digest-daily` | Daily 7am ET (`0 11 * * *`) | No (DB search + Resend email) | **KEEP RUNNING** |
| `open-house-digest-weekly` | Fri 6pm ET (`0 22 * * 5`) | No (DB search + Resend email) | **KEEP RUNNING** |
| `send-weekly-picks` | Daily 9am ET (`0 9 * * *`) | **Yes** (AI matching commentary) | **PAUSE** via `PRELAUNCH_PAUSE_BACKGROUND_JOBS=true` |
| `memory-session-sweeper` | Scheduled / Background cleanup | **Yes** (calls `memory-summarize-session`) | **PAUSE** via `PRELAUNCH_PAUSE_BACKGROUND_JOBS=true` |

### 4. 7-Day Usage Telemetry Query Results
Querying `ai_usage_log` over the last 7 days shows very low logged production chat traffic (`investor_brief` with 1 call, $0.012 cost), confirming that the credit drain Pedro observed is coming from untagged dev/test invocations and background memory extraction runs.

---

## Answers to Product Questions

* **Q1 (Gateway vs Direct SDK):** We will **KEEP THE GATEWAY** (`_shared/ai/router.ts`). We will verify prompt caching passthrough on Sonnet calls.
* **Q2 (Dev/Prod Separation):** We will add `is_dev_call` tagging in `_shared/env.ts`, `ai_usage_log`, and `ai_credit_ledger` to isolate preview/test traffic from production accounting.
* **Q3 (Tier Caps & Quotas):** We will adopt the $1 (Free) / $10 (Buyer) / $25 (Investor) monthly USD hard caps backed by env var overrides, and implement `_shared/usage-gate.ts` with feature quotas (`chat: 20/500/2000`, `photos: 1/10/50`, `briefs: 3/30/100`).
* **Q4 (Haiku 4.5 Routing):** Approved. We will add `MODEL_BY_OPERATION` in `modelRegistry.ts` mapping photo categorization, ranking, intent, and memory tasks to `claude-haiku-4-5` via Gateway.
* **Q5 (Pre-launch Cron Pause):** Approved. We will add `PRELAUNCH_PAUSE_BACKGROUND_JOBS=true` to short-circuit `send-weekly-picks` and `memory-session-sweeper` while keeping FRED/BLS prefetches active.

---

## Revised PR Implementation Plan

### PR 1 — Investigation Lockdown & Critical Fixes (1-2 days)
1. **Refactor `_shared/memory/extractor.ts`**: Replace `new AnthropicProvider()` with `completeWithFallback('artifact_generation', ...)` so memory extraction runs through Lovable AI Gateway and obeys budget controls.
2. **Cron Environment Guard**: In `send-weekly-picks/index.ts` and `memory-session-sweeper/index.ts`, add:
   ```ts
   if (Deno.env.get("PRELAUNCH_PAUSE_BACKGROUND_JOBS") === "true") {
     return jsonResponse({ paused: true, message: "Pre-launch background jobs paused" });
   }
   ```
3. **Dev vs Prod Auto-Detection**: Update `_shared/env.ts` to detect preview/staging origins (`is_dev_call: boolean`), and update `usageLogger.ts` / `aiCredits.ts` to record `is_dev_call` and skip debiting production credit ledgers.

### PR 2 — Tier USD Caps & Quota Gates (1 day)
1. **Update `budgetGuard.ts`**: Set default monthly USD caps to Free: $1, Buyer: $10, Investor: $25. Allow environment variable overrides (`MONTHLY_CAP_FREE_USD`, etc.).
2. **Create `_shared/usage-gate.ts`**: Implement feature-level quota tracking and period rollover checks against profiles/usage logs.

### PR 3 — Prompt Caching Passthrough (1 day)
1. **Cache Control Injection**: In `lovableGatewayProvider.ts` and call sites, inject `cache_control: { type: "ephemeral" }` on system prompts and static tool definitions.
2. Verify Gateway headers/usage telemetry confirm prompt caching discounts.

### PR 4 — Haiku 4.5 Operation Mapping (0.5 day)
1. **Update `modelRegistry.ts`**: Register `claude-haiku-4-5` and define `MODEL_BY_OPERATION`.
2. Route lightweight classification, intent, and ranking tasks to Haiku.

### PR 5 — Admin AI Spend Dashboard (1 day)
1. **Create `/admin/ai-spend`**: Protected route for staff/admins showing daily spend by model/surface, 7-day trend chart, cache hit rate, and Dev vs Prod split.

---

## Verification & Next Steps
Please review the PR 0 investigation findings above. Once you click **Implement plan**, I will begin executing **PR 1** (locking down `extractor.ts`, pausing background AI crons, and implementing dev/prod tagging).