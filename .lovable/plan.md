## Goal
Grant `matheusbeck93@gmail.com` and `pedrolbeck@gmail.com` permanent Investor plan access at no cost.

## Approach
Direct database update on the `profiles` table — no Stripe charges, no checkout, no expiration. This is the simplest path and gives them full Investor-tier feature access immediately (unlimited AI analyses, saved analyses, investor calculator pro features, etc.).

## What will change
Update two rows in `profiles`:

| Email | User ID | Before | After |
|---|---|---|---|
| matheusbeck93@gmail.com | 9ce41b39… | free | investor |
| pedrolbeck@gmail.com | 936faac3… | free | investor |

Also clear `subscription_cancel_at` and set `subscription_renews_at = NULL` so the UI doesn't show a renewal/cancel date (since there's no Stripe subscription backing this).

## Trade-offs
- **No Stripe record** — if they ever click "Manage Subscription", the customer portal will say no subscription exists. They won't be charged anything.
- **Permanent** — won't auto-revert. You can downgrade them manually later with another update if needed.
- **Realtime-aware** — `useSubscription` listens to `profiles` updates, so their tier will flip live without a re-login.

## Files
No code changes. Single SQL update executed via the data tool.

## Alternative (not chosen)
A Stripe 100%-off comp subscription would integrate with the billing portal and webhook flow, but you asked for forever + free, which the direct update handles more cleanly.