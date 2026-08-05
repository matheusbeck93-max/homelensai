# Article 09 — "How to Compare Two Listings Before Making an Offer"

Publish a new blog post at `/blog/how-to-compare-two-listings-before-offer`, with two generated images and the supporting SEO/internal-link updates.

## Images (generated, uploaded to CDN)
- Hero (1600x900): two printed listing sheets side by side on a kitchen table with pen and handwritten notes, natural light, documentary style.
- Inline (1600x900): close-up of a hand writing a monthly cost breakdown (mortgage, taxes, insurance, HOA) with calculator and laptop nearby, no faces.

Both saved as `src/assets/article09-*.jpg.asset.json` pointers and referenced by CDN URL in the post HTML (same pattern as Article 08).

## Post content
- Full article as supplied, converted to HTML: intro, Quick Answer blockquote, the main sections, "When the Quantitative Case Is a Tie", HomeLens Insight with the Buyer Account CTA, the practical checklist, FAQ, and Continue Reading links.
- Citation markers removed; wording kept.
- Hero as cover image; inline image as a `<figure>` with caption right after the Monthly Cost section.
- Schema: HowTo + FAQPage JSON-LD embedded in the body, matching the Article 08 pattern.
- SEO title, meta description, slug, category (Buying Guide), and tags set exactly as specified; reading time computed.

## Internal links
- Out: Home Buying Pillar (`/blog/home-buying-process-step-by-step`), Neighborhoods (`/blog/how-to-evaluate-neighborhood-before-buying`), Price Reduction (`/blog/is-price-reduction-good-sign`), and the listing-analysis article (`/blog/what-home-listing-doesnt-tell-you`).
- In: add this URL to the "Continue Reading" block of the Home Buying Pillar and the listing-analysis article.

## Technical
- One database migration inserts the row into `blog_posts` (status `published`, `published_at` set) and appends the new link to the two existing posts' `body_html`.
- `public/sitemap.xml` updated to include the new URL.

## Note
The package references "Article 02 — How to Read Any Property Listing Like an Analyst"; the closest published post is "What a Home Listing Doesn't Tell You". Links point there unless you want a different target.