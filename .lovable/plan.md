# HomeLens Master Documentation (DOCX)

An all-in-one reference document covering the product, the technology, the business model, and the security posture of HomeLens. Delivered as a branded Word file in the same style as the credit limits guide (steel blue #6B8DB5 / dark #2C3E55, US Letter, headers and footers, page numbers, section tables).

## What the document will contain

**Part 1 — Product overview**
- What HomeLens is, positioning, slogan, target users (home buyers and rental investors, US market only)
- Value proposition and how it differs from portals like Zillow and Redfin

**Part 2 — Feature catalog (every user-facing surface)**
- AI chat advisor: property analysis by link, Match Score and Investment Score, personalization from profile, voice mode, file attachments, saved chat history
- Search and property pages: listing normalization, price fairness, neighborhood insights and personality, market snapshots, external portal deep links, open houses
- Calculators: Mortgage, Buying Power (simple + advanced assumptions), BRRRR, Investor Calculator (simple/advanced, stress scenarios, ARM, tax modeling, 20-year IRR projections), Market Comparator
- Investor Brief and Investor Console
- My Properties portfolio: owned property tracking, rentals, valuations, improvements, documents, photos, Schedule E
- Saved Analyses, Property Comparison, PDF reports, Excel workbooks
- Alerts and emails: property alerts, weekly picks, open house digests, engagement streaks
- Chrome extension: on-listing analysis, per-tab session isolation, save actions
- MCP integration: connecting Claude / ChatGPT / Cursor
- Blog, marketing feature and solution pages, SEO surfaces

**Part 3 — Plans, pricing, and credits**
- Free / Buyer / Investor tiers with monthly and annual pricing
- Full feature gate matrix (which tier unlocks what)
- AI budget caps, monthly feature quotas, credit packs and top-ups, consumption order, staff bypass
- Condensed version of the existing credit limits guide, cross-referenced

**Part 4 — Technical architecture**
- Frontend stack (React 18, Vite, TypeScript, Tailwind, shadcn), routing and page map
- Backend: Lovable Cloud, database table inventory grouped by domain, storage buckets, triggers and functions
- Edge function catalog grouped by purpose (AI, data, billing, email, cron, extension, MCP) with a one-line description each
- AI stack: hybrid Gemini via gateway plus Perplexity, prompting and tone rules, structured UI-block rendering, tool calling
- External data providers: Zillow/RapidAPI, RentCast, Firecrawl, FRED, BLS, Census, Mapbox, ElevenLabs, Resend, Stripe
- Caching strategy, rate limiting, telemetry and usage logging

**Part 5 — Security, privacy, and compliance**
- Auth model, RLS enforcement patterns, roles table, privileged-column protection triggers
- Secrets handling, service-role boundaries
- Legal pages: privacy, terms, CCPA, DMCA, fair housing, accessibility, cookies

**Part 6 — Operations and appendices**
- Scheduled jobs and cron flows, email infrastructure
- Chrome extension build and release process
- Glossary and quick-reference tables (routes, tables, edge functions, gates)

## Technical notes

- Generated with a Node script using the `docx` library in `/tmp` (same approach as the credit limits guide): explicit US Letter page size, DXA table widths with matching cell widths, `ShadingType.CLEAR`, manual section index rather than an auto TOC (auto TOC rendered blank last time).
- Facts sourced by reading the codebase directly — plan definitions and feature gates, budget guard and usage gate, edge function directory, database schema, RLS policies and triggers, route table in `App.tsx`, memory files. Nothing invented; anything unverifiable is omitted.
- QA: convert to PDF with LibreOffice, render every page to an image, and inspect all pages for clipped text, broken tables, or blank pages before delivery.
- Output: `/mnt/documents/HomeLens-Master-Documentation.docx`. Expect roughly 30-45 pages.
