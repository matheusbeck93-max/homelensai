## Diagnosis

**Group A — "Alternate page with proper canonical tag" (not a bug in most cases)**

- `/investors`, `/extension`, `/chat-preview`, `/plans` are client-side `<Navigate replace>` redirects to real pages (`/solutions/investor`, `/features/chrome-extension`, `/features/ai-chat`, `/pricing`). Google runs the JS, sees the canonical of the destination, and correctly labels the source URL as an alternate. The real issue: **the sitemap advertises these redirect-only URLs**, which makes GSC flag them repeatedly and dilutes crawl budget. They should not be in the sitemap.
- `/auth?mode=signup` — canonical strips the query string, so Google treats it as an alternate of `/auth`. Expected and correct; there's nothing to fix in code. It shows up only because internal CTAs link to it.

**Group B — "Crawled - currently not indexed"**

- `/features/ai-chat`, `/features/property-analysis`, `/features/my-properties` were previously self-canonicaling to `/` (fixed in the previous turn). Google has crawled but not re-processed them yet.
- Compounding factor: none of the `/features/*` or `/solutions/*` routes are in the sitemap, so Google hasn't been told these are indexable priority pages.

## Fix (sitemap generator only — no page code changes)

Edit `scripts/generate-sitemap.ts`:

1. **Remove the redirect-only entries** from `staticEntries`: `/extension`, `/investors`, `/chat-preview`, `/plans`.
2. **Add every feature and solution route** so Google discovers them and picks up the corrected canonicals:
   - `/features/chrome-extension`, `/features/ai-chat`, `/features/buying-power`, `/features/investor-brief`, `/features/investor-calculator`, `/features/saved-analyses`, `/features/my-properties`, `/features/preferences`, `/features/property-analysis`
   - `/solutions/buyer`, `/solutions/investor`
   - `changefreq: "monthly"`, `priority: "0.8"` for both groups.
3. Leave everything else (blog fetch, base URL, other static entries) untouched.

The generator already runs on `predev`/`prebuild`, so `public/sitemap.xml` regenerates on the next publish.

## Nothing else needed

- `robots.txt`: no change.
- Per-page canonicals: already fixed in the previous turn (`SeoCanonical` component).
- `/auth?mode=signup`: no code change — this is expected canonical behavior. If you want it fully gone from GSC, we can noindex `/auth` later, but that's a separate call.

## Verification after publish

- Open `https://homelensais.com/sitemap.xml` and confirm the 4 redirect URLs are gone and the 11 feature/solution URLs are present.
- In GSC, resubmit the sitemap and click "Request Indexing" on the 3 flagged feature pages so Google re-crawls with the corrected canonicals.
