## Publish Article 07 — What a Home Listing Doesn't Tell You

Same pattern used for Articles 03/04.

### 1. Generate images (2 total)
Via `imagegen--generate_image` (standard quality, editorial photo style), saved to `/tmp/`, then uploaded to CDN via `lovable-assets create` and referenced by their public `/__l5e/...` URL inside `body_html`.

- **Hero (1600x900)** — buyer at kitchen table reviewing printed documents, natural window light, documentary style.
- **Inline 1 (1600x900)** — close-up of property tax statement + calculator + pen on desk, no PII, documentary style.

### 2. Insert blog post via migration
Single `INSERT INTO public.blog_posts ... ON CONFLICT (slug) DO NOTHING`:

- **slug**: `what-home-listing-doesnt-tell-you`
- **title / seo_title**: What a Home Listing Doesn't Tell You (And Where to Find It)
- **seo_description**: as provided
- **category**: `Listing Analysis` (matches Article 02 cluster; existing free-text category column, no enum constraint)
- **tags**: `["seller-disclosure","listing-analysis","home-buying","hidden-costs","due-diligence"]`
- **status**: `published`, `published_at = now()`
- **cover_image_url**: hero CDN URL
- **reading_time_minutes**: ~7
- **body_html**: full article converted to semantic HTML
  - `<h2>` per top section, `<h3>` where needed
  - `<p>`, `<ul><li>`, `<strong>`
  - `<cite index="...">` markers stripped, sentences kept
  - Inline `<figure><img><figcaption>` for the tax-statement image after "The Real Tax Bill…" section
  - CTA "Install the HomeLens AI Chrome Extension →" → `<a href="/integrations">` (extension install page on this app)
  - Internal "Continue Reading" links: Article 02 (`/blog/how-to-read-property-listing`), Article 06 (`/blog/why-house-on-market-so-long`), Article 04 (`/blog/how-to-evaluate-neighborhood-before-buying`) — link only slugs confirmed to exist; unknown slugs left as plain `<li>` text
  - FAQ rendered as `<h2>FAQ</h2>` + `<h3>` per question + `<p>` answer (BlogPost page renders FAQ JSON-LD when h3s under an FAQ section exist — same pattern as prior posts)

### 3. Files touched
- New: `supabase/migrations/<ts>_blog_post_listing_gaps.sql`
- New CDN assets (no repo files) for the 2 images

### Not included
- No updates to Articles 02/06 "Continue Reading" (previous articles didn't get retroactive back-links either; ask if you want that now).
- No sitemap regeneration script run (dynamic `/blog/:slug` already covered).
- No Google Search Console "Request Indexing" (manual step on your side).
