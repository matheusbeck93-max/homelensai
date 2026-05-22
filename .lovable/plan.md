
## What we're building

A new "Saved Properties" section at the top of the left sidebar in `/chats` (above the chat history list), matching the **Collapsible premium shelf** direction you picked. Each saved item shows the property **address** (primary label) + city/state (subtle), opens the original listing URL on click, with a delete (×) action on hover. Collapsible header shows a count badge.

A small **bookmark icon** appears on assistant chat messages that contain a property URL; clicking it saves that property to the shelf.

## UX flow

1. In a chat, the AI returns a property analysis with a Zillow/Redfin/Trulia URL.
2. User clicks the new **bookmark icon** next to "Add to Comparison" / "Save Analysis".
3. The property (URL + address) is saved and appears in the sidebar shelf instantly.
4. Clicking a shelf item opens the listing URL in a new tab. Hover reveals × to remove.
5. The shelf collapses/expands with chevron; empty state shows a subtle hint.

Note: This is a lightweight bookmark feature (URL + address only), separate from the existing premium **Saved Analyses** (which stores the full AI analysis text + score). Available to all users (free + premium).

## Database

New table `public.saved_properties`:

```
- id uuid pk
- user_id uuid (RLS: auth.uid() = user_id)
- property_url text not null
- property_address text not null
- city text
- state text
- created_at timestamptz
- unique (user_id, property_url)
```

RLS: users can select/insert/delete their own rows only.

## Files to create / change

**New**
- `supabase/migrations/<ts>_saved_properties.sql` — table + RLS + unique index
- `src/hooks/useSavedProperties.ts` — list/save/delete, mirrors `useSavedAnalyses` pattern
- `src/components/chat/SavedPropertiesShelf.tsx` — the collapsible shelf UI (semantic tokens, not raw blue-600)
- `src/components/chat/SavePropertyButton.tsx` — bookmark icon button shown on assistant messages with a property URL

**Modified**
- `src/pages/Chats.tsx` — mount `<SavedPropertiesShelf />` at top of left sidebar above the chat history list; pass save handler to message actions; extract first property URL + address from assistant messages to feed the Save button

## Design tokens

Use the existing HomeLens design system (steel blue `--primary`, `--muted`, `--border`, `--card`) rather than the raw `blue-600` / `slate-*` from the prototype, so it matches dark mode and the rest of the app.

## Non-goals

- No price/photo/Zestimate snapshot at save time (keep lightweight; user wanted address as the reference).
- Not gated behind Premium (it's a free bookmark, distinct from Saved Analyses).
- No reordering / folders / tags in this pass.
