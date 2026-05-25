## Goal

Make the first-time preferences page identical to the "My HomeLens" preferences page. Currently, when a user opens `/profile` (or clicks "Edit Preferences") and their `onboarding_completed` is `false`, the old multi-step `OnboardingFlow` modal-style wizard is shown. The signup flow already routes to `/profile-setup` which uses the new `PreferencesPanel` — but the `/profile` path still falls back to the legacy component.

## Changes

### 1. `src/pages/Profile.tsx`
- Remove the import and usage of `OnboardingFlow`.
- When `!profileData.onboarding_completed` (first-time), render the same layout as `ProfileSetup.tsx`:
  - Welcome header ("Set Up Your Profile" / personalized copy)
  - `<PreferencesPanel embedded onSave={handleSaveAndContinue} />`
  - "Skip for now" ghost button → navigates to `/`
- `handleSaveAndContinue` updates the profile with the panel's payload, sets `onboarding_completed: true`, shows a success toast, then navigates to `/` (same UX as ProfileSetup).
- The "Edit Preferences" button on the completed profile view should also use the new panel — simplest path: navigate to `/profile-setup` instead of toggling `showOnboarding`. This keeps a single canonical preferences UI.

### 2. `src/components/OnboardingFlow.tsx`
- No longer referenced after the Profile.tsx change. Delete the file to prevent regressions and keep one source of truth for preferences UI.

## Out of scope
- No DB/schema changes. `PreferencesPanel` already writes all relevant fields via `buildUpdatePayload`; we just add `onboarding_completed: true` when saving from the first-time path.
- No changes to `Auth.tsx` (already routes new signups to `/profile-setup`).
- No changes to `PreferencesPanel` itself.

## Result
First-time users land on a page visually and functionally identical to the My HomeLens preferences page, can save and continue (or skip), and the legacy wizard is removed.
