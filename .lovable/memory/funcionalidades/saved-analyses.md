---
name: Saved Analyses
description: Premium feature to save AI-generated property analyses (app + Chrome extension) into a personal due diligence history at /saved-analyses.
type: feature
---
- Premium-only. Free users see Save button → upgrade modal; /saved-analyses page shows lock card.
- Save button only renders on assistant messages with a parsed `MATCH_SCORE` (real property analyses) — never on generic chat replies or multi-property carousels.
- Score stored as INTEGER 0–100 (MATCH_SCORE × 10). Score circle thresholds on /saved-analyses: green ≥80, yellow ≥50, red <50 (mirrors chat 8/5/<5 on 0–10 scale).
- Table: `public.saved_analyses` with RLS (auth.uid() = user_id) and partial unique index on (user_id, property_url) to prevent duplicates by URL.
- Edge function `save-analysis` enforces premium check (403 `premium_required`) and duplicate check (409 `already_saved`).
- Sources: 'app' (chat) and 'extension' (Chrome). Extension uses `homelens_session.access_token` and posts to `${SUPABASE_URL}/functions/v1/save-analysis`.
- Distinct from removed Favorites/Saved Searches: this stores generated analyses, not external listings.
