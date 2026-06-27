## Plan: Publish first blog post

Insert one row into `blog_posts` as **published**, authored by `matheusbeck93@gmail.com`.

### Fields
- **slug:** `why-house-on-market-so-long`
- **title / seo_title:** "Why Has This House Been on the Market for So Long? (And Is It a Red Flag?)"
- **category:** `Listing Analysis`
- **tags:** `["days on market","buyer tips","listing analysis","red flags"]`
- **excerpt / seo_description:** the provided meta description
- **status:** `published`, `published_at = now()`
- **reading_time_minutes:** ~4 (auto-computed from word count)
- **body_html:** the markdown converted to clean semantic HTML (h2/h3, ul, blockquote for Buyer Tip, anchor for "HomeLens Chrome Extension" CTA → `/extension`)

### Images
Generate 2 cover-style images from the provided prompts and upload to the `blog-covers` storage bucket:
1. Buyer at laptop reviewing "147 Days on Market" listing → used as `cover_image_url`
2. Listing comparison with price history chart → embedded inline in the article body

Both placed at their `<!-- IMAGE 1 -->` / `<!-- IMAGE 2 -->` positions with descriptive `alt` text.

### Not changing
No schema, no UI, no edge functions. The homepage Blog section and `/blog` will pick it up automatically via `usePublishedPosts`.