## Bug
`create-checkout` edge function fails with Stripe error:
`"You may only specify one of these parameters: customer, customer_email."`

## Root cause
In `supabase/functions/create-checkout/index.ts` (lines 51-58), the session payload is built as:
```ts
{
  customer: customerId,
  customer_email: customerId ? undefined : user.email,
  ...
}
```
When `getOrCacheStripeCustomerId` returns `null` (no cached customer), `customer: null` is still serialized by the Stripe SDK as an empty `customer` form field. Stripe then sees BOTH `customer` and `customer_email` present and rejects the request.

## Fix
Build the params object conditionally so only one of the two keys is ever present:

```ts
const params: Stripe.Checkout.SessionCreateParams = {
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  success_url: `${origin}/?checkout=success`,
  cancel_url: `${origin}/pricing?checkout=canceled`,
};
if (customerId) {
  params.customer = customerId;
} else {
  params.customer_email = user.email;
}
const session = await stripe.checkout.sessions.create(params);
```

## Files touched
- edit `supabase/functions/create-checkout/index.ts` (only the params construction)

## Out of scope
- No frontend changes — once the edge function is fixed and redeployed, the existing "Upgrade" button will work.
- No pricing/Stripe product changes.
