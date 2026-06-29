### Phase 6: Operational Activation & Verification

All code architecture changes (PR #1 through PR #5) and database schema migrations have landed and passed 100% of unit tests. To finalize the AI Cost Optimization rollout, we will execute the operational activation steps:

#### 1. Activate Pre-launch Cron Pause Guard
- **Action**: Set `PRELAUNCH_PAUSE_BACKGROUND_JOBS=true` via Lovable Cloud environment secrets.
- **Impact**: Immediately pauses the daily `send-weekly-picks` and 10-minute `memory-session-sweeper` crons in production (dropping background non-user LLM burn to zero) while keeping essential FRED and BLS macro prefetches active.

#### 2. Verify Live Telemetry at `/admin/ai-spend`
- **Action**: Confirm telemetry logging on the live staff dashboard (`/admin/ai-spend`).
- **Verification checkpoints**:
  - Spend isolation confirms dev/preview runs (`is_dev_call = true`) do not debit production credit allowances.
  - Model breakdown verifies lightweight operations (photo categorization, intent, chip ranking) route cleanly to `claude-haiku-4-5`.
  - Monthly USD cap enforcement ($1 Free / $10 Buyer / $25 Investor) and feature quotas accurately gate turn admission.

#### 3. 24h Sign-off & Burn Confirmation
- **Action**: Monitor the Anthropic Console billing dashboard over the next 24 hours to confirm direct SDK charges drop to near-zero now that all memory extraction and fallback paths route through the unified gateway pipeline.