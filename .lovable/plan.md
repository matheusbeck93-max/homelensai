## Problem

The preferences chat (`supabase/functions/preferences-chat/index.ts` + `src/components/console/PreferencesChat.tsx`) has two failure modes:

1. **Returning user (profile complete)** — Any reply is met with the same line: *"Your preferences are already saved. You can modify them at any time."* There's no way to actually change anything. (Visible in the screenshot.)
2. **No menu / no entry point** to pick what to edit; only a free-text box that goes nowhere.

What the user wants: a Claude-style conversational flow where every step has **preset multiple-choice buttons + a free-text input** for arbitrary answers, both for first-time setup *and* for editing later.

## Solution

Keep the existing question bank and parsing logic — they're solid. Add an **edit mode** and a routing layer on top.

### 1. Edge function (`preferences-chat/index.ts`)

- **New `EDIT_CATEGORY_CHOICES`** — one chip per editable preference (Goal, Cities, Persona, Budget, Bedrooms, Bathrooms, Features, Strategy, Hold period, Financing, Kids, Climate, Safety, About me) plus `Restart all preferences`.
- **New question lookup by key** — `questionForKey(key)` reuses the same `Question` shape used today; lets us jump to a single question on demand.
- **Track conversation state via the last assistant message** the client sends back. The server already receives the full `messages` array; tag each assistant turn with a hidden marker (e.g. trailing `\n<!--pc:{"mode":"edit_menu"}-->` or `pc:editing=budget`) so we can recover state without a DB column. Strip markers before showing.
- **Routing in `Deno.serve`:**
  - If `onboarding_completed` AND no in-progress edit → reply with `assistant_message: "Your preferences are saved. What would you like to update?"` + `choices: EDIT_CATEGORY_CHOICES` + `allow_text: true`. Free text is parsed against category keywords (budget, cities, etc.) to jump straight in.
  - If user picks `restart_all` → set every preference field to `null` and `onboarding_completed = false`, then return the first onboarding question.
  - If user picks a single category → return that category's question, prefilled prompt showing current value (e.g. *"Your current budget is $500k–$750k. What would you like instead?"*), with the same choices + free-text.
  - On their next message → parse with existing `parseAnswerForQuestion`, save, then return to the edit menu (not the next onboarding question) with a "Saved — anything else?" prefix.
- **First-time flow unchanged** — `nextQuestion(profile)` keeps walking the preset list until done. Add a friendlier opener for the very first question only when profile is empty: *"Welcome to HomeLens! I'll ask a few quick questions to personalize your experience — pick an option or type your own answer."*

### 2. Client (`src/components/console/PreferencesChat.tsx`)

- Already renders `choices` + free-text input — no structural changes needed.
- Strip the hidden `<!--pc:...-->` markers before rendering assistant messages.
- When `done: true` arrives, still show the choices (don't hide them) so the edit menu remains interactive. The current code already does this via `canShowChoices`; just ensure the assistant turn includes `done: false` when it's the edit menu (only mark `done: true` after a save confirmation, never with choices).
- Reset welcome opener: replace the hardcoded `INITIAL_TURN` with a call to the edge function on mount when no messages exist, so the server controls the opener (welcome vs. edit menu) based on `onboarding_completed`.

### 3. Files touched

- `supabase/functions/preferences-chat/index.ts` — edit mode, category routing, state markers, restart-all reset.
- `src/components/console/PreferencesChat.tsx` — remove hardcoded initial turn, fetch opener from server, strip state markers.

### Non-goals

- No DB schema change.
- No new tables, no new edge function.
- No change to property/chat features or to `nextQuestion`'s question order for first-time users.

## Expected UX

**First time:** Welcome message → goal chips → cities text → persona chips … → "All set! You can update anything anytime." + edit menu.

**Returning:** Edit menu chips (Goal · Cities · Budget · …) + "or type what you'd like to change". Pick "Budget" → "Your current budget is $500k–$750k. What would you like instead?" + budget chips + free text → save → "Saved. Anything else?" + edit menu.
