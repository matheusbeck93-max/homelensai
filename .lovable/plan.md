## Changes to `src/components/console/PreferencesChat.tsx`

1. **Rename card title** from "Chat with your HomeLens assistant" to **"Choose your preferences — change at any time"**.

2. **Always render the input box.** Today the free-text `<Input>` only renders when `last?.role === "assistant" && last.allowText !== false`. If the initial `callChat([])` fails (network, CORS, 402, etc.), the user sees an empty card with no way to type — exactly what the screenshot shows. Change so the input + send button are always visible (disabled only while `loading`), independent of the last turn. Chips stay conditional on `last.choices`.

3. **Preload a local first question** instead of relying on the edge function for the greeting. On mount, seed `turns` with one assistant turn:
   - content: a short intro + "What's your primary goal with HomeLens?"
   - choices: `Buy a home`, `Invest`, `Both`, `Just exploring` (mapped to `primary_goal` values)
   - multi_select: false, allow_text: true
   
   Only call the edge function after the user responds. This guarantees the UI is interactive immediately even if the edge function is slow or errors, and removes the "Loading your preferences…" dead state.

4. **Error resilience.** If `callChat` throws, append a small assistant turn ("Something went wrong — try again or type your answer below") so the conversation never ends in a blank state. Input remains enabled.

5. **Server prompt note (no code change required unless title text is referenced).** The edge function's system prompt already adapts to current profile; since the client now owns the opening question, add a one-line instruction in the system prompt: *"The client has already asked the user their primary goal. Continue from there — do not re-ask goal unless the user wants to change it."*

## Out of scope
- No schema changes, no Console.tsx changes, no Form view changes.
- No persisted chat history (still ephemeral per session).

## Verification
- Reload `/console?tab=preferences`: card shows new title, summary card, the preloaded "What's your primary goal?" message with 4 chips, and an always-visible text input at the bottom.
- Click a chip or type → user message appears, edge function is called, assistant reply renders, profile summary refreshes.
- Temporarily block the edge function → input still works, error turn appears, user can retry.
