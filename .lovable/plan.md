# Publish Article 04 — Neighborhood Evaluation Guide

Add the supplied article as a published post in the existing blog system (`blog_posts` table, rendered by `/blog` and `/blog/:slug`).

## What gets created

A single database migration that inserts one row into `public.blog_posts` with:

- **slug**: `how-to-evaluate-neighborhood-before-buying`
- **title**: How to Evaluate a Neighborhood Before You Buy (2026 Guide)
- **seo_title**: How to Evaluate a Neighborhood Before You Buy (2026 Guide)
- **seo_description**: School ratings, crime data, walkability, commute times, future development — a complete framework for researching any neighborhood before you make an offer.
- **excerpt**: short intro line pulled from the opening
- **category**: `Neighborhoods`  (matches existing category list used in `blog-draft-generate`)
- **tags**: `["neighborhood-research","schools","walkability","home-buying","hoa"]`
- **status**: `published`
- **published_at**: now
- **reading_time_minutes**: computed (~15)
- **cover_image_url**: `null` (no image supplied — post renders without hero; can be added later via admin)
- **body_html**: full article converted from the supplied Markdown-like content to semantic HTML:
  - `<h2>` for each top-level section (Quick Answer, Why Neighborhood Research…, School Quality, Safety and Crime Data, Walkability…, Amenities…, Future Development, HOA, Visit the Neighborhood…, Buyer Tips, HomeLens Insight, Practical Checklist, FAQ, Continue Reading)
  - `<h3>` for sub-sections (e.g. "The Price Premium Is Real and Substantial", "Useful Crime Data Sources")
  - `<p>`, `<ul>/<li>`, `<strong>`, `<em>`, `<a href>` per existing prose styling
  - Inline `<cite>` markers stripped (kept as plain sentences — the site doesn't render `<cite index="...">`)
  - Checklist rendered as `<ul>` with checkbox-style prefix
  - "Table of Contents" omitted — the article page already generates a TOC sidebar from H2/H3 headings automatically
  - CTA "Create a free Buyer Account →" rendered as `<a href="/auth">` link
  - "Continue Reading" section rendered as a `<ul>` of internal links (Articles 01/02/03 as plain text since those slugs aren't confirmed live — will link where slugs exist, otherwise plain list items)

## Files touched

- **New**: `supabase/migrations/<timestamp>_blog_post_neighborhood_guide.sql` — single `INSERT INTO public.blog_posts (...) VALUES (...) ON CONFLICT (slug) DO NOTHING;`

## Not included (out of scope unless asked)

- No hero/inline image generation (image prompts supplied but no images attached). Post will publish without a cover.
- No JSON-LD `HowTo` / `FAQPage` schema — current `BlogPost.tsx` emits `BlogPosting` only. Adding new schema types would be a code change beyond this article.
- No sitemap regeneration script run; sitemap already includes `/blog/:slug` pattern if configured, otherwise a follow-up.
- No updates to Articles 01/02/03 "Continue Reading" sections — those slugs weren't provided.

## After publish

Post appears at `https://homelensais.com/blog/how-to-evaluate-neighborhood-before-buying` and on the `/blog` index and homepage `HomepageBlogSection` (top-3 newest).
