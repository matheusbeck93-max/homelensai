## Goal

Turn `My HomeLens → Preferences` from a long scrollable form into a chat where the AI asks questions one at a time. Each turn shows multiple-choice chips plus a free-text input row. The user can return any time and just say "change my budget to 600k" or "add Tampa" and the AI updates the saved profile.

## UX flow

1. Open **Console → Preferences**. The panel becomes a chat window:
   - Header: "Tell me what you're looking for" + small "Switch to form view" link (keeps the old form as escape hatch).
   - Empty state: AI greets and summarizes what it already knows ("You're a first-time buyer in Miami, FL with a $400–600k budget. Want to update anything?"). If nothing is saved yet, it starts the guided flow.
2. Each AI turn renders:
   - A short question.
   - **Chip buttons** for multiple-choice (single- or multi-select where appropriate, e.g. cities, personas, features, financing).
   - A free-text input row at the bottom ("Or type your own answer…").
   - A "Skip" button.
3. User picks chips or types. The reply is sent to the AI, which:
   - Confirms what it understood ("Got it — added Pool to must-haves").
   - Saves the change to `profiles` via a tool call.
   - Asks the next question, or — for ongoing edits — just acknowledges and waits.
4. At any time the user can type free-form ("forget the pool, add a basement, raise max budget to 800k"). The AI parses and updates multiple fields in one turn.
5. A persistent **"Preferences summary"** card sits above the chat showing the current saved values (cities, budget, beds/baths, persona, strategy, etc.) so the user sees changes land in real time.

## Question script (covers everything in the current form)

Ordered, but skippable:
1. Primary goal (buy / invest / both) — chips
2. Preferred cities — chips of recent + type-ahead
3. Buyer persona(s) — multi-select chips (`PERSONA_OPTIONS`)
4. Budget (min / max) — quick chips ($300k, $500k, $750k, $1M, custom) → free text
5. Min beds / baths — chips 1–5
6. Min / max sqft — chips + custom
7. Must-have features — multi-select chips (`featureOptions`) + free-text "add your own"
8. Investment strategy — multi-select (`STRATEGY_OPTIONS`), only if persona = investor or goal includes invest
9. Hold period (years) — chips 1 / 3 / 5 / 10 / 20
10. Financing preference — multi-select (`FINANCING_OPTIONS`)
11. Kids / ages — yes/no, then `childAgeOptions`
12. Climate preference — chips (warm, mild, cold, four seasons, no preference)
13. Safety priority — chips (very high, high, medium, low)
14. About me — free text only (open box)
15. Wrap-up: AI summarizes everything and offers "Save & finish" or "Edit anything".

## Technical design

**New edge function `preferences-chat`** (`supabase/functions/preferences-chat/index.ts`)
- Auth: validate Supabase JWT, load the caller's `profiles` row.
- Uses AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview`) via the existing `_shared/ai-gateway.ts`.
- System prompt: "You are HomeLens' preferences assistant. Ask one question at a time. Always return structured JSON with `assistant_message`, `choices[]` (label + value + multi), `allow_text` (bool), and `updates` (partial profile diff). Acknowledge updates briefly. Never re-ask answered fields unless the user wants to change them."
- Structured output via `Output.object` with Zod schema:
  ```ts
  z.object({
    assistant_message: z.string(),
    choices: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    multi_select: z.boolean().optional(),
    allow_text: z.boolean().default(true),
    updates: z.record(z.any()).optional(), // whitelisted field names only
    done: z.boolean().optional(),
  })
  ```
- Allow-list of writable columns mirrors `buildUpdatePayload()` in `PreferencesPanel.tsx`. Anything outside the list is dropped server-side before the `profiles` update.
- Conversation history is sent from the client (AI SDK `UIMessage[]`); not persisted (no thread storage). Each call also re-loads the latest profile and includes a compact "current preferences" summary in the system prompt so the AI is always grounded in the real DB state.

**New component `src/components/console/PreferencesChat.tsx`**
- AI SDK `useChat` against `/functions/v1/preferences-chat` (via `supabase.functions.invoke` or `DefaultChatTransport`).
- Renders assistant `parts` as: markdown text + chip row + optional text input. Chips post the chosen value(s) as the user message; the text input lets the user type freely.
- Shows "Current preferences" summary at the top, refetched after every assistant response that includes `updates`.
- Reuses existing `Button`, `Input`, `Card`, and design tokens. No new shadcn primitives.

**Console wiring (`src/components/console/PreferencesPanel.tsx` + `Console.tsx`)**
- Keep `PreferencesPanel` exported as the legacy form.
- In `Console.tsx`, the `preferences` tab renders a new wrapper that defaults to `PreferencesChat` and offers a "Switch to form" toggle that swaps to `PreferencesPanel`. The toggle preference is remembered in `localStorage`.
- `ProfileSetup.tsx` (onboarding) gets the same chat by default, with the form as fallback — so the experience is consistent for new and returning users.

**Data layer**
- No schema changes. All fields already exist on `profiles` (used by today's form).
- Updates always go through the server-side allow-list before `supabase.from('profiles').update(...)`.

## Out of scope (this plan)

- Voice mode for preferences (could reuse existing ElevenLabs TTS later).
- Persisting the preferences chat as a thread in chat history — kept session-only on purpose so it doesn't clutter `/chats`.
- Changing the underlying `profiles` schema.

## Verification

- New user → chat walks through all questions, summary card fills in step by step, final save persists to `profiles`.
- Returning user → opens preferences, sees current values summarized, can change one field by chip and another by free text in the same conversation.
- "Switch to form view" still loads `PreferencesPanel` with the latest saved values.
- Reload page → preferences persist (read from DB), chat starts fresh but acknowledges current state.
