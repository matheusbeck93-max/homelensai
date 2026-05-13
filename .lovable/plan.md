## Goal

Connect Google Search Console (GSC) to HomeLens and surface indexing + SEO error data inside `/console` so you can monitor `homelensais.com` without leaving the app.

## Important caveat (please read)

The Lovable GSC connector authenticates **one Google account** (yours) at the workspace level — not each end user. That fits your use case ("my site") perfectly: only you will see the GSC data, and it will always be your verified `homelensais.com` property. End users won't have a personal GSC view.

If you ever wanted each user to see GSC data for their own site, we'd need a different per-user OAuth flow (your own Google Cloud OAuth client, token storage per user). Out of scope here unless you say otherwise.

## What gets built

### 1. Connect the GSC connector

Trigger `standard_connectors--connect` for `google_search_console`. You authorize Google once; the connector exposes `GOOGLE_SEARCH_CONSOLE_API_KEY` to edge functions and refreshes the OAuth token automatically.

### 2. New edge function `gsc-insights`

Calls the GSC API through the Lovable gateway and returns a single normalized JSON payload the UI can render. One function, three upstream calls in parallel:

- `GET /webmasters/v3/sites` — confirm `https://homelensais.com/` is verified.
- `POST /webmasters/v3/sites/{site}/searchAnalytics/query` — last 28 days, dimensions `["page","query"]`, returns top pages + top queries with clicks / impressions / CTR / position.
- `GET /webmasters/v3/sites/{site}/sitemaps` — sitemap submission status, last download time, and `errors` / `warnings` counts per sitemap (this is where "SEO errors" live in the GSC API — Google deprecated the standalone URL Inspection error feed; sitemap errors + Search Analytics drops are the actionable signals available via API).

Restricted to admin only (gated by your user id from `auth.uid()`), since this exposes site-wide SEO data tied to your Google account. Cached for 30 minutes in memory to stay well under GSC quota.

### 3. New "SEO" tab in `/console`

A new `SeoInsightsPanel` component added alongside the existing Overview / Plan / Account tabs. Sections:

- **Verification status** — green check or "Not verified, click to verify" CTA (uses the META verification flow if needed).
- **Sitemap health** — table of submitted sitemaps with last fetched, status, errors count, warnings count. Highlights any non-zero errors in red.
- **Indexing summary** — total indexed pages and 28-day clicks/impressions trend.
- **Top queries (10)** and **Top pages (10)** — sortable tables.
- **Refresh** button + "Last updated" timestamp.

Tab is only visible to your account (admin gate via the same user id check as the edge function).

### 4. Auto sitemap submission (one-time bonus)

On first successful connection, the edge function PUTs `https://homelensais.com/sitemap.xml` to GSC's `/sitemaps/{feedpath}` endpoint so you don't have to do it manually in the GSC UI.

## Technical details

- **Gateway URL**: `https://connector-gateway.lovable.dev/google_search_console/...` with headers `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${GOOGLE_SEARCH_CONSOLE_API_KEY}`.
- **Site identifier**: `https://homelensais.com/` (URL-encoded as `https%3A%2F%2Fhomelensais.com%2F` when used in path segments).
- **Admin gate**: hardcoded check `user.id === <your auth.uid()>` inside the edge function. I'll need you to confirm your user id, or I can read it from the first authenticated session that hits the function and store it in a `gsc_admin_user_id` env var — your call.
- **No new database tables** — GSC is the source of truth; we just proxy and cache in memory.
- **Errors handled**: 401 (re-auth needed → surface "Reconnect Google" CTA), 403 (site not verified → surface verification CTA), quota errors (surface friendly message + retry-after).

```text
/console (Overview | Plan | Account | SEO)
                                       │
                                       ▼
                          SeoInsightsPanel.tsx
                                       │ supabase.functions.invoke("gsc-insights")
                                       ▼
                        supabase/functions/gsc-insights/index.ts
                                       │ fetch (gateway)
                                       ▼
                connector-gateway.lovable.dev/google_search_console
                                       │
                                       ▼
                       Google Search Console API
```

## What I need from you to start

1. Confirm the **admin gate approach**: hardcoded user id, or env var?
2. Confirm the **site URL** in GSC is `https://homelensais.com/` (with trailing slash), not the `www` variant or a Domain property.
3. Approve the plan so I can trigger the GSC connect flow — you'll see Google's OAuth consent screen, pick the Google account that owns `homelensais.com`, and grant read access.