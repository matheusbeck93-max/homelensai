# Blog layout, images, and SEO indexing

Three issues to fix in one pass.

## 1. Images that actually display

Current cover/inline images are stored as absolute `https://homelensais.com/blog-assets/...` URLs. They only resolve on the live custom domain — on the Lovable preview they 404 (or load slowly from prod), and any post written before the latest deploy breaks until the asset ships.

Fix:
- Migrate the existing post's `cover_image_url` and the inline `<figure><img>` in `body_html` to root-relative paths (`/blog-assets/...`). Vite serves `public/` on preview AND prod, so the same path works everywhere.
- Update `getSignedCoverUrl` in `src/hooks/useBlogPosts.ts` to also pass through paths starting with `/` (currently only `http(s)://` and storage paths are handled).
- Going forward (manual posts I insert for you), I'll store covers as `/blog-assets/<file>.jpg` by default.

## 2. Better blog layout

`/blog` index and `/blog/:slug` look unstructured because:
- Post cards have no featured/hero treatment; all three latest posts look identical.
- Article page uses default `prose` with no styling for `<figure>`, `<blockquote>`, headings spacing, or the cover.
- Reading metadata (date · category · reading time) is cramped.

Changes (presentation only — no business logic):

**`src/pages/Blog.tsx`**
- Featured-post hero (largest, latest published post) with cover, category badge, title, excerpt, "Read article →".
- Below: 2-column grid of remaining posts using existing `PostCard`.
- Sticky search + category filter bar moved above the grid (keep current logic).

**`src/pages/BlogPost.tsx`**
- Wider article column (max-w-3xl → keep, but improve typography).
- Cover image with proper aspect ratio, rounded, subtle border; caption support.
- Add styled rules for `figure`, `figcaption`, `blockquote`, `h2/h3` spacing via Tailwind `prose` modifiers (e.g. `prose-figcaption:text-center prose-blockquote:border-primary prose-headings:tracking-tight prose-img:rounded-lg`).
- Author/date/reading-time row with a divider.
- "Back to blog" + "Share" + related-posts strip (latest 3 from same category) at the bottom.

**`src/components/blog/PostCard.tsx`**
- Add a `variant="featured" | "default"` prop so the featured card on `/blog` can render larger with overlay title; default stays as today.

No schema changes, no edge function changes.

## 3. Per-page URLs indexable in Search Console

`/blog` and `/blog/:slug` already have unique React routes + per-page `Helmet` canonical/og tags, but they are missing from `public/sitemap.xml`, which is why Google won't surface them on its own.

Fix `public/sitemap.xml`:
- Add `https://homelensais.com/blog` (changefreq weekly, priority 0.8).
- Add one `<url>` per published post (`https://homelensais.com/blog/<slug>`) with `<lastmod>` = `updated_at`, changefreq monthly, priority 0.7.

Since posts will grow over time, convert the static `public/sitemap.xml` to a generator so it stays in sync automatically:
- Add `scripts/generate-sitemap.ts` that:
  - Keeps the existing static routes.
  - Fetches `blog_posts` where `status='published'` via the Supabase REST API (anon key, public read policy is already in place) and appends one entry per slug with `<lastmod>`.
  - Writes `public/sitemap.xml`.
- Wire `predev` + `prebuild` in `package.json` to run it.

Then in Search Console: resubmit the sitemap so `/blog` and the post URL get discovered. (I'll note this in the closing message; the resubmission itself is a manual GSC action — or I can call the GSC API to ping it once shipped.)

## Files touched

- `src/hooks/useBlogPosts.ts` — pass-through for root-relative URLs in `getSignedCoverUrl`.
- `src/pages/Blog.tsx` — featured hero + grid layout.
- `src/pages/BlogPost.tsx` — improved typography, figure styling, related posts strip.
- `src/components/blog/PostCard.tsx` — add `featured` variant.
- `public/sitemap.xml` — replaced by generator output (initial commit includes /blog + first post entry).
- `scripts/generate-sitemap.ts` — new generator.
- `package.json` — `predev`/`prebuild` hooks.
- One `UPDATE blog_posts` to rewrite the existing post's cover URL + inline image src to root-relative paths.

## Out of scope

- No changes to the admin editor flow (`/admin/blog`), no new blog posts, no Search Console submissions in code.
