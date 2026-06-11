
## Goal

Two new actions in the Chrome extension that sync back to the user's HomeLens account:
1. **Save Property** — bookmark on the analysis view → appears in the main app's saved properties with the extension's AI analysis attached.
2. **Save Chat** — saves the active extension conversation as a thread in the main app's `/chats`, idempotently appendable as the user keeps chatting.

Both surface a small "from extension" pill in the main app.

## Reuse existing tables (no new tables)

Confirmed from the live schema:
- `saved_properties` — exists with `(user_id, property_url)` unique index. Extend with `source`, `ai_analysis jsonb`, listing snapshot columns (`price`, `beds`, `baths`, `sqft`, `image_url`), and `updated_at` so re-saves bubble to the top.
- `conversations` + `messages` — already power `/chats` via `useSavedChats`. Extend `conversations` with `source`, `client_thread_id`, `property_url`.
- Public `properties` table is locked down for end users; the saved-properties row stores its own listing snapshot. No upsert into `properties`.

## Migration

```sql
alter table public.saved_properties
  add column if not exists source text not null default 'main_app'
    check (source in ('main_app','chrome_extension','investor_console')),
  add column if not exists ai_analysis jsonb,
  add column if not exists price numeric,
  add column if not exists beds integer,
  add column if not exists baths numeric,
  add column if not exists sqft integer,
  add column if not exists image_url text,
  add column if not exists updated_at timestamptz not null default now();

create trigger update_saved_properties_updated_at
  before update on public.saved_properties
  for each row execute function public.update_updated_at_column();

alter table public.conversations
  add column if not exists source text not null default 'main_app'
    check (source in ('main_app','chrome_extension')),
  add column if not exists client_thread_id text,
  add column if not exists property_url text;

create unique index if not exists conversations_user_client_thread_idx
  on public.conversations(user_id, client_thread_id)
  where client_thread_id is not null;

alter publication supabase_realtime add table public.saved_properties;
alter publication supabase_realtime add table public.conversations;
```
Existing GRANTs and RLS already cover the new columns.

## Backend — 2 edge functions

Both follow `_shared/` patterns (CORS, `loadProfile`/`getAuthenticatedUser`, structured logging). No `verify_jwt` override.

### `extension-save-property/index.ts`
- Zod-validate: `listing_url`, `scraped_data{address, city?, state?, price?, beds?, baths?, sqft?, primary_photo_url?}`, optional `ai_analysis`.
- Upsert behavior (revised): **refresh listing snapshot, preserve `ai_analysis`.**
  ```sql
  insert into saved_properties (
    user_id, property_url, property_address, city, state,
    price, beds, baths, sqft, image_url, ai_analysis, source
  ) values (...)
  on conflict (user_id, property_url) do update set
    price = excluded.price,
    beds = excluded.beds,
    baths = excluded.baths,
    sqft = excluded.sqft,
    image_url = excluded.image_url,
    updated_at = now()
    -- intentionally NOT updating ai_analysis or property_address/city/state
  returning id, (xmax = 0) as is_new;
  ```
- Save action itself is **not tier-gated** (Free/Buyer/Investor all allowed). AI analysis content was already produced under existing daily-cap enforcement upstream in `ai-chat`.
- Tier-aware `view_url` in the response:
  - Investor → `/console?tab=overview`
  - Free / Buyer → `/my-homelens` (or `/console` if that resolves for them — we'll verify which path renders the Saved Properties shelf for non-Investor tiers during build and pin it here).
- Response: `{ saved_property_id, is_new, view_url }`.

### `extension-save-chat/index.ts`
- Zod-validate: `thread_id_client`, optional `title`, `messages[]`, optional `property_context{listing_url}`.
- Look up `conversations` by `(user_id, client_thread_id)`.
  - Not found → insert with `source='chrome_extension'`, title from payload or first user message (~60 chars), `property_url` from context.
  - Found → reuse; backfill `property_url` if previously null.
- Idempotent append: count existing messages, insert only `messages[count..]` in order. Roles validated against `messages_role_check` ('user'|'assistant'). Tool-call payloads (extension-side) collapse to a JSON-prefixed `content` string — see "Known v1 limitations" below.
- Bump `conversations.updated_at` so the thread sorts to the top in `/chats`.
- Response: `{ thread_id, is_new, view_url: "/chats?c=<thread_id>" }`.

Both functions write one row to `tool_call_telemetry` (`extension_save_property` / `extension_save_chat`) with `{ is_new, has_property_context, message_count }`.

## Chrome extension UI

The extension is a single `popup.tsx` (no `components/` subdir). Plan:

- New `chrome-extension/saveActions.ts` — pure helpers `saveProperty(payload, authHeader)` and `saveChat(payload, authHeader)`. Mirrors the `SUPABASE_URL` constant style in `background.ts`.
- Extend `popup.tsx` with two inline buttons + a tiny in-popup toast (CSS in `popup.css`):
  - **Save Property** — rendered when the active tab is a detected listing AND a `propertyData` exists. Bookmark icon with idle / loading / saved states; saved state persisted to `chrome.storage.session` keyed by URL.
  - **Save Chat** — rendered in the composer row when `messages.length > 0`. Label flips "Save conversation" → "Saved" → "Save updated" once new messages arrive after the last save. `client_thread_id` generated once per (tab, URL) and persisted in `chrome.storage.session` so re-saves append.
- Auth: pull the Supabase session token already stored by the existing sign-in flow, send `Authorization: Bearer <token>`. No token → toast "Sign in to HomeLens" and `chrome.tabs.create` to login.
- Error handling: 401 → sign-in path. Network error → "Couldn't save. Tap to retry." 200 → "Saved to HomeLens · Open" (tap = `chrome.tabs.create` to `homelensais.com<view_url>` returned by the backend).

No new background-worker messages — the popup calls the edge functions directly (same pattern it already uses for ai-chat fallback).

## Main app integration (presentational only)

- `src/pages/Chats.tsx` — render a small "Chrome extension" pill for `conversation.source === 'chrome_extension'`; when opening such a thread, if `property_url` is set, render a slim "About this listing · Open" card above the messages.
- Saved Properties shelf (rendered from `useSavedProperties`) — same pill for `source === 'chrome_extension'`; if `ai_analysis.summary` exists, show it as a one-line subtitle.
- `src/hooks/useSavedProperties.ts` — extend the `SavedProperty` interface with the new optional columns. **No behavior change to existing CRUD.** Realtime: not currently subscribed — the current hook only refreshes on mount. Verification step below covers whether we need to add a `postgres_changes` subscription in this PR or document as a known gap.

## Known v1 limitations (call out in PR description)

1. **Tool-call fidelity loss when extension chats are continued in main app.** The `messages` table has no `tool_calls` / `tool_results` columns; assistant tool output collapses into `content`. Follow-up: add those columns if users complain.
2. **Same-property-different-URL dedup not handled.** Zillow + Realtor saves create two rows because the unique index is on `(user_id, property_url)`. Address-normalization is out of scope for v1.
3. **Realtime in `useSavedProperties` may not be wired today.** If verification shows the list doesn't auto-update on a Save Property from another tab, add a `postgres_changes` subscription inside this PR (small additive change to the hook). If it already updates, no action needed.

## Verification

1. Live extension popup on a Zillow listing → click Save Property → toast → row visible in saved-properties list with extension pill and AI summary; `view_url` opens to a surface the current user's tier can actually use (Free/Buyer land on `/my-homelens`, Investor on `/console`).
2. Click Save Property again on the same listing after a price drop → no duplicate, `price`/`beds`/`baths`/`sqft`/`image_url` updated, `ai_analysis` preserved, `updated_at` bumped so the row sorts to the top.
3. Sign out, click Save Property → "Sign in to HomeLens" toast + login tab.
4. Save a 4-message chat → thread appears in `/chats` with extension pill and the property context card.
5. Add 2 more messages in the extension, click "Save updated" → only the 2 new messages are inserted; existing ones unchanged.
6. Send a 5th message in `/chats` for an extension-saved chat → continues seamlessly.
7. **Realtime check (decides limitation #3):** main app saved-properties list open in tab A, click Save Property in extension in tab B → confirm tab A updates within ~2s without manual refresh. If not, add the postgres_changes subscription in this PR.
8. **Tier check:** repeat verification step 1 as Free and Buyer users; confirm the save action itself succeeds and the toast deep-link lands somewhere usable.

## Commit plan

1. Migration: extend `saved_properties` + `conversations`, add `updated_at` trigger, enable realtime.
2. `extension-save-property` edge function with refresh-snapshot / preserve-analysis upsert + tier-aware `view_url`.
3. `extension-save-chat` edge function with idempotent message append + telemetry row.
4. `chrome-extension/saveActions.ts` + popup buttons, toast, session state.
5. Main app: pills + property context card on `Chats.tsx`; pill + analysis subtitle on saved-properties shelf; type extension on `useSavedProperties` (and realtime subscription if verification step 7 requires it).

Out of scope (per the prompt and confirmed by review): auto-save preference, multi-property saves, tool-call message fidelity, public sharing, importing browser bookmarks, separate canonical `properties` upsert, cross-portal URL dedup.
