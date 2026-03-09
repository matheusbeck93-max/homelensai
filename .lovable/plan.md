

# Fix: Update Guest Hero Headline

**File: `src/pages/Index.tsx`** — Line 411

Change the guest fallback from `'Only Good Deals'` to `'Meet Your AI Real Estate Advisor'`.

```
- {userName ? `Hello, ${userName.split(' ')[0]}` : 'Only Good Deals'}
+ {userName ? `Hello, ${userName.split(' ')[0]}` : 'Meet Your AI Real Estate Advisor'}
```

Single line change. Everything else stays the same.

