## Why nothing is being saved

Verified in the database:
- `saved_analyses` table is empty for your user.
- `save-analysis` edge function has never been invoked.
- Your subscription is correctly `investor` (premium), so the gate isn't the blocker.

Looking at the latest assistant messages stored for you, none start with `MATCH_SCORE: X/10`. The recent URL analysis came back as `"Likely. • Buying power…"` with no score prefix. Because the Save Analysis button in `Chats.tsx` only renders when `message.metadata?.matchScore != null`, the button simply never appeared, so you had nothing to click.

The previous fix made the prefix persist *when* a score existed, but it didn't fix the upstream case where Perplexity returns a property analysis with no `MATCH_SCORE` line at all.

## Fix plan

### 1. Detect "this is a property analysis" independently of MATCH_SCORE

In `src/pages/Chats.tsx`, derive an `isPropertyAnalysis` boolean per assistant message from any of:
- `message.metadata?.matchScore != null`, OR
- a parsed `analyzedProperty` is present in metadata, OR
- the message has an `analysisUrl` (the URL that triggered the analysis) AND the content looks like an analysis (already covered by `parseAnalyzedProperty` heuristic: contains `Property Summary` or `Price:`).

Show the Save Analysis button whenever `isPropertyAnalysis` is true, even if `matchScore` is null. Pass `investmentScore: null` and `scoreLabel: null` in that case.

### 2. Make the persisted format survive reloads

Already mostly in place. Extend `useSavedChats.parseMatchScoreFromContent` to also surface an `analyzedUrl` if the content contains a property URL marker, so the same detector in step 1 works after reload. No DB schema change.

### 3. Verify the save round-trip

After the UI change:
- Trigger a property URL analysis in chat.
- Confirm the Save Analysis button shows.
- Click it and verify a row appears in `saved_analyses` (via DB read) and on the Saved Analyses page.
- Check `save-analysis` edge logs show a `saved` entry.

### 4. Keep the existing match-score retry

Don't remove the one-shot retry in `Chats.tsx` — when it succeeds, the saved row will include the score. When it fails, the row is still created with `investment_score = null`, and the Saved Analyses page already handles `investment_score: null` (shows `—` via `ScoreCircle`).

## Files to change

- `src/pages/Chats.tsx` — relax the Save Analysis button gate; pass nullable score.
- `src/components/chat/SaveAnalysisButton.tsx` — small label tweak only if score is missing (e.g. still "Save Analysis", no other behavior change).
- `src/hooks/useSavedChats.tsx` — no functional change required; optional small comment refresh.

No DB migrations. No edge function changes (`save-analysis` already accepts `investmentScore` as optional/nullable).

## Out of scope

- Forcing Perplexity to always return MATCH_SCORE (separate prompt-engineering work; current retry is the mitigation).
- Auto-save (you confirmed manual-only).
