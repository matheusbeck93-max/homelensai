## Plan

1. **Stop button values from being saved as notes**
   - Treat `complete:change`, `complete:restart`, and `complete:looks_good` as reserved UI commands before the generic “custom preference” fallback runs.
   - This prevents messages like `complete:change` from being appended to `about_me`.

2. **Make completion actions route correctly**
   - `Change something` should open the edit category menu immediately.
   - `Reset preferences` should clear preferences and restart the Q&A from question 1.
   - `Done` should close with a saved acknowledgement.

3. **Make edit-menu buttons reliable**
   - Ensure `edit:*` and `edit:restart_all` choices are sent/handled as commands, not prettified labels or free-text notes.
   - Keep natural-language commands like “reset preferences” and “change cities to Woodbridge, VA” working.

4. **Verify with a direct backend function test**
   - Test the sequence for completion summary → `complete:change` and completion summary → `complete:restart` to confirm no command strings are saved as preferences.