## Investor Brief cleanup + Property cover image

### 1. Investor Brief page — revert premium background & remove Deep Dive divider
File: `src/pages/InvestorBrief.tsx`
- Remove the full-width "Deep Dive" pill button injected between insight cards (revert `cards.flatMap` back to `cards.map`).
- Drop the `brief-surface` warm off-white canvas class from the page container so the background matches the standard app background (`bg-background`) used on other pages.
- Keep the masthead, hairline card styling, and stagger animations intact (only background + Deep Dive button change).

File: `src/index.css`
- Leave `.brief-card` / stagger tokens (still used by cards). Remove or stop applying the `--brief-canvas` background rule since it's no longer referenced.

### 2. My Properties — cover image upload
Storage: the `owned-property-photos` bucket already exists (private). We'll reuse it and read images via signed URLs.

**`src/components/investor/my-properties/AddPropertyDialog.tsx`**
- Add an optional "Cover image" file input at the top of the form (image/*, ~5MB cap).
- On save: after inserting the property, if a file was chosen, upload to `owned-property-photos/{user.id}/{propertyId}/cover-{timestamp}.{ext}` and insert a row into `investor_owned_property_photos` with `ordinal = 0` and a caption of "Cover".
- Show a small preview thumbnail before upload; handle upload errors with a toast but don't block property creation.

**`src/components/investor/my-properties/EditPropertyDialog.tsx`**
- Add the same "Cover image" control so users can add/replace a cover on existing properties (upload path identical; new photo replaces `ordinal = 0` by deleting the previous ordinal-0 row + storage object, then inserting the new one).

**`src/hooks/useOwnedProperties.ts` (and card display)**
- Fetch the ordinal-0 photo for each property (batch query on `investor_owned_property_photos` where `ordinal = 0`) and resolve a signed URL (1h) per property; attach as `coverUrl` on `OwnedPropertyWithMetrics`.

**`src/components/investor/my-properties/OwnedPropertyCard.tsx`**
- If `coverUrl` is present, render it as a 16:9 cover image at the top of the card; otherwise keep current header. Use `loading="lazy"` and alt text based on the address.

### Out of scope
- No changes to Owned Property Detail photo gallery (already uses the same bucket/table).
- No RLS or bucket changes — existing policies on `investor_owned_property_photos` and `owned-property-photos` already scope by `user_id`.
- No new tables or migrations.
