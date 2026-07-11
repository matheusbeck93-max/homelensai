## Brief card borders + property cover image reliability

### 1. Investor Brief cards — restore visible borders
Root cause: `.brief-card` uses `border: 1px solid hsl(var(--brief-hairline))`, but `--brief-hairline` is only declared inside `.brief-surface`. When I removed the `brief-surface` class from the page background, the variable became undefined and the border resolves to invalid → no border renders.

File: `src/index.css`
- Move `--brief-hairline` (and `--brief-card`) declarations up to `:root` and `.dark` so they exist globally.
- Tune the light-mode hairline to a slightly stronger neutral (e.g. `220 13% 88%`) so cards read clearly against the standard app background.

### 2. My Properties — cover image not appearing
Likely causes (in priority order):
1. Storage upload fails silently for some MIME types (HEIC, empty `type`), we log a toast and continue but nothing is stored, so `primary_photo_url` remains null.
2. When `coverFile.type` is empty (some browsers on HEIC), passing `contentType: ""` to `.upload()` can be rejected by Storage.
3. Existing rows where `primary_photo_url` was previously written as an absolute URL are still shown fine; new uploads pass a raw storage path, and the signed-URL resolution in `useOwnedProperties` should work — but if the upload failed the row keeps null.

Fixes:

**`src/components/investor/my-properties/AddPropertyDialog.tsx` + `EditPropertyDialog.tsx`**
- Validate the file client-side: accept any `image/*`; if the browser reports no MIME, infer from extension (`.heic`, `.heif`, `.jpg`, `.png`, `.webp`, `.gif`, `.avif`).
- Only pass `contentType` to `.upload()` when non-empty; otherwise omit so Storage infers.
- Await upload, and if `upload()` returns an error, surface a destructive toast with the concrete error and **abort** the flow instead of silently continuing. Log the error to the console for debugging.
- After a successful upload, await the `primary_photo_url` update and log any error the same way.
- For HEIC/HEIF specifically, warn the user in the toast: "Uploaded, but HEIC images don't render in most browsers — convert to JPG/PNG for a visible cover." (Still stored so no data loss.)

**`src/hooks/useOwnedProperties.ts` + `src/hooks/useOwnedProperty.ts`**
- Keep the signed-URL resolution logic, but log a console warning when `createSignedUrl` returns no URL (helps diagnose RLS/path mismatches).
- Treat any `primary_photo_url` that starts with the user's id or contains a `/` (and isn't `http`) as a storage path — current heuristic (`!/^https?:\/\//i.test(...)`) is already correct; leave it.

**`src/components/investor/my-properties/OwnedPropertyCard.tsx`**
- Add `onError` handler on the `<img>` that falls back to the placeholder icon when the signed URL fails to load (covers HEIC / expired URL edge cases so the UI doesn't show a broken image).

### Out of scope
- No changes to storage bucket policies or migrations.
- No server-side HEIC → JPG conversion (would need an edge function; not requested).
- No changes to the OwnedPropertyDetail photo gallery.
