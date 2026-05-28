
## Context

The `/chats` page is the main chat surface, distinct from the Investor Brief chat. It routes messages to two edge functions:

- `perplexity-chat` — default path for text questions
- `ai-chat` — used for attachments and Excel/workflow generation

**Today both functions already inject the user's full `profiles` row** (budget, target cities, buyer_types, investment strategy, about_me, etc.) into the system prompt. So preferences are already wired in.

**What is missing** — the boost we just shipped to `investor-chat`:
- Saved Analyses (`saved_analyses`)
- Saved Properties (`saved_properties`)
- My Properties / portfolio (`investor_owned_properties`)

That means a user on `/chats` can ask *"what's my budget?"* and get a real answer, but *"summarize my portfolio"* or *"what did my last analysis on 123 Main St conclude?"* will not work — the chat has no visibility into those tables.

## Plan

### 1. Add a shared user-context loader

Create `supabase/functions/_shared/userInvestorContext.ts` exporting:

- `loadUserInvestorContext(req)` — memoized per `Request` (like `profileLoader`). Queries the 3 tables in parallel using service role + the authenticated user id, capped at:
  - up to 10 owned properties (most recent),
  - up to 6 saved analyses (most recent),
  - up to 10 saved properties (most recent).
- `buildUserInvestorContextBlock(ctx)` — returns the same plain-text block format already used in `investor-chat/index.ts` (My Properties / Saved Analyses / Saved Properties sections), or an empty string if all three are empty.

This is the same logic that currently lives inline in `investor-chat/index.ts` — extract it into the shared file so all three chat functions stay consistent.

### 2. Wire it into `perplexity-chat`

In `supabase/functions/perplexity-chat/index.ts`:
- After the existing `loadProfile(req)` call that builds `profileContext`, also call `loadUserInvestorContext(req)` and append the resulting block to `profileContext` (under the existing "FULL USER PROFILE" section, as a new "USER ACTIVITY" subsection).
- Keep the existing "silent background context" guidance — don't reference saved items unless the user's question genuinely needs them.
- Skip when there is no authenticated user (anonymous requests stay anonymous).

### 3. Wire it into `ai-chat`

In `supabase/functions/ai-chat/index.ts`:
- In both branches that already call `loadProfile(req)` (URL-with-Firecrawl path + main text path), also call `loadUserInvestorContext(req)`.
- Append `buildUserInvestorContextBlock(...)` to the existing personalization block built from `profileSource`.
- Keep the MATCH_SCORE prefix logic untouched.

### 4. Refactor `investor-chat` to use the shared helper

Replace the inline `loadInvestorChatContext` / `buildInvestorContextBlock` in `supabase/functions/investor-chat/index.ts` with imports from the new `_shared/userInvestorContext.ts`. No behavior change — just deduplication.

### 5. Verify

- Deploy the three edge functions.
- Manual QA on `/chats` while logged in as a user who has at least one saved analysis, one saved property, and one owned property:
  - *"What's in my portfolio?"* → should list owned properties.
  - *"What did my last analysis say?"* → should reference the most recent saved analysis.
  - *"What properties have I saved?"* → should list saved properties.
- Confirm anonymous users (logged out) still get the existing generic experience without errors.

## Files touched

**Create**
- `supabase/functions/_shared/userInvestorContext.ts`

**Edit**
- `supabase/functions/perplexity-chat/index.ts`
- `supabase/functions/ai-chat/index.ts`
- `supabase/functions/investor-chat/index.ts` (refactor to import shared helper)

No frontend, schema, or RLS changes — service role reads scoped to `auth.uid()` only.
