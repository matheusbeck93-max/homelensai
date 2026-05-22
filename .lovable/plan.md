## Goal

Rebuild the Preferences chat into a real conversational Q&A: structured questions with choice buttons, US city/state validation, navigation controls (back / restart), free-form custom preferences, intent detection for "reset" / "edit" at any time, and a clear save at the end.

## Problems with current flow

- Free-text input on the cities step accepts anything (e.g. typing "reset" gets saved as a city).
- No "back" or "restart" controls during the questionnaire — user is locked into forward motion.
- No intent recognition: typing "reset preferences" or "edit budget" mid-conversation is treated as an answer to the current question.
- No way to capture arbitrary preferences like "close to a Whole Foods" — only the fixed schema fields exist.
- End-of-flow save/closure is unclear and re-entry behavior is confusing.

## New flow

```text
Welcome  →  Q1 Goal  →  Q2 Cities  →  Q3 Persona  →  …  →  Q14 About me
                  ↑           ↑
              [Back] [Restart] always visible during questionnaire

End  →  Recap  →  [Save & finish] [Edit something] [Reset all]
                          ↓
              "All saved. You can come back anytime and just say
               'reset preferences', 'edit budget', or add a custom
               note like 'close to a Whole Foods'."
```

Returning users with completed preferences land on the recap + the same three actions, plus an open prompt. Any free-text message is first run through an **intent classifier** before being treated as an answer.

## Intent layer (runs on every user message)

Server detects one of:

1. `reset` — phrases like "reset preferences", "start over", "clear everything" → confirm, then wipe editable fields and restart at Q1.
2. `edit:<field>` — "edit budget", "change my cities", "update kids" → jump to that question pre-filled.
3. `back` — "back", "previous", "go back" → re-ask previous question.
4. `skip` — "skip" → leave field unchanged, next question.
5. `custom_preference` — anything that doesn't fit a field but reads as a preference (e.g. "close to a Whole Foods", "must have good schools nearby", "pet-friendly building") → append to `about_me` with a confirmation, then continue.
6. `answer` — default: treat as answer to the current question.

Classifier: lightweight regex/keyword pass first (covers ~90%), Lovable AI Gateway (`google/gemini-3-flash-preview`) fallback for ambiguous messages, returning structured JSON via `Output.object`.

## US city/state validation

- Reuse `src/data/usStatesCities.ts` (already in the project) on the server side to validate each entry the user types under cities.
- Accept formats: `"Austin, TX"`, `"Austin"`, `"Texas"`, `"DFW"` (regional aliases via existing NLP region map memory).
- Reject non-matches with a helpful message: `"I couldn't find 'reset' as a US city or state. Try a city like 'Austin, TX' — or tap Back / Reset preferences."`
- Multi-city: comma-separated input, each validated individually; show which were accepted vs rejected.

## Navigation controls

Every question turn returns:
- Its choice chips (when applicable)
- Persistent buttons: **← Back**, **↻ Restart**, **Skip** (where allowed)
- Free-text input still active for answer or intent

Server tracks `question_index` in a hidden `<!--pc:state=...-->` marker (same pattern as today) so back/restart works without DB state.

## Custom preferences

- During the questionnaire: if the message is classified `custom_preference`, append to `about_me` (`existing + "; " + new`), confirm "Added to your notes: '…'", and re-ask the same question.
- After completion: free-text in the chat box defaults to `custom_preference` unless intent matches reset/edit. Each addition appends to `about_me` with a "Saved" badge.

## Save & closure

- Each answered question saves its field immediately (current behavior — keep).
- On the final question, set `onboarding_completed = true`, render a recap card message, and show three actions: **Done**, **Edit something**, **Reset preferences**.
- "Done" → closes with `"All saved. Ask me anytime to edit or reset — or just add a new preference."` and the chat stays open for free-text follow-ups (no more questions).

## Files to change

1. **`supabase/functions/preferences-chat/index.ts`**
   - Add intent classifier (regex first, AI fallback) at top of request handler.
   - Add US city/state validator using a server copy of the cities dataset (small JSON in `_shared/`).
   - Track `question_index` in state marker; implement `back` / `restart` / `skip` transitions.
   - Add `custom_preference` handler that appends to `about_me`.
   - Rewrite question runner so each turn returns: choices + nav buttons + allow_text.
   - Tighten final-step closure message and post-completion free-text handling.

2. **`src/components/console/PreferencesChat.tsx`**
   - Render new nav buttons (Back / Restart / Skip) when the server returns them as a separate `nav_choices` array (styled distinctly from answer choices).
   - Show city validation feedback inline (accepted vs rejected cities).
   - Keep existing dedup/boot guards.

3. **`supabase/functions/_shared/usCities.ts`** (new)
   - Minimal exported list of US states + major cities (port from `src/data/usStatesCities.ts`) for server-side validation. Keep file small — only what's needed for fuzzy matching.

## Out of scope

- No DB schema changes.
- No design overhaul beyond adding the nav button row.
- No changes to the Form mode (`PreferencesPanel`) — only the Chat mode.
- No changes to other console tabs.
