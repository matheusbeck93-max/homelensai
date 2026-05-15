## Market Comparator for Investing — Plan (Final)

A fully additive third tab inside `/investor`. No existing logic, components, edge functions, UI contracts, or data models change.

---

### 1. New tab in Investor page

Edit only `src/pages/Investor.tsx` to add a third `TabsTrigger` + `TabsContent`:

- `calculator` (existing, untouched)
- `comparator` (NEW) — icon: `Scale`
- `saved` (existing, untouched)

The new tab renders `<MarketComparator />`. Self-contained, no props.

---

### 2. New component: `src/components/investor/MarketComparator.tsx`

#### Inputs

- Budget — numeric input ($)
- Investment goal — Select: Cash flow / Appreciation / Hybrid
- Time horizon — Select: Short-term (1–3y) / Mid-term (3–7y) / Long-term (7+y)
- Risk tolerance — Select: Low / Medium / High
- Markets to compare — chips input, 2–4 cities/metros
- Submit: "Compare Markets"

Client-side validation with zod (budget > 0, 2–4 markets).

#### Loading UX (progressive)

Rotating status label every ~1.8s while the request is in flight, with skeleton table rows below:

1. "Analyzing market pricing..."
2. "Comparing rental yields..."
3. "Evaluating risk levels..."

#### Output sections

1. **AI Verdict** — bold cards using normalized labels: "Best for cash flow: X", "Best for appreciation: Y", "Best overall fit for your profile: Z".
2. **Comparison Table** — `@/components/ui/table`. Columns: Market | Median price | Est. rental yield | 5-yr appreciation | Inventory trend | Risk level.
   - One row per requested market, **always rendered in the user's original input order** (the function preserves order; the component re-orders defensively by matching the original input array to the response).
   - Missing metrics render as `n/a` (muted styling).
   - Market column uses the **normalized label** (same string used across verdict, table, and insight).
3. **AI Insight** — markdown via `ReactMarkdown` + `chatMarkdownComponents`. Per market: ≥1 risk and ≥1 opportunity, plus ≥1 explicit cross-market trade-off.
4. **Data notes** — small muted list rendered from `dataNotes[]`.
5. **CTA button** — **"Ask AI what to do next"** → builds compact prompt → navigates to `/chats` with `state.initialMessage` (same pattern as `src/pages/Index.tsx:402–403`). Chat untouched.

#### Compact chat hand-off (max ~1500 chars)

Uses `insightBullets[]` (2–3 high-signal bullets, guaranteed by the server — see §3) and original user inputs. Hard-capped at 1500 chars; trim trailing context with `...` if longer. Shape:

```
I just compared these markets in the Investor tool:
- Markets: Tampa Metro FL, Charlotte Metro NC, Indianapolis Metro IN
- Budget: $300,000 | Goal: Cash flow | Horizon: Mid-term | Risk: Medium

Verdict:
- Cash flow: Indianapolis Metro IN
- Appreciation: Charlotte Metro NC
- Best fit: Indianapolis Metro IN

Snapshot:
- Tampa Metro FL: ~$370k, ~5.8% yield, risk medium
- Charlotte Metro NC: ~$405k, ~5.1% yield, risk medium
- Indianapolis Metro IN: ~$235k, ~7.4% yield, risk low

Key insight:
- <bullet 1>
- <bullet 2>
- <bullet 3>

What should I do next given my budget, goal, and risk tolerance?
```

---

### 3. New edge function: `supabase/functions/market-comparator/index.ts`

- Auth: validate JWT in code; use `_shared/cors.ts`, `_shared/auth.ts`.
- Input (zod): `{ budget: number, goal, horizon, risk, markets: string[2..4] }`.
- Engine: Perplexity `sonar` (grounded real-time web data).
- Returns JSON validated server-side with zod.

#### Response schema

```ts
{
  verdict: { cashFlow: string; appreciation: string; bestFit: string; rationale: string };
  table: Array<{
    market: string;                 // normalized city/metro label
    medianPrice: string;            // "$285k" | "n/a"
    rentalYield: string;            // "~7.1%" | "n/a"
    appreciation5y: string;         // "+38%" | "n/a"
    inventoryTrend: "rising" | "flat" | "falling" | "unknown";
    riskLevel: "low" | "medium" | "high" | "unknown";
  }>;
  insight: string;                  // markdown narrative
  insightBullets: string[];         // 2–3 high-signal bullets for chat hand-off
  dataNotes: string[];              // assumptions, normalizations, missing data
}
```

#### Hard guarantees

- **Full coverage**: one entry in `table` per requested market. Missing entries are filled with `n/a` / `unknown` and a `dataNotes` line explaining the gap. Never fail due to incomplete information.
- **Input order preserved**: server reorders `table` to match the user's original `markets[]` array after normalization.
- **Consistent normalized labels**: the function builds a `market → normalizedLabel` map once, then uses that exact same label everywhere (`verdict.cashFlow`, `verdict.appreciation`, `verdict.bestFit`, every `table[].market`, and inside `insight` / `insightBullets`). Post-processing rewrites the model's text to enforce the canonical label per market.
- **Market normalization rules** (system prompt + post-processing):
  - Normalize each input to a city or metro label (e.g., "nyc" → "New York Metro, NY").
  - Ambiguous inputs ("New York", "Springfield") assume the **metro area**, and add an explicit `dataNotes` entry recording the assumption.
- **Insight content rules** (prompt + lightweight server check):
  - ≥1 risk per market
  - ≥1 opportunity per market
  - ≥1 explicit cross-market trade-off
  - If the check fails for any market, append a `dataNotes` warning rather than rejecting the response.
- **insightBullets quality gate**:
  - If the model returns fewer than 2 bullets, or bullets that are empty / generic / under 30 chars / duplicates, the server **synthesizes 2–3 fallback bullets from `insight`**: split insight into sentences, score by signal density (presence of numbers, market labels, risk/opportunity/trade-off keywords), and pick the top 2–3.
  - Result: `insightBullets.length` is always 2 or 3, each non-empty and informative.
- **Anti-hallucination**:
  - Use only figures supported by search results.
  - Unknown metric → literal `n/a` + `dataNotes` entry.
  - Prefer rounded values prefixed with `~` over false precision.
  - Tie insight to budget, goal, horizon, risk.
- 402 / 429 from the gateway surface as toasts (existing pattern).

Component invokes via `supabase.functions.invoke('market-comparator', { body: ... })`.

---

### 4. Files touched

Created:
- `src/components/investor/MarketComparator.tsx`
- `supabase/functions/market-comparator/index.ts`

Edited (additive only):
- `src/pages/Investor.tsx` — one tab trigger + one tab content + icon import.

Not touched: `Chats.tsx`, `ai-chat`, `perplexity-chat`, `UIBlockRenderer`, `types/ui-blocks.ts`, calculator code, saved analyses, search params.

---

### 5. UX details

- Layout: input form in a single `Card`; results stacked (Verdict cards → Table → Insight → Data notes → CTA).
- Mobile: form fields stack; table uses existing overflow container.
- States: idle / loading (rotating status + skeletons) / partial (table renders with `n/a`, banner explains gaps) / error (toast + inline message).
- English only. Decision-First tone. Existing semantic tokens only.

---

### 6. Verification

- Manual: `/investor` → Market Comparator → run with 2 well-known markets and with 4 markets including an ambiguous one ("New York"). Confirm:
  - All markets appear in the table in the **exact order entered**.
  - Same normalized label used in verdict, table, and insight.
  - Missing cells show `n/a`.
  - Insight covers risk + opportunity per market and a cross-market trade-off.
  - CTA reads **"Ask AI what to do next"** and opens `/chats` with a ≤1500-char prompt containing 2–3 compressed bullets.
- Confirm Calculator and Saved Analyses tabs behave identically to before.
- Confirm no edits to `Chats.tsx` or shared chat infrastructure.
