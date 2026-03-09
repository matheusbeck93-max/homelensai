

# Plan: Post-Signup Profile Setup + Preferences Tab in Console

## What changes

### 1. New post-signup profile setup page (`src/pages/ProfileSetup.tsx`)
After account creation, redirect to a new `/profile-setup` page instead of `/profile`. This page shows:
- Header: "Have a personalized experience with HomeLens."
- Sections (all optional, with "Skip" and "Continue"/"Save" buttons):
  - **Primary Goal** (reuse the radio group from `PrimaryGoalSelector`)
  - **Investment Profile** (strategies, hold period, financing — multi-value `(+)` pattern)
  - **Must-Have Features** (checkboxes + custom input)
  - **Lifestyle & Family** (children, climate, safety)
  - **What should I know about you?** (textarea)
- A single-page scrollable form (not multi-step wizard) with a "Save & Continue" button at bottom → saves to `profiles` → navigates to `/`
- A "Skip for now" link that goes straight to `/`

### 2. Update Auth.tsx redirect
Change line 53: `navigate('/profile')` → `navigate('/profile-setup')`

### 3. New "Preferences" tab in Console (`/console`)
- Add a 4th tab: **Preferences** (with `SlidersHorizontal` icon)
- Grid becomes `lg:grid-cols-4`
- The Preferences tab renders a new `PreferencesPanel` component containing:
  - Primary Goal selector
  - Default Search Preferences (cities, buyer personas, budget, bathrooms)
  - Investment Profile (strategies, hold period, financing)
  - Must-Have Features
  - Lifestyle & Family
  - What should I know about you?
  - Save All Preferences button

### 4. Slim down Account tab (`AccountPreferencesPanel`)
Keep ONLY:
- Account Information (name, email)
- Appearance (theme toggle)
- Danger Zone (delete account)
- Save button for account info

### 5. New component: `PreferencesPanel.tsx`
Extract all preference-related state/UI from `AccountPreferencesPanel` into `src/components/console/PreferencesPanel.tsx`. This component is reused by both the Console Preferences tab and the ProfileSetup page.

### 6. Add route in App.tsx
Add `<Route path="/profile-setup" element={<ProfileSetup />} />`

## Files changed

| File | Change |
|---|---|
| `src/pages/ProfileSetup.tsx` | **New** — post-signup preferences page |
| `src/components/console/PreferencesPanel.tsx` | **New** — extracted preferences UI |
| `src/components/console/AccountPreferencesPanel.tsx` | **Slimmed** — only Account Info, Appearance, Danger Zone |
| `src/pages/Console.tsx` | Add 4th "Preferences" tab |
| `src/pages/Auth.tsx` | Redirect signup to `/profile-setup` |
| `src/App.tsx` | Add `/profile-setup` route |

No database changes needed — all columns already exist.

