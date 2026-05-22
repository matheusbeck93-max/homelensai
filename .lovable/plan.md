## Plan: Conversational AI Preferences Assistant

Rebuild the Preferences tab as a true natural-language assistant that extracts structured preferences via AI, with a live summary card and full control actions.

### 1. Data model
Add a single flexible `preferences jsonb` column to `profiles` (keep existing columns intact for back-compat with the rest of the app). Shape:

```
{
  goal, locations[], budget{purchase_price_max, monthly_payment_max, down_payment},
  property{types[], bedrooms_min, bathrooms_min, sqft_min},
  lifestyle{schools_importance, commute_importance, safety_importance, walkability_importance, parks_importance},
  investment{strategy, cash_flow_target, appreciation_focus, fixer_upper_ok, risk_tolerance},
  must_haves[], nice_to_haves[], deal_breakers[], freeform_notes, updated_at
}
```

A backend sync also mirrors a few fields (`preferred_cities`, `budget_max`, `min_bedrooms`, `min_bathrooms`, `primary_goal`, `about_me`) to the existing columns so the rest of HomeLens (search, AI chat personalization) keeps working.

### 2. New edge function: `preferences-assistant`
Replace the old hand-coded state machine with a clean AI tool-calling flow using Lovable AI Gateway (`google/gemini-2.5-flash`).

The model receives:
- system prompt explaining the assistant's role, guardrails (no legal/tax/lending advice, no fair-housing claims), and HomeLens tone.
- the current `preferences` JSON.
- the full chat history.

It must respond by calling one or both tools:
- `update_preferences(patch)` — deep-merge patch onto preferences. Supports add/remove on arrays (e.g. removing condos, adding Woodbridge).
- `reply(message, suggested_questions?)` — the chat text shown to the user, plus optional quick-reply chips.

The function applies the patch server-side (validated), saves to Supabase, mirrors the legacy fields, and returns `{ message, suggested_questions, preferences }`.

Reset/restart are handled by a separate action param (`action: "reset" | "restart"`) so it's deterministic, not dependent on the model.

### 3. Frontend: rebuilt `PreferencesChat.tsx`
Two-pane layout (stacks on mobile):

**Left — AI Preferences Chat**
- Opening assistant message inviting natural-language input with the townhouse example.
- Suggested-reply chips under the latest assistant turn (from the model).
- Free-text input always available.
- Markdown-rendered assistant messages.

**Right — Current Preferences Summary card**
- Live-updates from server response after every turn.
- Sections: Goal · Locations · Budget · Property · Must-haves · Nice-to-haves · Deal breakers · Lifestyle importance · Investment · Notes.
- Empty fields hidden.

**Action bar**
- Save Preferences (explicit save toast; auto-save also happens on each turn)
- Reset Preferences (confirm dialog → clears `preferences` and chat)
- Restart Setup (clears chat only, re-opens the guided opener)
- Edit Manually (opens a sheet with the same fields as the summary, editable; saves the JSON)
- Review Summary (sends a synthetic user turn: "Show me what you know so far")

### 4. Files touched
- `supabase/functions/preferences-assistant/index.ts` (new)
- `supabase/functions/preferences-chat/index.ts` (kept but unused; safe to remove later)
- `src/components/console/PreferencesChat.tsx` (rewritten)
- `src/components/console/PreferencesSummaryCard.tsx` (new)
- `src/components/console/PreferencesEditDialog.tsx` (new)
- `supabase/config.toml` (register new function with `verify_jwt = false`, we auth via Bearer token inside)
- Migration: add `preferences jsonb default '{}'::jsonb` to `profiles`.

### 5. Acceptance
- Natural language captures locations, budget, beds, must-haves, deal breakers, importance scores.
- Contradictions update the prefs and the assistant acknowledges.
- Reset/Restart/Edit/Review buttons all work.
- Summary card mirrors the JSON live.
- Legacy fields stay in sync so search & AI chat personalization continue working.
- App still builds with no TS errors.

### Technical notes
- Auth: edge function validates the JWT, loads/saves `profiles.preferences` for `auth.uid()`.
- AI: Lovable AI Gateway, tool-calling with `update_preferences` + `reply`. Temperature low. Always re-loads server-side prefs before applying patch to avoid stale overwrites.
- Patch semantics: `update_preferences` accepts `{add: {...}, remove: {...}, set: {...}}` per field so the model can express "include Woodbridge too" vs "no condos" cleanly.
- Guardrails enforced in system prompt + a small server-side sanitizer that drops any keys outside the schema.