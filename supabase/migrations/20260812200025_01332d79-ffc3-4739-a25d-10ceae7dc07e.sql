INSERT INTO public.blog_posts (
  slug, title, excerpt, cover_image_url, body_html, category, tags, status, published_at,
  seo_title, seo_description, reading_time_minutes
) VALUES (
  'how-to-calculate-cap-rate-rental-property',
  'How to Calculate Cap Rate on a Rental Property (2026)',
  'Cap rate looks simple until you build the NOI yourself. See the formula, a worked example, and how to read it against today''s 2026 mortgage rates.',
  '/__l5e/assets-v1/339d7941-6609-41e9-b555-18493e297749/article10-hero.jpg',
$html$
<p>A rental listing shows an asking price and, if you are lucky, a rent estimate. It does not show what is left of that rent once property tax, insurance, and vacancy are subtracted, or whether the price still makes sense after that subtraction. Cap rate is the number built to answer exactly that question.</p>

<p>It compresses a property's income and its price into a single percentage, which is why investors reach for it first when comparing very different properties in a few minutes. That same compression hides details a buyer still needs before making an offer, and that is where the metric gets misread.</p>

<p>This walks through the formula, a full worked example with real math, and how to weigh the result against current financing costs rather than against a number pulled from memory.</p>

<blockquote>
  <p><strong>Quick answer.</strong> Cap rate equals a property's net operating income divided by its purchase price, expressed as a percentage. Net operating income is rental income minus operating expenses, calculated before any mortgage payment. A higher cap rate means more income relative to price; a lower one means less. There is no single number that counts as "good" everywhere. It depends on property class, location, and what the investor's cost of capital is, and as of the week of August 6, 2026, the average 30-year fixed mortgage rate was 6.69% (Freddie Mac).</p>
</blockquote>

<h2>What Cap Rate Actually Measures</h2>
<p>Cap rate is a yield metric. It measures the return a property produces from its operations alone, independent of how the buyer chooses to finance it. CBRE defines a stabilized cap rate as "the ratio of stabilized net operating income to the acquisition price of the asset" in its U.S. Cap Rate Survey H2 2025, published February 10, 2026, and that framing is the industry standard.</p>
<p>Because financing is deliberately excluded, two investors buying the identical property, one with cash and one with a mortgage, calculate the same cap rate. That is the metric's strength: it lets you compare a duplex in one neighborhood to a fourplex in another without first normalizing for down payment size or loan terms. It is also its limitation, covered further down, because the number that actually lands in an investor's bank account depends heavily on financing.</p>

<h2>The Formula, Broken Into Its Parts</h2>
<p><strong>Cap Rate = Net Operating Income ÷ Purchase Price × 100</strong></p>

<h3>Net Operating Income</h3>
<p>Net operating income, or NOI, starts with the rent a property actually collects, not the rent the seller advertises. From there, subtract a realistic vacancy allowance and every operating expense: property tax, insurance, maintenance and repairs, property management, and any HOA dues. NOI stops before the mortgage. Debt service, capital expenditures, and income tax are not part of it. That exclusion is deliberate, since financing terms vary by buyer and NOI is meant to describe the property, not the purchase.</p>

<h3>Purchase Price</h3>
<p>The denominator is what the buyer actually pays, or, for a property already owned, its current market value. Using an inflated appraisal or an asking price the seller has not accepted overstates the denominator and understates the true cap rate the buyer will experience at closing.</p>

<h2>A Worked Example</h2>
<p><em>Example data. The figures below are a constructed illustration, not a real listing.</em></p>
<p>A single-family rental is priced at $300,000. Market rent is $2,200 a month, or $26,400 a year.</p>

<table>
  <thead><tr><th>Line item</th><th>Annual amount</th></tr></thead>
  <tbody>
    <tr><td>Gross rental income</td><td>$26,400</td></tr>
    <tr><td>Vacancy allowance (5%)</td><td>−$1,320</td></tr>
    <tr><td><strong>Effective gross income</strong></td><td><strong>$25,080</strong></td></tr>
    <tr><td>Property tax</td><td>−$3,000</td></tr>
    <tr><td>Insurance</td><td>−$1,200</td></tr>
    <tr><td>Maintenance reserve</td><td>−$1,500</td></tr>
    <tr><td>Property management (8% of effective gross income)</td><td>−$2,006</td></tr>
    <tr><td><strong>Total operating expenses</strong></td><td><strong>−$7,706</strong></td></tr>
    <tr><td><strong>Net operating income</strong></td><td><strong>$17,374</strong></td></tr>
  </tbody>
</table>

<p>Cap rate = $17,374 ÷ $300,000 = <strong>5.79%</strong>, rounded to 5.8%.</p>
<p>Now hold the income constant and change only the price. The same property at $340,000 produces the same $17,374 in NOI, but the cap rate drops to $17,374 ÷ $340,000 = <strong>5.11%</strong>. Nothing about the rental changed. The price did. That single relationship, income held flat while price moves, is the mechanism behind most of the confusion around what a cap rate "should" be.</p>

<figure>
  <img src="/__l5e/assets-v1/94bd7ffb-0d65-4139-b233-d0ec7681b09f/article10-ledger.jpg" alt="A hand recording expense figures in a ledger beside a laptop, calculating property income." loading="lazy" width="1600" height="900" />
  <figcaption>A seller's pro forma NOI often uses vacancy and maintenance assumptions lower than what the property has actually run.</figcaption>
</figure>

<h2>Reading Cap Rate Against Today's Financing Costs</h2>
<p>A cap rate on its own does not say whether a deal produces positive cash flow, because NOI excludes the mortgage payment. The comparison that matters is the cap rate against the cost of the debt used to buy the property. When a property's cap rate is lower than the mortgage rate, the loan costs more than the property yields on an unlevered basis, a condition sometimes called negative leverage, and the investor is relying on appreciation, rent growth, or a large down payment rather than the property's current income to make the deal work.</p>
<p>The 30-year fixed mortgage rate averaged 6.69% for the week of August 6, 2026, up from 6.66% the prior week (Freddie Mac PMMS). A property priced to produce a 5.8% cap rate against that financing environment is not automatically a bad deal, but it does mean the income statement alone will not carry the loan, and the down payment and loan structure matter more than the property does.</p>
<p>That gap between property yield and financing cost is not unique to small residential rentals. CBRE's U.S. Cap Rate Survey H2 2025, based on roughly 3,600 cap rate estimates gathered from more than 200 CBRE capital markets and valuation professionals across more than 50 U.S. markets in early December 2025, found that cap rates were largely unchanged across major commercial property types through the second half of last year, and that many respondents believe yields are near a cyclical peak. The scale is institutional, but the underlying math, income divided by price, compared against the cost of borrowing, is the same math a single-property investor runs.</p>

<figure>
  <img src="/__l5e/assets-v1/a75b9969-9206-4b1e-9718-c687e92e3725/article10-street.jpg" alt="A residential street lined with small multifamily rental buildings under overcast daylight." loading="lazy" width="1600" height="900" />
  <figcaption>The same net operating income produces a different cap rate on every block, because price is the other half of the ratio.</figcaption>
</figure>

<h2>Where Cap Rate Breaks Down</h2>
<ul>
  <li><strong>It ignores financing.</strong> Two buyers of the same property at the same cap rate can have completely different cash flow, because one put 20% down at 6.69% and the other paid cash.</li>
  <li><strong>It is only as accurate as the NOI behind it.</strong> A seller's pro forma NOI can understate vacancy, omit a management fee the seller does not currently pay, or exclude maintenance the property is overdue for. Rebuilding NOI independently is worth the time before trusting a listed cap rate.</li>
  <li><strong>It does not capture appreciation or renovation upside.</strong> A property with a below-market cap rate today because it is under-rented can be a better long-term hold than one already priced for its full potential.</li>
  <li><strong>It is not comparable without adjusting for risk.</strong> A 5.8% cap rate in a stable, low-vacancy submarket and a 5.8% cap rate in a market with rising vacancy are not the same opportunity, even though the number matches.</li>
</ul>

<h2>Investor Tips</h2>
<ul>
  <li>Rebuild the seller's NOI from your own numbers before trusting theirs. Vacancy and maintenance are the two lines most often understated.</li>
  <li>Compare the cap rate to your actual financing terms, not to a generic benchmark pulled from a forum post.</li>
  <li>Track cap rate alongside cash-on-cash return. They answer different questions, and a property can look strong on one and weak on the other.</li>
  <li>Ask what is excluded from a "pro forma" cap rate. Capital expenditures kept outside NOI often reappear later as a lower real return.</li>
</ul>

<h2>Homelens Insight</h2>
<p>Building the income side of a cap rate calculation means pulling a rent estimate from one source, tax records from a county site, and an insurance quote from somewhere else, all before the first subtraction happens, and a listing page shows none of it. Homelens pulls rental estimates from RentCast directly onto the listing you are viewing, so the income inputs for a cap rate calculation are already assembled instead of scattered across four browser tabs. <a href="/pricing">Open the Investor Account</a> to run cap rate and cash flow on any listing without leaving the page.</p>

<h2>Practical Checklist</h2>
<ul>
  <li>Confirmed the rent figure is a market estimate, not the seller's optimistic number</li>
  <li>Rebuilt operating expenses independently, including tax, insurance, maintenance, management, and vacancy</li>
  <li>Calculated NOI before any financing cost</li>
  <li>Divided NOI by the actual purchase price, not an inflated appraisal</li>
  <li>Compared the resulting cap rate to current financing costs, not to a generic target</li>
  <li>Checked whether capital expenditures were excluded from the NOI you were given</li>
</ul>

<h2>FAQ</h2>
<h3>How do you calculate cap rate?</h3>
<p>Divide the property's net operating income by its purchase price, then multiply by 100 to express it as a percentage. NOI is rental income minus vacancy and operating expenses, calculated before the mortgage payment.</p>
<h3>What is a good cap rate for a rental property?</h3>
<p>There is no single number that applies everywhere. It depends on property class, location, and the investor's cost of capital. As of August 2026, that cost of capital includes a 30-year fixed mortgage rate averaging 6.69% (Freddie Mac), which is the baseline a cap rate needs to be weighed against, not a fixed target like 6% or 8%.</p>
<h3>Does cap rate include the mortgage payment?</h3>
<p>No. Net operating income is calculated before debt service by design, so cap rate can compare properties independent of how each buyer chooses to finance the purchase.</p>
<h3>What is the difference between cap rate and cash-on-cash return?</h3>
<p>Cap rate divides NOI by the full purchase price. Cash-on-cash return divides annual pre-tax cash flow, which is NOI minus the mortgage payment, by the actual cash invested, meaning the down payment and closing costs. Two properties with an identical cap rate can produce very different cash-on-cash returns depending on financing.</p>
<h3>Why does cap rate fall when the purchase price rises?</h3>
<p>Because NOI is the numerator and price is the denominator. If income stays the same and price increases, the ratio shrinks. In the worked example above, identical $17,374 income produced a 5.8% cap rate at a $300,000 price and a 5.1% cap rate at $340,000.</p>

<h2>Continue Reading</h2>
<ul>
  <li><a href="/blog/how-to-analyze-rental-property">How to Analyze a Rental Property Before You Buy</a>, the Investing pillar this article sits under</li>
  <li><a href="/blog/what-home-listing-doesnt-tell-you">What a Home Listing Doesn't Tell You</a></li>
  <li><a href="/blog/how-to-compare-two-listings-before-offer">How to Compare Two Listings Before Making an Offer</a></li>
</ul>

<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
{"@type":"Question","name":"How do you calculate cap rate?","acceptedAnswer":{"@type":"Answer","text":"Divide the property's net operating income by its purchase price, then multiply by 100. NOI is rental income minus vacancy and operating expenses, before the mortgage payment."}},
{"@type":"Question","name":"What is a good cap rate for a rental property?","acceptedAnswer":{"@type":"Answer","text":"There is no single number that applies everywhere. It depends on property class, location, and the investor's cost of capital, which in August 2026 includes a 30-year fixed mortgage rate averaging 6.69%."}},
{"@type":"Question","name":"Does cap rate include the mortgage payment?","acceptedAnswer":{"@type":"Answer","text":"No. Net operating income is calculated before debt service, so cap rate compares properties independent of financing."}},
{"@type":"Question","name":"What is the difference between cap rate and cash-on-cash return?","acceptedAnswer":{"@type":"Answer","text":"Cap rate divides NOI by the purchase price. Cash-on-cash return divides annual pre-tax cash flow by the cash actually invested, so financing changes the result."}},
{"@type":"Question","name":"Why does cap rate fall when the purchase price rises?","acceptedAnswer":{"@type":"Answer","text":"NOI is the numerator and price is the denominator, so if income stays flat and price increases, the ratio shrinks."}}
]}
</script>
$html$,
  'Investing',
  ARRAY['cap rate','noi','rental property','investing','roi'],
  'published',
  now(),
  'How to Calculate Cap Rate on a Rental Property (2026)',
  'Cap rate looks simple until you build the NOI yourself. See the formula, a worked example, and how to read it against today''s 2026 mortgage rates.',
  8
);

UPDATE public.blog_posts
SET body_html = replace(
  body_html,
  '<li>Cap Rate, Explained With Real Numbers <em>(coming soon)</em></li>',
  '<li><a href="/blog/how-to-calculate-cap-rate-rental-property">How to Calculate Cap Rate on a Rental Property</a></li>'
)
WHERE slug = 'how-to-analyze-rental-property';

UPDATE public.blog_posts
SET body_html = body_html || '
<p><a href="/blog/how-to-calculate-cap-rate-rental-property">How to Calculate Cap Rate on a Rental Property</a></p>'
WHERE slug IN ('what-home-listing-doesnt-tell-you','how-to-compare-two-listings-before-offer');