# Roadmap

## Article — Buying a House in a Flood Zone

- [x] Verify the Buyer Account CTA and time-sensitive NFIP statement
- [x] Create and attach the hero and two inline images
- [x] Add the article, schema, internal links, and sitemap entry

## Agentic v1 — Watch → Score → Notify → Propose

- [x] Step 1: Watch Goals backend (`watch-goals-evaluate` cron function, agentic fields in `saved_searches.filters_json`, `alert_events` writes, email digest, daily cron at 12:30 UTC)
- [ ] Step 2: Watch Goals UI (threshold/notify controls in Saved Searches + Console panel) and post-verdict action bar on Property Detail + chat analysis card
- [ ] Step 3: Goal-first chat intents (`create_watch_goal`, `compare_listings` in `CI_SIGNALS_TOOLS`, GOAL intent, wired into `ai-chat` and Chats follow-up chips)

Not in v1: autonomous bidding/offers, autonomous outbound messages, real offer-memo generation.
