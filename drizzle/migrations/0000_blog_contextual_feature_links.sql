-- Article 1: Home Buying Process (pillar)
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h3>Get Pre-Approved, Not Pre-Qualified</h3>',
  '<p>If you want to see those ratios applied to your own numbers before you talk to a lender, the <a href="/features/buying-power">Homelens buying power calculator</a> back-solves the same front-end and back-end limits from your income, debts, and down payment.</p>
<h3>Get Pre-Approved, Not Pre-Qualified</h3>'
) WHERE slug = 'home-buying-process-step-by-step';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Phase 3: Make an Offer and Navigate the Contract</h2>',
  '<p>Narrowing to two or three finalists is its own exercise. <a href="/features/property-analysis">Homelens property analysis</a> pulls the tax, insurance, and price-history figures behind each listing, and our guide to <a href="/blog/how-to-compare-two-listings-before-offer">comparing two listings before making an offer</a> walks through the side-by-side method.</p>
<h2>Phase 3: Make an Offer and Navigate the Contract</h2>'
) WHERE slug = 'home-buying-process-step-by-step';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Practical Checklist</h2>',
  '<p>If you would rather keep that analysis on the listing page itself, the <a href="/features/chrome-extension">Homelens Chrome extension</a> runs it without leaving the site you are browsing.</p>
<h2>Practical Checklist</h2>'
) WHERE slug = 'home-buying-process-step-by-step';

-- Article 2: Analyze a Rental Property (pillar)
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2 id="filters">',
  '<p>Running these metrics by hand for every candidate gets slow. The <a href="/features/investor-calculator">Homelens investor calculator</a> computes cap rate, cash-on-cash return, monthly cash flow, and DSCR from the same set of inputs.</p>
<h2 id="filters">'
) WHERE slug = 'how-to-analyze-rental-property';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2 id="dd">',
  '<p>Homelens has a dedicated <a href="/features/brrrr-calculator">BRRRR calculator</a> for modeling the rehab and refinance legs, including how much cash is left in the deal once the refinance closes.</p>
<h2 id="dd">'
) WHERE slug = 'how-to-analyze-rental-property';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2 id="tips">',
  '<p>For the market context around a specific address — rents, comparable sales, and local trends — the <a href="/features/investor-brief">Homelens investor brief</a> assembles it into a single page.</p>
<h2 id="tips">'
) WHERE slug = 'how-to-analyze-rental-property';

-- Article 3: Evaluate a Neighborhood (pillar)
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Visit the Neighborhood in Person — What No Dataset Captures</h2>',
  '<p>Homelens pulls flood-zone indicators along with state and property tax figures for an address as part of its <a href="/features/property-analysis">listing analysis</a>, which is a faster first pass than checking each source separately. Treat it as a convenience layer, not a replacement for the official FEMA map.</p>
<h2>Visit the Neighborhood in Person — What No Dataset Captures</h2>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Buyer Tips</h2>',
  '<p>Most of this can be done from your desk before you ever visit. Our guide to <a href="/blog/how-to-research-neighborhood-online">researching a neighborhood online</a> covers the desk-based half, and the <a href="/features/chrome-extension">Homelens Chrome extension</a> keeps that research on the listing page while you browse.</p>
<h2>Buyer Tips</h2>'
) WHERE slug = 'how-to-evaluate-neighborhood-before-buying';

-- Article 4: Is a Price Reduction a Good Sign?
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>The Market Context in Mid-2026</h2>',
  '<p>Price history and days on market are two of the signals Homelens reads automatically when it <a href="/features/property-analysis">analyzes a listing</a>, so you see the full cut sequence rather than the current asking price alone.</p>
<h2>The Market Context in Mid-2026</h2>'
) WHERE slug = 'is-price-reduction-good-sign';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Browsing Tips</h2>',
  '<p>The <a href="/features/chrome-extension">Homelens Chrome extension</a> surfaces that history on the listing page itself, while you are still browsing.</p>
<h2>Browsing Tips</h2>'
) WHERE slug = 'is-price-reduction-good-sign';

-- Article 5: What a Home Listing Doesn't Tell You
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>The Prior Listing History</h2>',
  '<p>Several of these figures — the tax bill at your purchase price, the carrying costs, the flood-zone risk — are what Homelens computes for you when it <a href="/features/property-analysis">analyzes a listing</a>, instead of leaving you to assemble them from separate county sites.</p>
<h2>The Prior Listing History</h2>'
) WHERE slug = 'what-home-listing-doesnt-tell-you';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Browsing Tips</h2>',
  '<p>The <a href="/features/chrome-extension">Homelens Chrome extension</a> runs that check on the listing page itself, so you are not opening a new tab for every property.</p>
<h2>Browsing Tips</h2>'
) WHERE slug = 'what-home-listing-doesnt-tell-you';

-- Article 6: Compare Two Listings
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Compare Location on Factors That Affect Daily Life</h2>',
  '<p><a href="/features/property-analysis">Homelens property analysis</a> builds this monthly-cost picture for each listing — taxes at your purchase price, insurance, and HOA — so both numbers are calculated the same way.</p>
<h2>Compare Location on Factors That Affect Daily Life</h2>'
) WHERE slug = 'how-to-compare-two-listings-before-offer';

UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>When the Quantitative Case Is a Tie</h2>',
  '<p>Saving each write-up makes the comparison easier to revisit. <a href="/features/saved-analyses">Homelens saved analyses</a> keeps both analyses and their match scores side by side.</p>
<h2>When the Quantitative Case Is a Tie</h2>'
) WHERE slug = 'how-to-compare-two-listings-before-offer';

-- Article 7: Cap Rate
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>Where Cap Rate Breaks Down</h2>',
  '<p>The <a href="/features/investor-calculator">Homelens investor calculator</a> runs this same NOI and cap rate math alongside cash-on-cash return and DSCR, so you can test a purchase price against financing in one place.</p>
<h2>Where Cap Rate Breaks Down</h2>'
) WHERE slug = 'how-to-calculate-cap-rate-rental-property';

-- Article 8: Why Has This House Been on the Market So Long?
UPDATE public.blog_posts SET body_html = replace(
  body_html,
  '<h2>A Practical Checklist</h2>',
  '<p>Days on market and the price-cut sequence behind it are part of what Homelens reports when it <a href="/features/property-analysis">analyzes a listing</a>.</p>
<h2>A Practical Checklist</h2>'
) WHERE slug = 'why-house-on-market-so-long';