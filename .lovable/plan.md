## Problem

In production at `https://homelensais.com/chats`, sending a message fails with:
> Failed to send a request to the Edge Function

Edge function logs for `perplexity-chat` show only successful `OPTIONS` preflights and no `POST` requests. This is a classic browser-blocked CORS response.

Root cause: `supabase/functions/_shared/cors.ts` only allows these origins:
- `homelens.ai`, `www.`, `app.`, `staging.`, `*.homelens.ai`
- `*.lovable.app`, `*.lovable.dev`
- `localhost:5173/3000/4173`
- `chrome-extension://*`

The actual production custom domain is `homelensais.com` (note the extra `ais`), so preflight echoes back the default `https://homelens.ai` origin, the browser rejects the response, and the POST never leaves the page.

## Fix

Update `supabase/functions/_shared/cors.ts` `ALLOWED_ORIGIN_PATTERNS` to also allow the real production domain:

```
(o) => o === 'https://homelensais.com',
(o) => o === 'https://www.homelensais.com',
(o) => /^https:\/\/[a-z0-9-]+\.homelensais\.com$/i.test(o),
```

Also update the `DEFAULT_SAFE_ORIGIN` to `https://homelensais.com` so any non-allowlisted preflight at least falls back to the actual production origin (cosmetic but correct).

## Verification

1. Republish so the updated edge functions deploy.
2. From `https://homelensais.com/chats`, send a message — confirm a reply streams back.
3. Check edge function logs: a `POST /perplexity-chat 200` should now appear (not only OPTIONS).

## Scope

One file edited: `supabase/functions/_shared/cors.ts`. No frontend, schema, or business logic changes.
