
## Goal
Close the three biggest remaining gaps from the original CI build, in sequence:
1. `investor-chat` emits CI signals
2. `<ConversationalIntelligence />` mounts on Investor surfaces (composer + DeepPanel)
3. `generate-artifact` supports `property_report_pdf` and `chart_image`

---

## 1. `investor-chat` → emit CI signals

`supabase/functions/investor-chat/index.ts` (1534 lines) streams SSE with `text_delta` chunks and ends with `turn_done`. It has its own system prompt and explicitly bans `MATCH_SCORE` prefixes — CI signals are orthogonal so they're safe to add.

Changes:
- Import `ciSignalsPromptBlock` + `extractCiSignals` from `_shared/conversationalSignals.ts`.
- Append `ciSignalsPromptBlock()` to the system prompt builder (after persona/KPI blocks).
- After the model loop completes and `finalText` is assembled (just before persisting the assistant message ~L1450), run `extractCiSignals(finalText)`:
  - Replace `finalText` with `cleanText` so the trailing `<<CI_SIGNALS …>>` block is stripped from what's persisted and displayed.
  - Add a new SSE event `signals` emitted **before** `turn_done` carrying `{ mismatch_signals, profile_updates, suggested_followups }`.
- Update `src/lib/investorChat/streamClient.ts`:
  - Add `signals` to `SseEvent` union.
- Update `src/contexts/InvestorBriefContext.tsx`:
  - Handle the new event in the `onEvent` switch; attach `signals` to the assistant `ChatTurn` being built (extend `ChatTurn` with optional `signals` mirroring `ChatTurn` in `conversationalIntelligence/types.ts`).
- Strip the `<<CI_SIGNALS …>>` block from streaming `text_delta` display too — easiest approach: don't filter deltas (model emits the block at the very end after the prose); rely on final sanitization. If it ever leaks visually, add a tail-trim on `currentTurn.text` when the `signals` event arrives.

Risk: investor-chat does multi-round tool calling. The signals block must only be emitted in the final assistant turn (no tool calls outstanding). The prompt block already instructs "at end of final response", and `extractCiSignals` is regex-anchored to end-of-text, so risk is low.

## 2. Mount `<ConversationalIntelligence />` on Investor surfaces

Two mount points share the same Investor thread:
- `src/components/investor/chat/` composer area (the main Investor brief chat) — find the composer parent and render `<ConversationalIntelligence />` directly above the `PromptInput`/textarea.
- `src/components/investor/brief/deep/DeepPanel.tsx` — render above the back button area, scoped to the deep-dive turn so chips/mismatches react to the most recent assistant turn.

Wiring in both places:
- Surface kind: `{ kind: "investor_chat" }` (composer) and `{ kind: "investor_deep_dive", … }` (deep panel). Add `"investor_chat"` / `"investor_deep_dive"` to `SurfaceKind` if missing.
- `thread`: map `currentThread` (`ChatTurn[]` from `InvestorBriefContext`) to the CI `ChatTurn` shape. Existing `ChatTurn` already has `role` + `content` + (after step 1) `signals` — small adapter only.
- Use the shared `useConversationalIntelligenceState(user.id)` hook (already used by `/chats`) for prefs/dismissals/`onAcceptFollowup`/`onDismissFollowup`/`onSaveException`/`generateArtifact`.
- `onSendMessage` → `sendTurn(text)` from the context.
- Pass `active.snapshot` only when DeepPanel has a `sourceCard` with property metadata (skip if not a property card).

Verification: send a budget-stretching prompt in `/investor`, confirm mismatch card + chips render under the composer, confirm generate-purchase-plan chip downloads a PDF, confirm telemetry rows write to `ci_web_events` with `surface=investor_chat`.

## 3. `property_report_pdf` + `chart_image` renderers

`generate-artifact/index.ts` already has the auth/cap/upload/log scaffolding and `pdf-lib` imported. Add the two missing renderers:

### 3a. `property_report_pdf` (pdf-lib, no new deps)
- Add Zod schema `PropertyReportInput`: `{ kind, address, price, beds, baths, sqft, year_built?, lot_sqft?, hoa_monthly?, property_tax_annual?, zestimate?, days_on_market?, school_score?, walk_score?, summary_text?, surface?, source_thread_id? }`.
- Renderer `renderPropertyReportPdf(body)` — 2 pages:
  - **Page 1**: HomeLens brand header, address as H1, price big, KPI grid (beds/baths/sqft/year/lot/HOA/tax), value indicator (price vs zestimate %), DOM badge.
  - **Page 2**: Schools/Walk score blocks, optional AI summary paragraph (wrapped), footer with disclaimer + generated date.
- Filename: `property-report-<address-slug>-<yyyymmdd>-<id8>.pdf`.
- Add `else if (body.kind === 'property_report_pdf')` branch in the kind router.

### 3b. `chart_image` (pdf-lib won't help; need SVG → PNG)
- Add Zod schema `ChartImageInput`: `{ kind, chart_type: 'bar' | 'line' | 'donut', title, series: Array<{ label, value }>, x_label?, y_label?, surface?, source_thread_id? }` with array length cap (≤24) and string length caps.
- Render approach: build SVG string in pure TS (no canvas/d3 needed for these 3 chart types), then rasterize to PNG with `@resvg/resvg-wasm` via esm.sh: `import { Resvg, initWasm } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2'` and `await initWasm(fetch('https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm'))` lazily, cached at module scope.
- Output: 1200×630 PNG branded with HomeLens header strip + title + chart body + footer.
- Filename: `chart-<chart_type>-<title-slug>-<id8>.png`, mime `image/png`, ext `png`.
- Cap key `chart_image` already exists in `DAILY_CAPS`.

### 3c. Discriminated union update
`Input` schema is currently a union of mortgage + purchase plan. Extend to 4-way union and update the kind router. No changes to `chip → kind` map in `ConversationalIntelligence.tsx` — already covers `generate_property_report_pdf` and `generate_chart_image`.

### 3d. Deploy + smoke test
- Deploy `generate-artifact` after each renderer is in.
- Curl test each kind end-to-end against a logged-in session; verify file opens, log row increments, signed URL works, `cap_reached` path still returns `{ error: 'daily_cap_reached' }`.

---

## Out of scope (still deferred)
- Console "Saved artifacts" browse/re-download view
- Chrome extension migration to shared signals module
- Free-tier cap recalibration based on real usage data
- Full end-to-end smoke (budget-capped Austin prompt → mismatch → plan → telemetry → upgrade CTA)

## Risk
- Step 1 emits a new SSE event type; the streamClient parser already handles arbitrary events generically (`args.onEvent({ type: event as any, ...data })`), so older clients won't crash on it.
- Step 3b adds a wasm fetch on cold start (~2MB); cache the init promise at module scope so only the first invocation pays the cost.
- pdf-lib has no built-in chart primitives — that's why chart_image goes the SVG+resvg route instead of being a PDF kind.
