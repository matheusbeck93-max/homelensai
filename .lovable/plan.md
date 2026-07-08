## Publish Article 03 to the blog

Insert the "How to Analyze a Rental Property Before You Buy (2026)" pillar article directly into `blog_posts` via a Supabase migration, so it appears on `/blog` and at `/blog/how-to-analyze-rental-property` immediately without needing to paste it through the admin editor.

### Steps

1. **Convert the article body to semantic HTML** matching the existing editor conventions (`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<a>`; no `<h1>` — title is the page H1). Includes:
   - Quick Answer, Table of Contents, all body sections
   - Investor Tips, HomeLens Insight (with CTA link to `/auth` / investor sign-up)
   - Practical Checklist
   - FAQ section
   - "Continue Reading" list with internal links to Articles 01 and 02 (using their existing slugs if present, otherwise plain text placeholders that can be linked later)
   - HowTo + FAQPage JSON-LD embedded as `<script type="application/ld+json">` blocks inside the body HTML

2. **Insert row via migration** (`supabase/migrations/…_blog_article_03_rental_analysis.sql`):
   - `slug`: `how-to-analyze-rental-property`
   - `title`: `How to Analyze a Rental Property Before You Buy (2026)`
   - `excerpt`: meta description from the brief
   - `category`: `Investing`
   - `tags`: `["rental-property","cap-rate","cash-flow","dscr","brrrr","investing"]`
   - `status`: `published`, `published_at`: now
   - `seo_title` / `seo_description`: as specified
   - `reading_time_minutes`: computed (~14–16 min)
   - `cover_image_url`: `null` (no image asset provided — editor can upload later)
   - `author_id`: `null` (no staff user context in a migration)
   - `body_html`: the converted HTML with embedded JSON-LD
   - `ON CONFLICT (slug) DO UPDATE` so re-running is safe

3. **Continue Reading links**: check if slugs for Articles 01 (home buying pillar) and 02 (listing analysis pillar) already exist in `blog_posts`. If they do, link them; if not, render the titles as plain text so nothing 404s.

### Notes / out of scope

- No hero or inline images (the brief provides prompts, not files). Cover left empty; can be added later via the editor. If you want, I can generate the three images in a follow-up.
- No changes to Articles 01/02 backlinks — request said "add this URL to their Continue Reading" but that's a content edit to other posts; happy to do it in a follow-up once you confirm.
- Google Search Console "Request Indexing" is a manual step in GSC; not automated here.
