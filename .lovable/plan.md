# Homelens mention audit — the other 8 published articles

Measured from the live `blog_posts` rows: mention counts, links to `/features/*`, `/pricing`, and internal blog links.

| Article | Words (approx) | Homelens mentions | Feature links | Pricing link |
|---|---|---|---|---|
| Why Has This House Been on the Market So Long? | ~600 | 2 | 0 | 0 |
| The Complete Home Buying Process (pillar) | ~3,000 | 2 | 0 | 0 |
| How to Analyze a Rental Property (pillar) | ~4,600 | 5 | 0 | 0 |
| How to Evaluate a Neighborhood (pillar) | ~3,900 | 2 | 0 | 0 |
| What a Home Listing Doesn't Tell You | ~2,200 | 3 | 0 | 0 |
| Is a Price Reduction a Good Sign? | ~2,300 | 1 | 0 | 0 |
| How to Compare Two Listings Before an Offer | ~2,600 | 2 | 0 | 0 |
| How to Calculate Cap Rate | ~2,000 | 2 | 0 | 1 |
| How to Research a Neighborhood Online (just updated) | ~1,700 | 4 | 3 | 1 |

The clear gap: **zero `/features/*` links in eight of nine articles**, and the three pillars (the highest-traffic, longest pages) mention Homelens about as often as a 600-word post. Mention density on the pillars is roughly one per 1,500–2,300 words, versus one per ~400 in the article we just fixed.

## Opportunities per article (Pattern A preserved — one Insight section each, plus restrained in-context mentions)

**Home Buying Process (pillar, ~3,000 words)** — biggest miss.
- Affordability / DTI section: link the Buying Power calculator (`/features/buying-power`), which does exactly the front-end/back-end math the section describes.
- Offer / comparison phase: link `/features/property-analysis` and the compare-two-listings cluster post.
- Insight CTA: add `/features/chrome-extension`.

**How to Analyze a Rental Property (pillar)**
- Already 5 mentions but no product links at all. Add `/features/investor-calculator` at the cash-flow/returns math, `/features/brrrr-calculator` where rehab/refinance strategy comes up, `/features/investor-brief` at the market-context section.

**How to Evaluate a Neighborhood (pillar)**
- Only 2 mentions across ~3,900 words. Add `/features/property-analysis` at the risk/tax section and `/features/chrome-extension` where it discusses checking listings, plus a link down to the new online-research cluster post.

**Is a Price Reduction a Good Sign?** — lowest density (1 mention).
- Price-history section is a direct match for `/features/property-analysis` (Homelens reads price history and days-on-market on a listing) and the Chrome extension.

**What a Home Listing Doesn't Tell You**
- The entire premise is what Homelens does. One mention in the "where to find it" section pointing at `/features/property-analysis`, one at `/features/chrome-extension`.

**How to Compare Two Listings**
- Add `/features/saved-analyses` (side-by-side saved analyses) and `/features/property-analysis` in the monthly-cost section.

**How to Calculate Cap Rate**
- Add `/features/investor-calculator` next to the worked example; it already has a pricing link.

**Why Has This House Been on the Market So Long?** (~600 words)
- Already 2 mentions; at that length only one product link is warranted — `/features/property-analysis`.

## Guardrails

- No new capability claims: every mention describes something the product actually does.
- Target density: ~1 mention per 400–600 words, max 2 product links per 1,000 words.
- Pattern A stays: one dedicated Homelens Insight section per article, unchanged in wording; new mentions are in-context sentences.
- Titles, meta, slugs, schema, images, checklists, FAQs and Continue Reading blocks untouched.

## Technical

`body_html` updates only, on the selected `blog_posts` rows. No schema, code, sitemap, or image changes.

## Question before doing anything

Which scope do you want: all eight, only the three pillars (biggest SEO impact), or only the two lowest-density posts (price reduction + listing analysis)?
