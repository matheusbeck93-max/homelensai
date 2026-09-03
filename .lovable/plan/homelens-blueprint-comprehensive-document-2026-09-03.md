# HomeLens Blueprint — Comprehensive Document

## Goal
Generate a single, exhaustive "blueprint" document (DOCX, then PDF) covering every HomeLens functionality, its purpose, the architecture, the plans/credits system, and the security posture — reflecting the **current** codebase (pricing changes, Match Score free trial, separated daily/monthly AI caps, 11 blog articles, v1.0.8 Chrome extension). This supersedes the Aug 6 Master Documentation, which is now out of date.

## Repository note (GitHub)
HomeLens does **not** have a public GitHub repository. The code lives in the Lovable project (git remote is Lovable's private code storage). The blueprint will state this plainly and reference:
- **Lovable project URL:** https://lovable.dev/projects/995dc9c4-dd63-4700-b1b9-8042e8a57f20
- **Published site:** https://homelensais.com
- **Git Sync option:** the owner can enable two-way Git Sync to a GitHub repo from workspace Git settings; no public repo exists today.

## Document structure (~35–45 pages, branded steel blue #6B8DB5 / dark #2C3E55, US Letter, headers/footers, page numbers, tables)

**Part 1 — Product Overview**
- What HomeLens is, slogan ("Big decisions deserve the full picture."), target users (US home buyers + rental investors), positioning vs. Zillow/Redfin.
- Live URLs and the repository/repo-link explanation above.

**Part 2 — Feature Catalog (every user-facing surface)**
A table or subsection per surface, with purpose + tier gating:
- AI Chat Advisor (`/chats`): property analysis by URL, Match Score (free 3/day) & Investment Score, personalization from profile, voice mode (TTS), file attachments (5×10MB), saved history, Excel workflow blocks.
- Property Detail (`/property/:id`): listing normalization, fair-price score, neighborhood insights + personality, market snapshots, external portal deep links, open houses, PDF export.
- Calculators (`/calculators`): Mortgage, Buying Power (simple + advanced assumptions, "set as budget preference"), BRRRR.
- Investor Calculator (`/investor/calculator`): Simple & Advanced, stress scenarios (Bear/Base/Bull), ARM modeling, MFJ tax modeling, 20-year IRR projections, Market Comparator, BRRRR tab.
- Investor Brief (`/investor`): KPI tiles, topic cards, concierge chat.
- My Properties (`/investor/properties`): owned-property tracking, rentals, valuations, improvements, documents, photos/cover images, Schedule E.
- Saved Analyses (`/saved-analyses`): tabbed detail, AI summary, Match Score breakdown bars, save from app + extension.
- Compare (`/compare`): side-by-side property comparison.
- Pricing (`/pricing`), Checkout success, Account usage (`/account/usage`), Memory (`/account/memory`).
- Alerts & email: property alerts, weekly picks, open-house digest, engagement streaks, milestone banners.
- Chrome Extension (v1.0.8): on-listing analysis, per-tab session isolation, save actions, macro badge, preference follow-ups.
- MCP integration (`/integrations`): connect Claude / ChatGPT / Cursor to HomeLens tools (14 tools).
- Blog (`/blog`), marketing Feature & Solution pages, SEO surfaces (sitemap, llms.txt, robots).
- Auth (`/auth`), Profile setup (`/profile-setup`), Console (`/console`), Settings, OAuth consent, legal pages (privacy, terms, CCPA, DMCA, fair-housing, accessibility, cookies, extension-privacy, do-not-sell).
- Staff/admin: blog admin + editor, AI spend admin, telemetry admin.

**Part 3 — Plans, Pricing & Credits**
- Tier table: Free $0 / Buyer $9.97 mo ($7.97 mo annual, $95.64/yr) / Investor $24.97 mo ($19.97 mo annual, $239.71/yr).
- Full feature-gate matrix (from `FEATURE_GATES`) — which tier unlocks what, including the new free-tier Match Score trial (3 analyses/day).
- AI budget caps: **daily** $0.15 / $0.60 / $1.50; **monthly** $1 / $10 / $25 (separated ladder, env-overridable). Staff bypass.
- Monthly feature quotas: chats 20/500/2000, photos 1/10/50, investor briefs 3/30/100.
- Legacy token-credit system, credit packs & top-ups, consumption order (plan credits → top-up FIFO, 90-day expiry).
- Budget guard mechanics: `budget-status` polling, 402 `budget_exceeded` payload, credits kick in after cap for paid users.

**Part 4 — Technical Architecture**
- Frontend stack: React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui, react-helmet-async, PWA.
- Route map (from `App.tsx`): ~50 routes listed.
- Backend: Lovable Cloud (Supabase). 116 migrations; table inventory grouped by domain (auth, profiles, properties, saved analyses, owned properties, AI usage, credits, alerts, milestones, blog, extension).
- Edge function catalog: **~70 functions** grouped by purpose (AI, property data, market data, billing, email/cron, extension, MCP, admin) with one-line descriptions.
- AI stack: hybrid — Gemini via Lovable AI Gateway (primary), Perplexity (real-time search), Anthropic Sonnet/Haiku (chat/analysis/briefs), OpenAI Realtime (voice), ElevenLabs (TTS). Decision-first prompting + tone rules, structured UI-block rendering, tool calling (follow-up tools).
- External data providers: Zillow/RapidAPI, RentCast, Firecrawl, FRED, BLS, Census, Mapbox, Stripe, Resend.
- Caching: 15m stale-while-revalidate (search), 24h (state tax), 7d (FTHB/neighborhood).
- Telemetry & usage logging (`ai_usage_log`, usage events).

**Part 5 — Security, Privacy & Compliance**
- Auth model (Supabase Auth, Google OAuth, email/password), `ProtectedRoute`, session handling.
- RLS enforcement via `auth.uid()`, `user_roles` table + `has_role()` security-definer, privilege-escalation triggers on `profiles`, `state_tax_cache` service-role-only, `property_vectors` restricted, realtime deny-all.
- Secrets handling, service-role boundaries, Sentry masking.
- Legal pages inventory.

**Part 6 — Operations & Appendices**
- Cron/scheduled jobs: property alerts, weekly picks, open-house digest, FRED/BLS prefetch, memory session sweeper, streak protection.
- Email infrastructure (Resend).
- Chrome extension build/release process (Vite popup + esbuild IIFE, version 1.0.8).
- Glossary + quick-reference tables: routes, edge functions, feature gates, tier matrix.

## Technical approach
- Generate with a Node script using the `docx` library in `/tmp` (same proven approach as the credit-limits guide and prior master doc): explicit US Letter page size, DXA table widths with matching cell widths, `ShadingType.CLEAR`, manual section index (auto-TOC rendered blank previously), overridden Heading1/Heading2 styles, headers/footers with page numbers.
- Facts sourced by reading the codebase directly (plans, gates, budgetGuard, App.tsx routes, edge function directory, migrations, manifest, memory). Nothing invented; anything unverifiable is omitted.
- QA: convert to PDF with LibreOffice, render every page to an image, inspect all pages for clipped text/broken tables/blank pages before delivery.
- Output: `/mnt/documents/HomeLens-Blueprint.docx` (+ `.pdf`).

## Deliverables
- `/mnt/documents/HomeLens-Blueprint.docx`
- `/mnt/documents/HomeLens-Blueprint.pdf`
- Present both via `<presentation-artifact>`.
- In the chat reply, also state the repository situation plainly (no public GitHub repo; Lovable project link; Git Sync option).
