# HomeLens — End-to-End Blueprint Report

## Goal

Produce a single comprehensive **Markdown report** (`HomeLens-Blueprint.md`) downloadable from `/mnt/documents/`, designed to be uploaded into your Claude coworker account as project context. Markdown is the best format for LLM ingestion (clean structure, no binary noise, easy to chunk).

## Deliverable Format

- **File:** `/mnt/documents/HomeLens-Blueprint.md` (~30–50 KB)
- **Companion:** `/mnt/documents/HomeLens-Blueprint.pdf` (human-readable version) — optional second file for visual review

Ask if you'd also like the PDF, or just the .md.

## Report Structure (sections)

1. **Executive Summary** — Vision, slogan, target users, value prop
2. **Tech Stack** — React 18 + Vite + TS, Tailwind, shadcn-ui, Lovable Cloud (Supabase), Lovable AI Gateway
3. **Brand & Design System** — Color palette (steel blue `#6B8DB5`, dark `#2C3E55`), typography, header standards, mobile UX rules
4. **Frontend Architecture**
   - Route map (all 24 pages: Index, Auth, Chats, Console, Investor, Calculators, Pricing, PropertyDetail, Portfolio, Compare, ProfileSetup, ExtensionPrivacy, legal pages, etc.)
   - Key components by domain (chat, console, portfolio, subscription, ui-blocks, property)
   - Hooks (useSubscription, useAiCredits, usePropertySearch, useSavedChats, useTypingPlaceholder)
   - State management (TanStack Query, ComparisonContext)
   - PWA configuration
5. **Backend — Edge Functions** (all 31 functions catalogued):
   - AI: `ai-chat`, `ai-analyze`, `ai-search`, `ai-build-search-spec`, `perplexity-chat`, `property-assistant`, `neighborhood-personality`, `neighborhood-insights`, `compare-properties-ai`, `calculator-insights`, `ai-suggest-location`, `ai-analyze-property`
   - Property data: `search-listings` (Zillow), `fetch-property` (Firecrawl fallback), `enrich-property`, `market-snapshot`, `market-trends`, `get-state-tax-data`
   - Subscription: `create-checkout`, `check-subscription`, `customer-portal`, `manage-subscription`
   - Media/Voice: `elevenlabs-tts`, `realtime-token`, `generate-image`, `generate-property-pdf`
   - Alerts: `check-property-alerts`, `send-weekly-picks`, `investment-projections`
   - Utils: `get-mapbox-token`
   - For each: purpose, inputs, JWT verification status, secrets used
6. **Database Schema** — All 22 tables documented with columns, RLS policies, relationships
7. **AI Architecture**
   - Hybrid model strategy (Gemini 2.5 Flash via Lovable AI Gateway as primary, Perplexity for real-time)
   - Decision-First communication style rules
   - Match Score contract (`MATCH_SCORE: X/10`)
   - UIBlock rendering pipeline (structured JSON → React)
   - Workflow Excel generation
   - Personalization activation logic
8. **External APIs & Connectors**
   - **Lovable AI Gateway** (Gemini, GPT-5 family) — primary
   - **Perplexity** (connector) — real-time search
   - **ElevenLabs** (connector) — TTS voice "Eric"
   - **Zillow via RapidAPI** — property listings
   - **Firecrawl** — markdown scraping fallback
   - **RentCast** — property insights
   - **Census API** — demographics
   - **Mapbox** — maps
   - **Resend** — email alerts
   - **Stripe** — payments
   - **Sentry** — error monitoring
9. **Stripe / Subscriptions**
   - Tiers: Free ($0), Premium ($4.97)
   - Currency display logic (USD always; "Real" only appears in Stripe Checkout for BR-located cards)
   - Feature gates (Portfolio Builder, AI credits, weekly picks, alerts)
   - Edge functions: checkout, check-subscription, customer-portal, manage-subscription
10. **Chrome Extension** (`chrome-extension/`)
    - Manifest V3, Vite (popup) + esbuild IIFE (background/content)
    - Listing detection logic (confidence scoring on real estate portals)
    - Visual identity (white house outline, dark `#1E2D3D` injected button)
    - Dual route strategy (Perplexity vs ai-chat)
    - Session isolation (per-site `chrome.storage.session`)
    - Build & publishing workflow (.github/workflows/build-extension.yml)
11. **Security Posture**
    - RLS on every user-owned table (`auth.uid()` enforcement)
    - Secrets management (no hardcoded keys, all via Lovable Cloud)
    - PWA OAuth fallback denylist
    - Sentry data masking
    - Backend hardening (structured logs, `current_setting()` SQL)
12. **Key Business Logic & Formulas**
    - Match Score thresholds (Green ≥8, Yellow ≥5, Red <5)
    - Fair Price Indicator (vs Zestimate)
    - Investor Calculator (Simple vs Advanced, automatic PMI, separate state/fed gains)
    - Search cache (15min TTL, stale-while-revalidate)
13. **File-Level Map** — Tree of important paths with one-line descriptions
14. **Glossary & Memory Index** — All `.lovable/memory/` rules summarized
15. **Known Constraints & Removed Features** — No Favorites, no Saved Searches, English only, US Real Estate only

## Process

1. Read remaining key files in parallel: `src/App.tsx` (routes), `chrome-extension/manifest.json`, `src/lib/subscriptionPlans.ts`, edge function index files, `tailwind.config.ts`, `src/index.css`, all `.lovable/memory/*` files
2. Generate `HomeLens-Blueprint.md` via a single write script
3. Verify file size + section completeness
4. Emit `<lov-artifact>` for download

## Notes

- **No code changes** to the app itself — this is purely a documentation export
- Output is **LLM-optimized** (clear headings, tables, fenced code blocks, no emojis in headings, consistent depth)
- I will **not** include secret values, only secret names
- Estimated time: single message after approval
