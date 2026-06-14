
# HomeLens Stickiness Layer

Live state confirmed before planning: tier model is the canonical 3-tier (`free` | `buyer` | `investor`); all `'paid'`/`'premium'` hits in the code are intentional backward-compat shims. Memory caps use the 3-tier values you specified.

Ships as four phases in one plan (≈14 days). Phase 0 only stands up the minimal email surface the milestone/streak emails need — the dedicated email-alerts prompt later reuses the same schema and adds the digest/reactivation/price-drop crons on top.

---

## Phase 0 — Minimal email infrastructure (≈1.5 days)

Custom Resend-based, **not** Lovable Emails scaffolding, so the email-alerts prompt can build on identical primitives.

**Tables** (one migration; matches the email-alerts spec exactly so it's reusable):

- `email_preferences` — `user_id` PK, `enabled bool default true`, `milestone_celebrations_enabled bool default true`, `streak_reminders_enabled bool default true`, `weekly_review_nudges_enabled bool default true`, `memory_tracking_enabled bool default true`, `digest_frequency text default 'weekly'`, `quiet_hours_start time`, `quiet_hours_end time`, `unsubscribed_at timestamptz`. RLS: user owns own row; service_role full.
- `email_send_log` — `id`, `user_id`, `template`, `recipient_email`, `message_id`, `status` (`pending|sent|failed|bounced|complained|suppressed|skipped_prefs`), `error_message`, `metadata jsonb`, `created_at`. Service_role write-only; user can SELECT own rows.
- `email_suppression` — `email text PK`, `reason text` (`bounce|complaint|unsubscribe|manual`), `created_at`. Service_role only.
- `email_unsubscribe_tokens` — `token text PK`, `user_id`, `created_at`, `consumed_at`.

GRANTs in same migration per project rules. Default-row trigger creates `email_preferences` on profile insert.

**Shared modules** (`supabase/functions/_shared/email/`):

- `resendClient.ts` — thin `fetch` wrapper around Resend API using `RESEND_API_KEY` secret (already in vault). Returns `{ messageId, status }` or throws typed error.
- `sender.ts` — single entry point `sendTransactional({ userId, template, subject, html, text, idempotencyKey, metadata })`. Checks `email_preferences.enabled` + per-feature flag, checks `email_suppression`, writes `pending` row to `email_send_log`, calls Resend, updates row to `sent`/`failed` with `message_id`. Idempotency: `(user_id, template, idempotencyKey)` unique → returns existing row instead of re-sending.
- `templates/base.tsx` — single shared React Email layout (header, content slot, footer with unsubscribe link). Brand colors `#6B8DB5` / `#2C3E55`.
- `templates/registry.ts` — `TEMPLATES: Record<string, { render, subject, featureFlag }>`. Phase 0 ships with one stub `welcome-test` for verification; Phase 1 adds `milestone-celebration`; Phase 3 adds `streak-milestone` and `streak-protection-nudge`.

**Edge functions:**

- `handle-email-unsubscribe` — GET validates token → renders confirm page; POST consumes token → sets `email_preferences.unsubscribed_at` and inserts suppression row.

**Frontend stub:** `/account/email-unsubscribe` route (token in query string) → minimal confirm screen. Full preferences UI is out of scope here; lands with the email-alerts prompt.

**Out of scope (deferred to email-alerts prompt):** weekly digest cron, reactivation cron, search-match cron, price-drop cron, full `/account/email-preferences` UI, Resend webhook for bounces/complaints (Phase 0 only writes suppression manually via unsubscribe).

---

## Phase 1 — Anniversary / Milestone moments (≈4 days)

**Status: shipped.** `delivered_milestones` table + `profiles.timezone` migrated. Rule registry (property / saved / account / market) live under `_shared/milestones/`. Edge functions `milestone-detector` (daily 09:00 UTC cron, cron-auth gated), `milestone-acknowledge`, `milestone-share` (resvg-wasm PNG → `artifacts` bucket, SVG fallback) deployed. Frontend `useStickiness` hook + `MilestoneBanner` (mounted in `App.tsx`) + `MilestoneShareDialog` live. `milestone-celebration` email template registered.

**DB migration** — `delivered_milestones` per spec (user_id, milestone_id, subject_id, detected_at, delivered_in_app, delivered_via_email, acknowledged_at, shared_at, metadata jsonb). Unique on `(user_id, milestone_id, subject_id)`. RLS: user reads/updates own; service_role full.

**Shared rule registry** (`supabase/functions/_shared/milestones/`):

- `types.ts` — `MilestoneRule`, `MilestoneEvent`, `MilestoneSeverity`.
- `rules/property.ts` — appreciation $ tiers, appreciation % tiers, equity %, ownership anniversary, loan paydown %.
- `rules/saved.ts` — price drop tiers, budget threshold cross, cap-rate cross (uses `saved_properties` + user preferences).
- `rules/account.ts` — account anniversary, properties-analyzed counts, subscription anniversary, first-of-something.
- `rules/market.ts` — uses `market_stats` to detect new annual high/low for `profiles.target_cities`.
- `registry.ts` — exports `ALL_RULES`. Cooldown handling per rule.
- `detector.ts` — for one user: loads context (owned props, saved props, account stats, market stats), evaluates all eligible rules, returns `MilestoneEvent[]` not yet in `delivered_milestones`. Tier gating: portfolio rules require ≥1 owned property; account rules all tiers.

**Edge functions:**

- `milestone-detector` — nightly cron (call via existing pg_cron pattern). Iterates active users (last 30d sign-in), runs detector per user, inserts new milestones, enqueues celebration email for `severity: major` (and `notable` for property/market) via `sender.sendTransactional('milestone-celebration', ...)` with idempotency `${milestone_id}:${subject_id}`.
- `milestone-acknowledge` — sets `acknowledged_at`.
- `milestone-share` — generates PNG (see below), uploads to `artifacts` bucket, returns 5-minute signed URL + pre-filled tweet text. Sets `shared_at`.

**Shareable PNG pipeline** — `supabase/functions/_shared/milestones/renderShareImage.ts`:
- Builds 1080×1080 branded SVG (steel-blue gradient, milestone headline, context line, "Tracking with HomeLens · homelensai.com").
- Rasterizes via `@resvg/resvg-wasm@2.6.2` (pinned esm.sh). Wasm initialized lazily on first call (one-time cost per warm instance, acceptable for share-on-click flow). Note: this is server-side wasm in the Edge runtime, not the browser wasm path.
- Falls back to SVG download if rasterization fails.

**Frontend** (`src/components/stickiness/`):
- `MilestoneBanner.tsx` — top banner on My Properties / Investor Brief / Dashboard depending on `category`. Confetti via `canvas-confetti` for `major`; full-screen `Dialog` modal for `major` on first show.
- `MilestoneShareDialog.tsx` — preview + "Download image" + "Copy tweet text".
- `useStickiness.ts` (extended in later phases) — exposes `pendingMilestones`, `acknowledge`, `share`.
- Mount banner host in `App.tsx` shell (one mount, conditional render by route relevance) — minimal touch, no rewrite.

**Email template** — `milestone-celebration.tsx` renders headline + context + inline PNG URL + "View in app" CTA.

---

## Phase 2 — Persistent AI memory (≈5 days)

**DB migration** — `user_memories` per spec. Add CHECK on category, `(user_id, importance desc, last_used_at desc) WHERE NOT user_deleted` index. RLS: user reads/updates/deletes own; service_role full. Tier caps enforced in code, not DB.

**Shared modules** (`supabase/functions/_shared/memory/`):

- `extractor.ts` — Sonnet-based extractor with the exact system prompt from the spec. `summarizeConversation(thread, userId)` returns 0–5 memories. Uses existing `_shared/ai/router.ts` Anthropic provider; budget-tracked like other AI calls.
- `retriever.ts` — `loadMemoriesForContext(userId)` → top 10 by importance × recency. `renderMemoriesBlock(memories)` → injectable system-prompt section (verbatim format from spec, with "creepy vs. natural" instructions).
- `updater.ts` — `update_user_memory` tool definition + handler for in-chat AI calls (reinforce / contradict / mark for review).
- `prune.ts` — enforces tier caps (**Free 25 / Buyer 100 / Investor 250**) via LRU on (importance asc, last_used_at asc). Auto-expire memories not reinforced in 18 months. Runs at end of `memory-summarize-session`.

**Edge functions:**

- `memory-summarize-session` — POST `{ conversationId }`. Loads messages, calls `summarizeConversation`, inserts memories, runs prune. Auth required, RLS-bounded to owner.
- Cron `memory-session-sweeper` — every 10 min, finds `conversations` with no new messages in 10–60 min that haven't been summarized → invokes `memory-summarize-session`. Marks `conversations.last_summarized_at` (new nullable column) to avoid re-runs.

**Integration into chat surfaces:**

- `ai-chat`, `perplexity-chat`, `investor-chat`, `owned-property-chat`, `preferences-chat` — each loads top memories at session start and injects via shared `renderMemoriesBlock`. Single helper added; one-line change per function.
- Tool routing: `update_user_memory` registered in `ai-chat` and `investor-chat` only (the chat surfaces that benefit most from reinforcement).

**Frontend:**

- `src/pages/account/Memory.tsx` (route `/account/memory`) — grouped by category, edit/delete inline, "Forget everything HomeLens remembers about me" (hard DELETE, not soft).
- `src/components/account/MemoryRow.tsx` — single-memory edit.
- Console gets a new "Memory" tab link.

---

## Phase 3 — Engagement streaks + nudges + cross-feature orchestrator (≈3 days)

**DB migration** — `user_engagement_streaks` per spec. Singleton row per user; insert-on-first-engagement. RLS user-owned read; service_role full.

**Shared modules** (`supabase/functions/_shared/streaks/`):

- `engagement.ts` — `recordEngagement(userId, action)` with the skip-protection logic from the spec (1 free skip / Mon–Sun week). Detects newly-crossed milestone tiers (3/7/14/30/60/90/180/365).
- `tierRewards.ts` — Free 30-day → 1 sample Investor Brief; Buyer 90-day → +$5 AI credits (insert into `ai_credit_ledger`); Investor 180-day → `loyal_user` badge flag on profile.

**Edge functions:**

- `streak-engagement-record` — POST `{ action }`, called from frontend on key actions (app open, chat send, analysis run, artifact generated, brief opened). Returns updated streak + any newly-reached milestone.
- `streak-protection-nudge` — daily cron 18:00 user-local (use `profiles.timezone`; default America/New_York). Finds users with `daily_current ≥ 3` who haven't engaged today, skip available → enqueue `streak-protection-nudge` email (respects quiet hours + `streak_reminders_enabled`).
- `streak-milestone-celebrate` — invoked inline by `recordEngagement` when a tier is crossed; enqueues `streak-milestone` email and writes a row into `delivered_milestones` (so the same banner/share flow renders the streak badge).

**Frontend:**

- `src/components/stickiness/StreakIndicator.tsx` — header pill (🔥 N) in `Navigation`. Hidden when `streak_tracking_disabled` (new `profiles.streak_tracking_disabled bool`).
- `StreakPopover.tsx` — click-expand panel.
- `WeeklyReviewCard.tsx` — appears in dashboard on Sunday 14:00–20:00 local; aggregates the week's events (saved props, analyses, price drops in saved, new search matches).
- `useStickiness.ts` extended — `streak`, `pendingMilestones`, `weeklyReview`.

**Cross-feature orchestrator** (`supabase/functions/_shared/stickiness/orchestrator.ts`):
- Pure function `routeStickinessEvent(event)` called from the relevant edge functions on key events (milestone detected, streak milestone, chat session summarized, saved property added). Routes to email + memory + streak per the table in the spec.

**Telemetry** — single `_shared/telemetry/stickiness.ts` helper writing to existing `ai_usage_log`-style telemetry pattern (or new `stickiness_events` table if simpler — decide during build).

---

## Per-tier behavior

| Feature | Free | Buyer | Investor |
|---|---|---|---|
| Memory cap | 25 | 100 | 250 |
| Portfolio milestones | n/a | yes | yes |
| Saved / account / market milestones | yes | yes | yes |
| Streak tracking + weekly review | yes | yes | yes |
| Streak rewards | 30d sample brief | +$5 credits at 90d | loyal badge at 180d |

---

## Files in scope

**New tables (4 migrations):** `email_preferences` + `email_send_log` + `email_suppression` + `email_unsubscribe_tokens`; `delivered_milestones`; `user_memories`; `user_engagement_streaks`. Plus `profiles.streak_tracking_disabled`, `profiles.timezone` (if missing), `conversations.last_summarized_at`.

**New edge functions:** `handle-email-unsubscribe`, `milestone-detector` (cron), `milestone-acknowledge`, `milestone-share`, `memory-summarize-session`, `memory-session-sweeper` (cron), `streak-engagement-record`, `streak-protection-nudge` (cron), `streak-milestone-celebrate`.

**New `_shared/` modules:** `email/{resendClient,sender,templates/*}`, `milestones/{types,rules/*,registry,detector,renderShareImage}`, `memory/{extractor,retriever,updater,prune}`, `streaks/{engagement,tierRewards}`, `stickiness/orchestrator`.

**Frontend (new):** `pages/account/Memory.tsx`, `pages/account/EmailUnsubscribe.tsx`, `components/stickiness/{MilestoneBanner,MilestoneShareDialog,StreakIndicator,StreakPopover,WeeklyReviewCard}.tsx`, `components/account/MemoryRow.tsx`, `hooks/useStickiness.ts`.

**Frontend (minimal edits):** `App.tsx` (3 route additions + banner host), `components/Navigation.tsx` (streak pill), 5 chat surfaces (one-line memory injection each), Console (Memory tab link).

---

## Verification (subset from spec)

- Bump an owned property `current_value_estimate` past a $25k tier → `milestone-detector` writes row → banner renders → "Share" downloads PNG → tweet text in clipboard.
- 6-message chat, wait ≥10min → sweeper triggers summarizer → 1–3 `user_memories` rows. New chat session references them naturally.
- Edit/delete a memory; "Forget everything" hard-deletes. Tier cap prunes correctly.
- Open app 7 days, day 8 skipped → free skip kicks in; second miss same week breaks streak. Milestone email at day 7.
- Disable `streak_tracking_disabled` → pill disappears, engagement events still recorded but streak not surfaced.
- Phase 0 verification: send `welcome-test` to self → `email_send_log` row → email arrives → unsubscribe link works.

---

## Risks & open items

- **resvg-wasm cold start** in Edge runtime is ~150ms first call; acceptable on-demand. If it proves flaky, fallback to returning SVG-only is already wired.
- **Sunday weekly review aggregation** may be heavy; cache last-built per user in `localStorage` + revalidate.
- **Memory extraction quality** — first 2 weeks watch `memory_delete_rate`; if >15%, tighten extractor prompt thresholds.
- **Resend API key** — confirmed user is provisioning today; Phase 0 code can deploy and `welcome-test` will start succeeding once secret lands.
- **Backward-compat shims** in `aiCredits.ts` / `ai-chat.ts` / `ai-analyze.ts` (`'paid'`/`'premium'` strings) are left untouched — they're intentional aliases over a separate internal enum, not stale migration spots. Cleaning them up is a separate refactor.
