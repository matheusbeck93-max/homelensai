## Problem

From the screenshots:
- User wrote "buying a home for my family, walkable, safe, nature around" → AI only captured `locations` and `types: [house]`. It missed `goal=buy_home`, lifestyle importance (walkability/safety/parks = high), and duplicated the same sentences into `freeform_notes` on every turn.
- When user replied "you didn't capture the number of beds and bathrooms?", AI just said "Got it. What else…" instead of asking for the values or acknowledging the gap.
- Editing through chat doesn't reliably mutate the Current Preferences card because the model isn't consistently emitting an `update_preferences` tool call.

Root cause: with `tool_choice: 'required'` and two tools, Gemini often calls only `reply`. The system prompt asks for both but doesn't enforce it. Extraction is also too literal — no mapping from natural-language lifestyle words to structured fields, and no dedup on notes.

## Fix (edge function only — UI already reactive)

Refactor `supabase/functions/preferences-assistant/index.ts` to a **two-pass** turn:

**Pass 1 — Deterministic extraction (structured output)**

Call Gemini with `tool_choice: { type: 'function', function: { name: 'update_preferences' } }` so the model is forced to return a patch. Strengthen the system prompt with:
- Explicit lexicon mapping: "walkable"→`lifestyle.walkability_importance=high`, "safe/safety/low crime"→`safety_importance=high`, "nature/parks/trees/green"→`parks_importance=high`, "good schools"→`schools_importance=high`, "short commute"→`commute_importance=high`.
- Goal mapping: "buying… for my family / our home / primary residence" → `goal=buy_home`; "rental / cash flow / investment" → `goal=invest`.
- Beds/baths/sqft/price extraction from numeric phrases ("3-bed", "2 baths", "under $650k", "1,800 sqft").
- Property type synonyms (SFH/single family → house, condo/coop/townhome/multi-family/land).
- Must-have / nice-to-have / deal-breaker classification from phrasing ("must have", "need", "no", "avoid", "deal-breaker").
- Notes rule: only `append_note` if the input adds context not already representable as structured fields. Never re-append text already present in `freeform_notes` (case-insensitive substring check server-side).

Server-side dedup: before applying `append_note`, skip if the trimmed note already appears in current `freeform_notes`.

**Pass 2 — Reply**

Call Gemini again with `tool_choice: { type: 'function', function: { name: 'reply' } }`, passing the patched preferences plus a note of what changed so the reply can acknowledge ("Set walkability and safety to high.") and ask for the most useful next missing field (beds, budget, etc.) with 2–3 suggested_replies.

**Self-correction case**

When the user says "you didn't capture X" or "you missed X", the extraction prompt must treat it as a request to ask for X, not as a no-op. Add an explicit instruction + an `acknowledge_gap` hint in the patch (no schema change — just included in the second-pass context).

**Other tweaks**

- Lower `temperature` to 0.2 for extraction pass.
- Validate patch with the existing `applyPatch` (already deep-merges). Log the diff for debugging.
- Mirror to legacy columns stays as-is.
- Opening turn unchanged.

## No DB or UI changes

- `PreferencesSummaryCard` already re-renders from the returned `preferences` object on every turn. No change needed once extraction works.
- `PreferencesChat` already calls the function and updates state on each response.
- No migration.

## Acceptance

- "I'm buying a home for my family, walkable, safe, nature around" → sets `goal=buy_home`, `lifestyle.walkability_importance=high`, `safety_importance=high`, `parks_importance=high`, no duplicated notes.
- "3 beds 2 baths under $650k" → fills `property.bedrooms_min=3`, `bathrooms_min=2`, `budget.purchase_price_max=650000`.
- "you didn't capture beds/baths" → AI asks "How many bedrooms and bathrooms do you need (minimum)?"
- "only Tampa" → replaces locations with `[Tampa, FL]`.
- Current Preferences card updates live on every turn.
