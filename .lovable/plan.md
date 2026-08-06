# Comprehensive HomeLens Credit Limits Document

## Goal
Create a polished, comprehensive document that explains in detail how HomeLens credit limits, AI budgets, and feature quotas work across the Free, Buyer, and Investor plans.

## Document Contents

1. **Executive Summary**
   - One-paragraph overview of the dual-limit system: per-tier daily/monthly AI budgets + monthly feature quotas.

2. **Plan Overview & Pricing**
   - Free: $0
   - Buyer: $9.97/mo ($7.97/mo annual)
   - Investor: $24.97/mo ($19.97/mo annual)
   - Brief description of what each plan unlocks.

3. **AI Budget Caps (USD)**
   - Daily caps: Free $1, Buyer $10, Investor $25
   - Monthly caps: Free $1, Buyer $10, Investor $25
   - How caps are enforced via `_shared/ai/budgetGuard.ts`
   - Approximate turns per day at ~$0.02/turn
   - Reset times: daily at UTC midnight, monthly on the 1st of the month

4. **Feature Quotas (Monthly)**
   - Table comparing chat, photo generation, and investor brief limits:
     - Free: 20 chats, 1 photo, 3 briefs
     - Buyer: 500 chats, 10 photos, 30 briefs
     - Investor: 2,000 chats, 50 photos, 100 briefs
   - Enforcement point: `_shared/usage-gate.ts`

5. **Legacy Token-Based Credit System**
   - Free users receive 100 AI credits per UTC day
   - 1 credit = 100 tokens, rounded up, min 1 / max 20 credits per request
   - Premium users bypass this system
   - Master switch `CREDITS_ENFORCED = true`

6. **Credit Packs & Top-Ups**
   - Available only to paid users
   - Small: $5 → $5 credit
   - Medium: $10 → $11 credit (10% bonus)
   - Large: $25 → $30 credit (20% bonus)
   - Top-up credits expire after 90 days
   - Consumption order: plan credits first, then top-up FIFO

7. **How the Budget Guard Works**
   - `budget-status` endpoint polls every 60s while an AI surface is mounted
   - 402 `budget_exceeded` response when cap is hit
   - Credits kick in after the cap is reached for paid users
   - Free users are directed to upgrade

8. **Staff / Internal Accounts**
   - `is_staff = true` bypasses all caps
   - UI renders a special "Internal account" state

9. **User-Facing Surfaces**
   - `/account/usage` page
   - Budget cap warning chip in composers
   - Upgrade CTAs and checkout flow

## Deliverable
- A DOCX file saved to `/mnt/documents/HomeLens-Credit-Limits-Guide.docx`
- Validate with the project’s docx validation script
- Convert to PDF and inspect each page for formatting issues before delivery
- Present the artifact with `<presentation-artifact>`

## Style
- Match HomeLens brand: steel blue primary (#6B8DB5), dark (#2C3E55), clean sans-serif typography
- Use tables for plan comparisons
- Include a cover page and table of contents
