## Plan

Rework Preferences into one clean conversational flow with a clear start, guided questions, a final save/closure screen, and reset/edit options.

### 1. Fix duplicate opening/update messages
- Add a frontend boot guard so the preferences chat only requests the first server message once.
- Add defensive duplicate-response handling so identical assistant messages are not appended twice.
- This directly fixes the repeated “What would you like to update…” issue.

### 2. Simplify the server state machine
- Keep the flow to these states only:
  - `welcome` / first question
  - `question`
  - `completed_summary`
  - `closed`
  - `editing`
  - `reset`
- Remove confusing loops where completed users are immediately shown the update menu again.

### 3. Make the first-time flow feel complete
- Start with a short welcome message.
- Ask each preset preference question one at a time with choice buttons and text input where useful.
- After the last question, show a recap and clear closure:
  - “Your preferences are saved.”
  - Summary of captured preferences
  - Buttons: `Looks good`, `Change something`, `Reset preferences`

### 4. Make returning users land in a sensible place
- If preferences are already complete, show a concise saved-summary message first, not the update menu twice.
- Offer clear actions:
  - `Change something`
  - `Reset preferences`
  - `Done`

### 5. Reset flow
- `Reset preferences` clears preference fields and starts the guided questions from the beginning.
- The reset message should explicitly say it is starting fresh.

### 6. Save behavior
- Save each answer as the user progresses, as today.
- At the end, set `onboarding_completed = true` and refresh the profile summary.
- After `Looks good` / `Done`, close the chat with a final message and no repeated prompt.

### Files to change
- `src/components/console/PreferencesChat.tsx`
  - boot guard
  - duplicate assistant message prevention
  - clearer done/reset text handling if needed
- `supabase/functions/preferences-chat/index.ts`
  - simplify completion/opening/edit/reset responses
  - prevent completed users from being dropped directly into a repeated edit menu

### Out of scope
- No database schema changes.
- No design overhaul.
- No changes to unrelated console/profile features.