# Article 10 — "How to Calculate Cap Rate on a Rental Property (2026)"

Publish a new Investing cluster post at `/blog/how-to-calculate-cap-rate-rental-property`, with three generated images and the supporting internal-link and sitemap updates.

## Images (generated, stored as CDN asset pointers)
- Hero (1600x900): duplex rental exterior in early morning light, documentary style, no people or signage.
- Inline 1: hand writing figures into a paper ledger beside a laptop, no face visible.
- Inline 2: residential street of small multifamily buildings, overcast midday light.

Saved as `src/assets/article10-*.jpg.asset.json` pointers and referenced by CDN URL in the post HTML, matching the Article 08/09 pattern. Each gets the supplied alt text and caption.

## Post content
Full article converted to semantic HTML: intro, Quick Answer block, the six main sections, the worked-example table, Investor Tips, Homelens Insight (Pattern A, Investor Account CTA), Practical Checklist, FAQ, and Continue Reading links. Table of Contents comes from the existing on-page sidebar, so it is not duplicated in the body. Hero becomes the cover image; the two inline images sit as `<figure>` blocks after the worked example and after the financing-costs section.

- Category: Investing. Tags: cap rate, noi, rental property, investing, roi.
- SEO title, meta description, slug set exactly as specified; reading time computed.
- Schema: Article + FAQPage JSON-LD embedded in the body (same pattern as Articles 08/09).

## Internal links
- Out: pillar `/blog/how-to-analyze-rental-property`, plus `/blog/what-home-listing-doesnt-tell-you` and `/blog/how-to-compare-two-listings-before-offer`.
- In: append this article's link to the Continue Reading block of those same three posts, so the Investing pillar finally links down to a cluster.

## Technical
- One database migration inserts the row into `blog_posts` (status `published`, `published_at` set) and appends the inbound link to the three existing posts' `body_html`.
- `public/sitemap.xml` updated with the new URL.

## Not included
`content-map.json` does not exist in this project, and Search Console indexing requests plus the Instagram carousel are done outside the app.
