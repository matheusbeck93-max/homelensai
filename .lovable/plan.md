

# Consolidated Plan: Personalized Homepage + Enhanced Onboarding + Chrome Extension + Match Score

## Conflict & Duplication Audit

After reviewing the existing codebase, here's what already exists and how we avoid breaking it:

| What exists | Risk | Mitigation |
|---|---|---|
| `profiles` table already has: `buyer_type`, `budget_min/max`, `primary_goal`, `risk_level`, `property_types`, `location_preferences`, `commute_preferences`, `min_bedrooms`, `preferred_cities`, `max_price_range`, `desired_monthly_payment` | Duplication — OnboardingFlow already writes to most of these | **Do NOT recreate** these columns. Only add the 9 truly new ones |
| `AccountPreferencesPanel` already has: name, email, city/state, buyer persona, budget min/max, PrimaryGoalSelector | Duplication with expanded onboarding | **Extend** the existing panel, don't replace it. Add new fields below existing ones |
| `PrimaryGoalSelector` component already exists with 5 goals (buy, rent, invest, trends, tax) | OnboardingFlow Step 1 would duplicate this | **Reuse** `PrimaryGoalSelector` inside OnboardingFlow Step 1 instead of rebuilding |
| `ai-chat` already has personalization context block (lines 498-541) with budget, property types, locations, risk, commute | Could overwrite or duplicate context | **Extend** the existing `prefs[]` array with new fields, don't create a parallel block |
| `ai-chat` already has `profileInstructions` per buyer type (investor, first-time-buyer, regular) at line 569+ | Could conflict with new market intelligence prompt | **Append** market intelligence to the base system prompt, keep `profileInstructions` as-is |
| `perplexity-chat` already uses `GOAL_CONTEXTS` with `userGoal` | New profile injection could conflict | **Add** profile context alongside `goalContext`, not replacing it |
| `OnboardingFlow` already saves to `profiles` with `location_preferences` as array | `AccountPreferencesPanel` saves `location_preferences` as `{city, state}` object | **Normalize** to always use the array format (string[]) via `preferred_cities` column which already exists |
| Chrome extension `popup.tsx` already has `callAiChat`, `PropertyContext`, markdown renderer | Could break existing flow | **Extend** `callAiChat` to pass extra fields; **replace** renderer in-place; keep all existing logic |
| `conversations` + `messages` tables already exist in DB | Extension persistence won't conflict | Use existing tables as-is |
| Index.tsx hero already shows "Only Good Deals" (line 391) | Personalization must preserve this for guests | Conditional render: keep existing text for guests, personalize for signed-in |
| Auth.tsx post-signup navigates to `redirectPath` (line 53) | Changing to `/profile` could break redirect flows | Only redirect to `/profile` for **new signups** (not sign-ins), preserve `redirectPath` for sign-ins |

---

## Database Migration (Only New Columns)

Add 9 nullable columns to `profiles` (the others already exist):

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS investment_strategy text,
  ADD COLUMN IF NOT EXISTS hold_period_years integer,
  ADD COLUMN IF NOT EXISTS financing_preference text,
  ADD COLUMN IF NOT EXISTS min_bathrooms integer,
  ADD COLUMN IF NOT EXISTS must_have_features text[],
  ADD COLUMN IF NOT EXISTS has_children boolean,
  ADD COLUMN IF NOT EXISTS children_ages text[],
  ADD COLUMN IF NOT EXISTS climate_preference text,
  ADD COLUMN IF NOT EXISTS safety_priority text;
```

No existing columns modified. No RLS changes needed (existing profile RLS applies).

---

## File Changes

### 1. `src/components/OnboardingFlow.tsx` — Expand to 5 steps, add `initialData` prop
- Accept optional `initialData` prop to pre-fill all fields when editing
- **Step 1**: Buyer type (existing) + reuse `PrimaryGoalSelector` component
- **Step 2**: Budget fields (existing) + "all optional" helper text + Skip button
- **Step 3** (NEW): Investment profile — strategy, hold period, financing. Optional with Skip
- **Step 4**: Property types & locations (existing) + min bathrooms, must-have features
- **Step 5** (NEW): Lifestyle — has children → children ages, climate preference, safety priority. Optional with Skip
- Save all new fields to `profiles` table on submit
- Non-destructive: same component, extended

### 2. `src/pages/Auth.tsx` — Post-signup redirect
- Line 53: Change `navigate(redirectPath)` to `navigate('/profile')` **only for signUp**, not signIn
- Sign-in flow (line 95) stays unchanged

### 3. `src/pages/Profile.tsx` — Pass existing data to OnboardingFlow
- Pass `profile` as `initialData` prop to `OnboardingFlow` when "Edit Preferences" is clicked
- No other changes

### 4. `src/components/console/AccountPreferencesPanel.tsx` — Add new fields
- **Extend** existing form (don't remove anything) with new cards/sections:
  - Investment Strategy select
  - Hold Period input
  - Financing Preference select
  - Min Bathrooms input
  - Must-Have Features checkboxes
  - Has Children toggle → Children Ages checkboxes
  - Climate Preference select
  - Safety Priority select
- Update `handleSave` to include new fields
- Update `loadProfile` to load new fields

### 5. `src/pages/Index.tsx` — Personalized hero
- Add state for `userName` and `primaryGoal`; fetch from `profiles` on auth state change
- Conditional render at line 391-392: guest sees existing text, signed-in user sees "Hello, {firstName}" with goal subtitle
- No other changes to page structure

### 6. `supabase/functions/ai-chat/index.ts` — Market intelligence + extensionMode + match score
- **Zod schema** (line 11): Add `extensionMode: z.boolean().optional()`
- **Personalization block** (line 498-541): Extend `prefs[]` array with new fields (investment_strategy, has_children, etc.) — only if values exist
- **System prompt**: Append market & financial intelligence instructions (tax nuances, loan programs, 1031 exchanges, state comparisons, insurance, etc.)
- **Property context** (line 556): Add `lotSize`, `yearBuilt`, `propertyType` fields
- **Extension mode**: When `extensionMode: true` — skip purpose-asking, add compact formatting instruction, add match score instruction (`MATCH_SCORE: X/10`)
- Keep all existing `profileInstructions` untouched

### 7. `supabase/functions/perplexity-chat/index.ts` — Full profile injection
- Import `createClient` from supabase
- Extract auth token from request headers
- Fetch full profile from `profiles` table
- Build profile context string from all fields (budget, strategy, children, climate, etc.)
- Inject alongside existing `goalContext` — not replacing it

### 8. `chrome-extension/popup.tsx` — Profile fetch, persistence, match score, markdown
- **On login**: Fetch user profile from `profiles` via REST API (`GET /rest/v1/profiles?id=eq.{userId}`)
- **Every request**: Send `userProfile` + `extensionMode: true` in `callAiChat` body
- **Conversation persistence**: After each exchange, upsert to `conversations` and `messages` via REST API; load most recent on popup open
- **Markdown renderer**: Replace basic renderer with one supporting `- ` bullets → `<ul>`, `## ` headers, numbered lists, bold/italic
- **Match Score UI**: Parse `MATCH_SCORE: X/10` from first line of AI response; render color-coded circular badge (8-10 green, 5-7 yellow, 0-4 red); strip score line from rendered text
- **No profile prompt**: If profile incomplete, show "Complete your profile on HomeLens for a personalized match score"
- All existing detection, login, chat logic preserved

---

## What We Are NOT Touching

- `App.tsx` — no route changes needed
- `ConversationPanel.tsx` — untouched
- `Chats.tsx` — untouched (already sends `clientProfile` to ai-chat)
- `supabase/client.ts` — never edit
- `supabase/types.ts` — auto-generated after migration
- Existing URL detection, property search, calculator workflows — all preserved
- `profileInstructions` object in ai-chat — kept as-is, market intelligence appended separately

