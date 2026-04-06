

# HomeLens Full Blueprint Document (PDF)

## What this plan does
Generate a comprehensive, professionally formatted PDF blueprint document covering all 11 sections requested by the user, based on the full codebase analysis already performed.

## Technical approach
- Use Python with `reportlab` to generate a multi-page PDF at `/mnt/documents/HomeLens_Blueprint.pdf`
- Include all 11 sections: Overview, Tech Stack, Architecture, File Structure, DB Schema, Auth, Features, APIs, User Flows, Gaps, Next Steps
- Professional formatting with consistent headers, colors matching HomeLens brand (#0EA5E9), and clear section separation

## Content Summary

### 1. Project Overview
HomeLens — AI-powered real estate decision platform. Slogan: "Big decisions deserve the full picture." Target: US home buyers and investors. Not a listing site — a decision engine for affordability, risk, and long-term cost analysis.

### 2. Tech Stack
Frontend: React 18 + TypeScript + Vite 5 + Tailwind CSS v3 + shadcn/ui + Framer Motion + Recharts + Mapbox GL + React Router v6 + TanStack Query + PWA (vite-plugin-pwa)
Backend: Supabase (PostgreSQL + 31 Edge Functions + Auth + RLS)
AI: Perplexity API, OpenAI, Lovable AI Gateway
Payments: Stripe
Other: xlsx, lottie-react, react-markdown, Sentry, ElevenLabs TTS

### 3. Architecture Diagram (ASCII)
Browser → React SPA → Supabase Client → Edge Functions → External APIs (Zillow/RapidAPI, Perplexity, OpenAI, Stripe, Mapbox, ElevenLabs, Rentcast, Firecrawl)

### 4. File Structure
src/pages (23 pages), src/components (80+ components), src/hooks, src/lib, src/utils, src/types, supabase/functions (31), chrome-extension, remotion

### 5. Database Schema
17 tables: profiles, conversations, messages, properties, favorites, saved_searches, saved_calculations, portfolio_properties, compare_sets, alert_events, alert_preferences, sent_alerts, market_metrics, market_snapshots, search_cache, state_tax_cache, programs, property_snapshots, property_vectors, weekly_picks_history, rates, analyses

### 6. Auth & Roles
Supabase Auth with email/password. Two tiers: Free and Premium ($4.97/mo). Feature gating via FEATURE_GATES. RLS on all tables using auth.uid(). No admin roles table — subscription_status on profiles.

### 7. Core Features & Pages
Home + AI Chat, Property Detail, Calculators (Buying Power, Mortgage, Investor), Property Comparison, Portfolio, Console (dashboard), Pricing, Saved Searches, Chats History, Chrome Extension, Profile Setup, Legal pages

### 8. APIs & Integrations
Zillow/RapidAPI, Perplexity, OpenAI, Stripe, Mapbox, ElevenLabs, Rentcast, Firecrawl, Census API, Lovable AI Gateway

### 9. User Flows
Search flow, URL analysis flow, calculator flow, comparison flow, subscription flow, alert flow

### 10. Known Gaps
- Annual Stripe price ID is placeholder
- No admin dashboard
- No roles table (subscription on profiles — not ideal per security best practices)
- Chrome extension not yet published
- No automated tests
- Remotion video generation is separate project

### 11. Suggested Next Steps
1. Add proper user_roles table
2. Replace annual plan placeholder Stripe price ID
3. Add admin dashboard
4. Publish Chrome extension
5. Add automated testing
6. Add email verification enforcement

## Implementation
Single script execution generating PDF with reportlab, followed by QA via pdftoppm inspection.

