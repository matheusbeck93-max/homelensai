## Goal
Give the preferences chat a real "closure" moment when the onboarding flow finishes, and clean up the awkward double‑"saved" phrasing that currently bleeds into the edit menu.

## Problems observed
1. After the last default question (`about_me` / skip), the assistant jumps straight into the edit menu with: **"All set — your preferences are saved. Your preferences are saved. What would you like to update?…"** — duplicated copy, no celebratory closure, no recap of what was captured.
2. After editing a single category, the bot says **"Saved. Your preferences are saved. What would you like to update?"** — same duplication, same abrupt tone.
3. There is no explicit confirmation step the user can dismiss. The user reads it as "the bot keeps asking questions".

## Plan (server-only changes — `supabase/functions/preferences-chat/index.ts`)

### 1. New completion step: `completed_summary`
- Add a new assistant state `mode: 'completed_summary'` (encoded in the hidden `<!--pc:...-->` marker).
- When the onboarding flow finishes for the first time (current `!followingQuestion` branch), respond with:
  - A clear closing line: **"You're all set — your preferences are saved. You can change anything anytime."**
  - A short recap of the captured fields (Goal, Cities, Budget, Beds/Baths, Strategy if relevant, Kids, Climate, Safety). Reuse `formatCurrentValue` for each non-empty field.
  - Three chip choices: `Looks good`, `Change something`, `Start over`.
  - `done: true`, `allow_text: true`, plus `saved_fields` populated (including `onboarding_completed`).

### 2. Handle the `completed_summary` state on the next user turn
- `Looks good` / "ok" / "thanks" → final terminal turn: **"Great — I'll use these for your HomeLens experience. Reopen this chat anytime to tweak."** with `done: true`, `choices: []`, `allow_text: true`. If the user types after that, fall through to the existing edit-menu detection.
- `Change something` → existing `editMenuResponse()`.
- `Start over` → existing `restart_all` branch.
- Free text → run `detectEditCategory`; if it matches a known category, jump straight into that single-question edit; otherwise show the edit menu.

### 3. Fix duplicated copy in `editMenuResponse`
- Change the base copy so a prefix no longer produces "Saved. Your preferences are saved…".
- New base: **"What would you like to update? Pick a category or just type what you'd like to change."**
- Prefix usages:
  - After editing a single field: `"Saved your {field}."` (use the friendly key label).
  - When category match failed: `"I didn't catch that —"`.

### 4. Minor polish
- `parseAnswerForQuestion` for `about_me` already returns `{ onboarding_completed: true }` on "skip" — keep that, but make sure the response goes through the new `completed_summary` branch (not the edit menu).
- Strip the duplicate "Your preferences are saved." sentence everywhere it currently appears.

## Out of scope
- No DB schema change.
- No change to `PreferencesChat.tsx` — it already renders whatever `assistant_message`, `choices`, `allow_text`, `done`, and `saved_fields` the server returns, and already strips `<!--pc:...-->` markers.
- No change to onboarding question order, parsers, or any other feature (Saved Properties, etc.).

## Files touched
- `supabase/functions/preferences-chat/index.ts` (only)
