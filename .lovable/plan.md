## Unified Investor Brief — Single Surface Rebuild

This supersedes the prior two-route design (`/investor` brief + `/investor/console` chat). The brief and chat become **one surface** at `/investor` that swaps state in-place. The Comparator tab and rail icon are removed entirely (folded into an AI tool). A new **Buying Power** card is added.

### Scope summary

- Keep DB tables already created (`investor_briefs`, `investor_brief_cards`, `investor_talking_points`, `investor_card_feedback`, `investor_brief_events`).
- Add `cash_available` + `financing_defaults` JSON to `profiles` for the Buying Power card.
- Delete the separate `/investor/console` route + `InvestorConsole.tsx`.
- Rewrite `/investor` page to host `mode: 'brief' | 'chat'` state with shared composer and right-column dispatch.
- Add Buying Power card, ContextCard, ChatMessageList, DeepPanel + 3 initial deep views, NoteCallout, BottomActionBar, BriefEditDialog, TalkingPointPicker.
- Add `InvestorBriefContext` for mode/thread/activeCardContext.
- Add `aiTools.ts` registry (compare_properties, list_affordable_listings, etc.) — wired via existing `ai-chat` edge function for actual LLM calls.
- Remove Comparator references from sidebar/rail.

### Changes

**DB migration**
- Add `cash_available numeric`, `financing_defaults jsonb default '{"downPct":25,"rateApr":7,"termYears":30}'` to `profiles`.

**New files**
- `src/contexts/InvestorBriefContext.tsx` — mode, chat thread, activeCardContext, enter/exitChatMode.
- `src/components/investor/brief/ContextCard.tsx`
- `src/components/investor/brief/ChatMessageList.tsx`
- `src/components/investor/brief/NoteCallout.tsx`
- `src/components/investor/brief/BottomActionBar.tsx`
- `src/components/investor/brief/BriefEditDialog.tsx`
- `src/components/investor/brief/TalkingPointPicker.tsx`
- `src/components/investor/brief/cards/BuyingPowerCard.tsx`
- `src/components/investor/brief/cards/AnomalyCard.tsx`
- `src/components/investor/brief/deep/DeepPanel.tsx` (dispatch by card_type)
- `src/components/investor/brief/deep/AffordableListingsView.tsx`
- `src/components/investor/brief/deep/MarketBreakdownView.tsx`
- `src/components/investor/brief/deep/PropertyReductionDetailsView.tsx`
- `src/lib/investorBrief/buyingPower.ts` — pure compute.
- `src/lib/investorBrief/aiTools.ts` — tool registry metadata.

**Rewrites**
- `src/pages/InvestorBrief.tsx` — wrap in `InvestorBriefProvider`; render `BriefCard` (mode-aware) + right column (`DashboardGrid` vs `DeepPanel`); single composer; IconRail (no Chat, no Comparator icon).
- `src/components/investor/brief/BriefCard.tsx` — two states sharing composer; back-chevron in chat mode.
- `src/lib/investorBrief/insightRegistry.ts` — add `buying_power` entry with `investigatePrompt` + `deepView` + `toContextCard`; extend interface.
- `src/components/investor/console/ConsoleSidebar.tsx` — remove Comparator + Chat items; rename to IconRail or repurpose; keep Home/Properties/Saved Analyses/Searches/Calculator/Preferences.

**Deletions**
- `src/pages/InvestorConsole.tsx` and its route in `src/App.tsx`.
- Comparator rail link (kept as page if it already exists, just removed from rail).

**Edge function**
- `supabase/functions/investor-brief/index.ts` — extend prompt to reference Buying Power summary + pinned talking points (already partly done).
- Chat in chat-mode reuses existing `ai-chat` edge function with a system prefix derived from `activeCardContext`.

### Out of scope this pass

- Scheduled cron regeneration job (will add as separate pass).
- Telemetry events instrumentation (stubs in place; full wiring later).
- Tool execution backend for `compare_properties` etc. (registry + UI hook only — AI will narrate, no live tool calls yet).
- Deep linking via `?investigate=` query param.
- Mobile polish pass beyond stack-on-narrow.

### Tech notes

- Chat thread lives in `InvestorBriefContext` (in-memory, session-only). No new DB table for it in this pass.
- `DeepPanel` reads `activeCardContext.card.data_snapshot` and renders the matching view; falls back to a neutral "Exploring this insight" placeholder.
- `BuyingPowerCard` pulls `cash_available` + `financing_defaults` from `profiles`, market medians from `market_snapshots` (existing) or computes from `saved_properties` as fallback.
- IconRail = compact `ConsoleSidebar` with revised items.

Confirm and I'll implement.
