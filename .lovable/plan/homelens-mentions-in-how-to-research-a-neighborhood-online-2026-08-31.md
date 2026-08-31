# Homelens mentions in "How to Research a Neighborhood Online"

## What the article does today

Verified against the published post: it contains two "Homelens" mentions, both inside the single Homelens Insight section, plus one `/pricing` link and three internal blog links. That matches Pattern A and the cap rate article (also 2 mentions, 1 pricing link). Earlier articles have zero mentions, so this one is already ahead of the norm.

## Opportunities being missed

Three sections describe research that Homelens already does, and none of them says so:

1. **Flood and environmental risk** — Homelens has a state tax + flood-risk lookup that returns flood-zone indicators for an address, used by the AI chat and the MCP tools. The article sends readers to FEMA and stops there.
2. **School district funding / neighborhood data** — Homelens surfaces neighborhood insights (schools, market trends) on a listing. Not referenced.
3. **Where online research stops** — the Chrome extension is exactly the "stop opening tabs" answer, and the article's own Insight section describes the problem without naming the product page.

There is also no link to any `/features/*` page in the article, only `/pricing`.

## Proposed changes

Keep Pattern A intact (one dedicated Insight section) and add restrained, factual, in-context mentions:

- **Flood section:** one closing sentence noting Homelens flags flood-zone risk alongside state and property tax figures for an address, linking to `/features/property-analysis`. Framed as a convenience layer, not a replacement for FEMA's official map.
- **Where Online Research Stops:** one sentence pointing at the Chrome extension as the way to keep this research on the listing page, linking to `/features/chrome-extension`.
- **Homelens Insight section:** unchanged wording, but the CTA gains a second link to `/features/chrome-extension` so the section routes to a product page as well as `/pricing`.

Result: 4 Homelens mentions across ~1,700 words (roughly one per 400 words), two product-page links, three blog links. Still well under promotional density and consistent with the MOFU buyer routing.

## Not changing

Title, meta description, slug, schema, images, checklist, FAQ, and the Continue Reading block stay as published. No new claims about capabilities that are not in the product.

## Technical

One data update to the `blog_posts` row for `how-to-research-neighborhood-online`, editing `body_html` only. No schema, code, or sitemap changes.
