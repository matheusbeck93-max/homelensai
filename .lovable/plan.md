## Plan

Fix the first-time preferences flow so it uses the same component and behavior as **My HomeLens → Preferences**.

### What will change

1. **Use `PreferencesChat` instead of the old form panel**
   - Replace the current `/profile-setup` embedded `PreferencesPanel` form with the same `PreferencesChat` component used on `/console?tab=preferences`.
   - This makes the first-login page visually and functionally match the Preferences page: assistant chat, summary card, Save, Review summary, Edit manually, Restart setup, and Reset preferences.

2. **Add first-time “save and continue” behavior**
   - Extend `PreferencesChat` with optional onboarding props, for example:
     - `onSaveComplete`
     - `saveLabel`
     - optional `showContinueAction`
   - On first-time setup, the Save button will save preferences, mark `onboarding_completed: true`, show a success toast, and navigate the user to the app.

3. **Align `/profile` first-time view with `/profile-setup`**
   - Update `/profile` so incomplete users also see the same first-time `PreferencesChat` setup experience instead of the old-style `PreferencesPanel`.
   - Keep “Skip for now” available, but it should also mark onboarding as completed before navigating home so the user doesn’t keep seeing setup repeatedly.

4. **Keep the completed profile edit path canonical**
   - The completed profile “Edit Preferences” action should take users to `/console?tab=preferences`, because that is now the true Preferences page.

### Technical details

- Files to update:
  - `src/components/console/PreferencesChat.tsx`
  - `src/pages/ProfileSetup.tsx`
  - `src/pages/Profile.tsx`
- No database schema changes.
- No changes to authentication routing.
- No changes to the existing My HomeLens Preferences page behavior except making `PreferencesChat` reusable for first-time setup.