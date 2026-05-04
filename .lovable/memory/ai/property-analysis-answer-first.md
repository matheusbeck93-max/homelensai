---
name: Property Analysis Answer-First Structure
description: When analyzing a property or listing URL, AI MUST lead with a direct verdict answering the user's question (affordability/fit/risk), then a buying-power-vs-list-price bullet ($ and % gap), then bullets only — never open with property details or raw data
type: preference
---

Applies to all property/URL analysis branches: `ai-chat` (extension `propertyData` path + Firecrawl path, both single and comparison; investment and residence variants) and `perplexity-chat` URL mode.

**Mandatory structure (overrides any template ordering):**
1. FIRST line = direct verdict answering the user's actual question (yes / no / likely / borderline). No preambles, no restating the URL/listing.
2. If the question is about affordability or fit, the FIRST bullet under the verdict MUST compare buying power (`profile.budget_max`, or income×4 if income provided) vs list price, with the gap in $ and %. Example: "• Buying power $700k vs list $850k → $150k over budget (21%)".
3. AFFORDABILITY TABLE: After the verdict (and the buying-power bullet), affordability/purchase-power questions get a simple 2-col markdown table (Label | Value), 2–4 rows max — buying power vs list price, monthly budget vs estimated monthly cost. Tables ONLY for affordability / financial comparison / decision clarity — never for simple factual questions.
4. STRUCTURE ONLY WHEN IT HELPS: simple factual questions = 1–3 sentences, no sections, no bullets. Medium/complex answers = short sections + bullets only when there are 3+ distinct points. One idea per bullet.
5. Never open with property details / raw specs. Specs appear ONLY when they support the verdict, and never before the affordability comparison/table.
6. AVOID generic sections like "Basic Information" / "Property Details" unless the user explicitly asked for them. Structured sections (Acquisition Cost, Monthly Cost, Highlights, Considerations) come AFTER the verdict + (table if relevant), only the ones relevant to the question.

**How to apply:** Implemented as `ANSWER_FIRST_HEADER` / `ANSWER_FIRST_HEADER_FC` constants prepended to `analysisPrompt` in `supabase/functions/ai-chat/index.ts`, and as the "MANDATORY RESPONSE STRUCTURE" block at the top of the URL-mode `systemPrompt` in `supabase/functions/perplexity-chat/index.ts`.

**Why:** Users asking "can I afford this?" were getting walls of property data first and the actual yes/no buried at the bottom. Decision-first + buying-power comparison up front matches the project-wide Decision-First Style.
