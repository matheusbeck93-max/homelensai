## Goal
Publish blog Article 08 at `/blog/is-price-reduction-good-sign` with its hero + inline image, matching the pattern used for Articles 04, 06 and 07.

## Images (generated, then CDN-hosted)
1. Hero (1600x900): for-sale sign with a "Price Reduced" sticker, blurred residential street, overcast documentary light, no agency branding.
   Alt: "For sale sign with price reduced sticker on a residential street".
2. Inline (1600x900): overhead notepad with a handwritten price-history timeline of three drops, pen, printed report, natural window light.
   Alt: "Handwritten price history timeline showing multiple reductions on a notepad".

Both saved to `src/assets/`, uploaded via `lovable-assets`, and referenced by their CDN URLs (same approach as Article 07). Images will be text-free to avoid garbled AI lettering.

## Content insert
A migration inserts one row into `blog_posts`:
- slug `is-price-reduction-good-sign`, status `published`, category `Listing Analysis`
- title, `seo_title`, `seo_description`, excerpt and tags exactly as in the delivery package
- `body_html`: full article as semantic HTML (h2/h3, p, ol/ul, blockquote for the Quick Answer), citations rendered as plain prose with linked source attribution — no `[n]` markers or asterisks
- `cover_image_url`: hero CDN URL; inline image placed after the "One Cut vs. Multiple Cuts" section inside a `<figure>` with caption
- FAQ section marked up and an embedded `FAQPage` JSON-LD script inside `body_html` (same technique as the rental-analysis post)
- reading time computed from word count

## Links
- Internal OUT links: `/blog/why-house-on-market-so-long`, `/blog/what-home-listing-doesnt-tell-you`, `/blog/home-buying-process-step-by-step`. The "Listing Analysis Pillar" (Article 02, "How to Read Any Property Listing Like an Analyst") does not exist yet — I'll omit that link rather than create a dead URL, unless you want a placeholder.
- Chrome Extension CTA embedded naturally in the Browsing Tips section, pointing to the extension page.
- "Continue Reading" sections of Articles 06 and 07 updated with a link to this new post (a small UPDATE in the same migration).

## Sitemap
Add the new URL to `public/sitemap.xml`.

## Not included
Google Search Console "Request Indexing" and CMS checklist items are manual steps on your side after publish.
