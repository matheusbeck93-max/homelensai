# Agentic v1 — Watch → Score → Notify → Propose

Make HomeLens explicitly agentic with the smallest amount of new surface area, reusing the alerting, saved-search, weekly-picks and Match Score machinery that already exists. Human stays in the loop: the agent watches, scores, notifies and proposes — it never sends, shares or offers on its own.

## 1. Standing Watch Goals

A Watch Goal = criteria + Match threshold + notify cadence. It reuses the existing `saved_searches` table instead of creating a parallel one.

Reused, exactly:
- Table `saved_searches` — `query_text`, `filters_json`, `alert_enabled`, `alert_frequency`, `last_alert_sent`, `user_id`. Agentic fields go inside `filters_json` (`match_threshold`, `notify` = `in_app` | `email` | `both`, `goal_kind` = `watch_area` | `watch_similar` | `watch_price_drop`, `seed_property`), so no column migration is required for v1.
- Table `alert_events` — the in-app notification feed (`type`, `message`, `property_snapshot`, `read`). It has no foreign key to `properties`, so live listings from the feed can be written to it directly.
- Table `email_send_log` + `email_preferences` — email delivery + opt-out, same as the existing digests.
- Function `search-listings` — the only real-listing source (never `ai-search` mock inventory, which was already removed).
- Shared `_shared/matchScore.ts` — the 0–10 score contract, tool definition, parser and repair pass.
- Shared `_shared/cronAuth.ts`, `_shared/cron-log.ts`, `_shared/ai/router.ts` and the `PRELAUNCH_PAUSE_BACKGROUND_JOBS` guard — the same wrapper pattern as `send-weekly-picks` and `property-alerts-evaluate`.

New: one cron edge function `watch-goals-evaluate`, modelled line-for-line on `property-alerts-evaluate`:
1. Read enabled `saved_searches` whose `alert_frequency` window has elapsed since `last_alert_sent`.
2. Call `search-listings` with `filters_json`.
3. Deterministic prefilter (price / beds / baths / location / new-or-price-dropped since last run) to cap LLM spend.
4. Score the top N survivors with the existing Match Score contract against the user's `profiles` preferences.
5. Anything at or above `match_threshold` → insert an `alert_events` row and, when notify includes email, send one grouped digest through Resend + `email_send_log`.
6. Stamp `last_alert_sent`.

Not reused on purpose: `sent_alerts` (foreign-keyed to `properties`, which does not hold live listings) and `check-property-alerts` (snapshot diffing of the `properties` table, a different job).

UI: `src/pages/SavedSearches.tsx` and `src/components/console/SavedSearchesPanel.tsx` gain threshold + notify controls and rename the object to "Watch Goal"; `src/components/console/AlertsPanel.tsx` already renders `alert_events` and needs only the new event type.

## 2. Post-verdict agent action bar

Rendered directly under the Verdict block on `src/pages/PropertyDetail.tsx` and under the Match Score in the chat analysis card, only when `matchScore` is non-null:
- **Watch similar** → creates a Watch Goal seeded from this listing's city/price band/beds.
- **Notify on price drop** → creates a `watch_price_drop` goal pinned to this listing URL.
- **Save** → existing `save-analysis` function, unchanged.
- **Draft offer memo** → placeholder in v1: opens a disabled/"coming soon" state or a chat prefill; no document generation.

Each successful action writes one confirmation line and the resulting goal id, so the user always sees what the agent committed to.

## 3. Goal-first chat intents

`_shared/conversationalSignals.ts` already carries an ACTION intent and a `CI_SIGNALS_TOOLS` list including `create_alert`, `find_matches`, `save_property`. v1 upgrades this from one-shot chips to a short tool plan:
- Add `create_watch_goal` and `compare_listings` to `CI_SIGNALS_TOOLS`.
- Add a GOAL intent to `ciBehaviorPromptBlock`: when the user says "watch…", "find…", "compare…", the assistant states a one-line plan, asks at most one clarifying question, then executes the steps in order — e.g. *watch* = resolve criteria → confirm threshold → create goal → confirm cadence; *find* = `search-listings` → score top results → offer to turn the search into a goal.
- Wire it in `ai-chat` (main + extension paths) and surface the plan steps in `src/pages/Chats.tsx` through the existing follow-up chip handler, so no new UI framework is needed.

## 4. Not in v1

- No autonomous bidding, offers or price negotiation.
- No sending email, messages or shares to third parties (agents, sellers) without an explicit human click.
- No real offer-memo document generation — placeholder only.
- No new autonomous spending, no per-listing LLM scoring without the deterministic prefilter and existing budget guard.
- No changes to Investor Console Match Score rules (it still forbids the prefix), and no new tables or schema migrations.

## 5. Implementation order (3 follow-up edits)

1. **Watch Goals backend** — `watch-goals-evaluate` cron function, `filters_json` agentic fields, `alert_events` writes, email digest, cron registration.
2. **Watch Goals UI + action bar** — threshold/notify controls in Saved Searches + Console panel, and the post-verdict action bar on Property Detail and the chat analysis card.
3. **Goal-first chat** — new tools and GOAL intent in `conversationalSignals.ts`, wired into `ai-chat` and the Chats follow-up handler.

## Technical notes

- No migration in step 1; if `filters_json` proves awkward we add `match_threshold numeric` and `notify text` to `saved_searches` in step 2 with matching GRANTs and existing user-scoped RLS.
- Scoring in cron runs through `_shared/ai/router.ts` with the surface flag + budget guard, so per-user AI spend stays inside the caps already set ($0.15/$0.60/$1.50 daily).
- Free tier: Watch Goals capped (suggest 1 goal, weekly cadence); Premium gets more goals and daily cadence, enforced in the cron read and the create path.
