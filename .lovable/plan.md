## New Blog Post: "The Complete Home Buying Process, Step by Step"

Insert one new row into `blog_posts` (published), using the existing schema. No code changes — the existing Blog list and `BlogPost.tsx` page already render everything (Helmet SEO, cover image, prose body, FAQ, tags, related posts).

### 1. Generate 3 images (premium)

Save into `src/assets/` as uploaded assets so URLs are stable:

- `blog-hbp-hero.jpg` — Couple reviewing home purchase documents at a kitchen table (editorial, natural light).
- `blog-hbp-preapproval.jpg` — Overhead desk shot: pre-approval letter, pen, credit report.
- `blog-hbp-inspection.jpg` — Home inspector in hard hat examining basement wall with flashlight.

Upload each with `lovable-assets create` so the article HTML can reference the CDN `.asset.json.url`. The hero becomes `cover_image_url` (absolute CDN URL — `getSignedCoverUrl` already passes `http(s)://` URLs through).

### 2. Compose body HTML

Convert the provided article to sanitized HTML matching what `RichTextEditor` produces and what `prose` styles in `BlogPost.tsx` expect:

- `<h2>` for phase titles and each major section (Quick Answer, Buyer Tips, HomeLens Insight, Practical Checklist, FAQ, Continue Reading).
- `<h3>` for sub-sections (Check Your Credit First, etc.). Sidebar auto-builds TOC from h2/h3.
- `<p>`, `<ul><li>` for bullets, `<blockquote>` where appropriate.
- Two `<figure>` blocks with the two inline images + captions (after Phase 1, after Phase 4).
- FAQ as `<h3>` question + `<p>` answer pairs.
- "Create a free Buyer Account →" as `<a href="/auth">`.
- "Continue Reading" links as inactive text (targets don't exist yet), per source.

### 3. Insert row (published)

Fields:

| Field | Value |
|---|---|
| `slug` | `home-buying-process-step-by-step` |
| `title` | The Complete Home Buying Process, Step by Step (2026) |
| `excerpt` | A complete guide to buying a home in the U.S. — from financial prep to closing day. Real numbers, current mortgage rates, and what to expect at every stage. |
| `category` | Buying Guide |
| `tags` | `{home-buying, first-time-buyer, mortgage, closing, 2026}` |
| `status` | `published` |
| `published_at` | `now()` |
| `cover_image_url` | Absolute CDN URL of hero asset |
| `seo_title` | The Complete Home Buying Process, Step by Step (2026) |
| `seo_description` | (meta description above) |
| `reading_time_minutes` | computed (~14) |
| `author_id` | `NULL` |
| `body_html` | rendered HTML |

Insert via `supabase--insert`.

### 4. Verify

Open `/blog` and `/blog/home-buying-process-step-by-step` in preview to confirm cover, TOC sidebar, images, FAQ, and related posts render.

### Notes / not doing

- No schema changes; `blog_posts` already exists.
- No JSON-LD FAQPage/HowTo work — page already emits `BlogPosting` JSON-LD; adding FAQPage would require touching `BlogPost.tsx`. Ask if you want that added.
- No sitemap edit (public sitemap.xml is generated separately).
