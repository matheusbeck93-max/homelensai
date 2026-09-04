/**
 * WATCH GOALS EVALUATOR (Agentic v1, step 1)
 * ==========================================
 * Cron job: Watch → Score → Notify. Never acts on the user's behalf.
 *
 *  1. Read enabled Watch Goals (`saved_searches` rows with alert_enabled)
 *     whose cadence window has elapsed.
 *  2. Pull REAL live listings via `search-listings` (the only listing source).
 *  3. Deterministic prefilter (price / beds / baths / already-notified) so we
 *     never spend AI budget on obvious misses.
 *  4. Score the top N survivors with the shared Match Score contract through
 *     the AI router (surface `alerts_engine`, budget guard active).
 *  5. Matches at or above the goal's threshold → `alert_events` row, plus one
 *     grouped email digest when the goal opts into email.
 *  6. Stamp `last_alert_sent`.
 *
 * Auth: `x-cron-secret` header (scheduled) OR a user JWT (on-demand run for
 * that user's own goals only). Supports `{ "dry_run": true }` — evaluates and
 * scores but writes nothing and stamps nothing.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { withCronLog } from '../_shared/cron-log.ts';
import { withRequestOrigin } from '../_shared/ai/requestContext.ts';
import { completeWithFallback } from '../_shared/ai/router.ts';
import type { Tier } from '../_shared/ai/types.ts';
import { sendTransactional } from '../_shared/email/sender.ts';
import {
  buildMatchScoreInstructions,
  buildMatchScoreProfileBlock,
  matchScoreToolRouterShape,
  parseMatchScoreToolCalls,
  parseMatchScoreFromText,
  type StructuredMatchScore,
} from '../_shared/matchScore.ts';
import {
  parseWatchGoal,
  isGoalDue,
  prefilterListings,
  describeListing,
  type CandidateListing,
  type WatchGoal,
} from '../_shared/watchGoals.ts';

const log = createLogger('watch-goals-evaluate');

/** Max listings scored per goal per run — hard cap on AI spend. */
const MAX_SCORED_PER_GOAL = 5;
/** Max goals processed per run. */
const MAX_GOALS_PER_RUN = 50;

function tierOf(status?: string | null): Tier {
  if (status === 'investor' || status === 'premium') return 'investor';
  if (status === 'buyer' || status === 'paid') return 'buyer';
  return 'free';
}

function listingUrlOf(l: CandidateListing): string | undefined {
  const u = (l.externalUrl ?? l.url ?? l.detailUrl) as string | undefined;
  return typeof u === 'string' && u.startsWith('http') ? u : undefined;
}

async function scoreListing(opts: {
  listing: CandidateListing;
  profileBlock: string;
  userId: string;
  tier: Tier;
}): Promise<{ score: StructuredMatchScore | null; costUsd: number }> {
  const { listing, profileBlock, userId, tier } = opts;
  try {
    const result = await completeWithFallback(
      'alerts_engine',
      {
        system: buildMatchScoreInstructions(profileBlock),
        messages: [
          {
            role: 'user',
            content:
              `Score this US listing against the buyer profile above and submit the score.\n\n${describeListing(listing)}`,
          },
        ],
        tools: matchScoreToolRouterShape(),
        toolChoice: 'required',
        maxTokens: 300,
      } as any,
      { userId, tier },
    );
    const score =
      parseMatchScoreToolCalls(result.toolCalls) ?? parseMatchScoreFromText(result.text ?? '');
    return { score, costUsd: result.usage?.costUsd ?? 0 };
  } catch (e) {
    log.warn('scoring failed', { error: getErrorMessage(e) });
    return { score: null, costUsd: 0 };
  }
}

Deno.serve((req: Request) =>
  withRequestOrigin(req, () =>
    withCronLog('watch-goals-evaluate', async (req) => {
      const preflight = handleCors(req);
      if (preflight) return preflight;

      if (Deno.env.get('PRELAUNCH_PAUSE_BACKGROUND_JOBS') === 'true') {
        return jsonResponse({ paused: true, message: 'Pre-launch background jobs paused' }, 200, req);
      }

      // Cron header OR per-user JWT (on-demand "run my goals now").
      const hasCron = req.headers.get('x-cron-secret');
      let scopedUserId: string | null = null;

      if (hasCron) {
        const cronCheck = requireCronAuth(req);
        if (cronCheck) return cronCheck;
      } else {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return errorResponse('Unauthorized', 401, req);
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return errorResponse('Unauthorized', 401, req);
        scopedUserId = user.id;
      }

      let dryRun = false;
      let force = false;
      try {
        const body = await req.json();
        dryRun = body?.dry_run === true;
        force = body?.force === true; // ignore cadence window (dry runs / manual)
      } catch {
        // no body — scheduled run
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      try {
        let q = supabase
          .from('saved_searches')
          .select('id, user_id, query_text, filters_json, alert_enabled, alert_frequency, last_alert_sent')
          .eq('alert_enabled', true)
          .limit(MAX_GOALS_PER_RUN);
        if (scopedUserId) q = q.eq('user_id', scopedUserId);

        const { data: rows, error } = await q;
        if (error) throw error;

        const goals: WatchGoal[] = (rows ?? [])
          .map(parseWatchGoal)
          .filter((g): g is WatchGoal => g !== null)
          .filter((g) => force || isGoalDue(g));

        let totalMatches = 0;
        let totalScored = 0;
        let aiCostUsd = 0;
        const perGoal: Array<Record<string, unknown>> = [];

        for (const goal of goals) {
          // --- profile + tier -------------------------------------------------
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', goal.userId)
            .maybeSingle();
          if (!profile) continue;
          const tier = tierOf((profile as any).subscription_status);
          const profileBlock = buildMatchScoreProfileBlock(profile);

          // --- live listings ---------------------------------------------------
          let listings: CandidateListing[] = [];
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/search-listings`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({
                query: goal.search.location,
                location: goal.search.location,
                ...(goal.search.price_min ? { price_min: goal.search.price_min } : {}),
                ...(goal.search.price_max ? { price_max: goal.search.price_max } : {}),
                ...(goal.search.beds_min ? { beds_min: goal.search.beds_min } : {}),
                ...(goal.search.baths_min ? { baths_min: goal.search.baths_min } : {}),
                ...(goal.search.prop_type && goal.search.prop_type !== 'any'
                  ? { prop_type: goal.search.prop_type }
                  : {}),
              }),
            });
            const payload = await res.json();
            listings = Array.isArray(payload?.listings) ? payload.listings : [];
          } catch (e) {
            log.error('search-listings failed', { goalId: goal.id, error: getErrorMessage(e) });
          }

          if (listings.length === 0) {
            perGoal.push({ goalId: goal.id, listings: 0, scored: 0, matches: 0, note: 'no live listings' });
            if (!dryRun) {
              await supabase
                .from('saved_searches')
                .update({ last_alert_sent: new Date().toISOString() })
                .eq('id', goal.id);
            }
            continue;
          }

          // --- dedupe against what we already told this user about --------------
          const { data: priorEvents } = await supabase
            .from('alert_events')
            .select('property_id')
            .eq('user_id', goal.userId)
            .eq('type', 'watch_goal_match')
            .limit(500);
          const alreadyNotified = new Set(
            (priorEvents ?? []).map((e: any) => String(e.property_id)),
          );

          // --- deterministic prefilter -----------------------------------------
          const candidates = prefilterListings(
            listings,
            goal,
            alreadyNotified,
            MAX_SCORED_PER_GOAL,
          );

          // --- score ------------------------------------------------------------
          const matches: Array<{ listing: CandidateListing; score: StructuredMatchScore }> = [];
          for (const listing of candidates) {
            const { score, costUsd } = await scoreListing({
              listing,
              profileBlock,
              userId: goal.userId,
              tier,
            });
            totalScored++;
            aiCostUsd += costUsd;
            if (score && score.score >= goal.matchThreshold) {
              matches.push({ listing, score });
            }
          }
          totalMatches += matches.length;

          perGoal.push({
            goalId: goal.id,
            label: goal.label,
            threshold: goal.matchThreshold,
            listings: listings.length,
            candidates: candidates.length,
            scored: candidates.length,
            matches: matches.map((m) => ({
              id: m.listing.id,
              address: m.listing.address,
              price: m.listing.price,
              score: m.score.score,
              rationale: m.score.rationale,
            })),
          });

          if (dryRun) continue;

          // --- notify: in-app ----------------------------------------------------
          if (matches.length > 0) {
            const events = matches.map((m) => ({
              user_id: goal.userId,
              type: 'watch_goal_match',
              property_id: String(m.listing.id),
              message: `Match ${m.score.score}/10 for "${goal.label}" — ${m.listing.address ?? 'listing'}${
                m.listing.price ? ` at $${Number(m.listing.price).toLocaleString('en-US')}` : ''
              }. ${m.score.rationale}`,
              property_snapshot: {
                goal_id: goal.id,
                goal_kind: goal.goalKind,
                match_score: m.score.score,
                rationale: m.score.rationale,
                score_source: m.score.source,
                address: m.listing.address ?? null,
                city: m.listing.city ?? null,
                state: m.listing.state ?? null,
                price: m.listing.price ?? null,
                bedrooms: m.listing.bedrooms ?? null,
                bathrooms: m.listing.bathrooms ?? null,
                image_url: m.listing.imageUrl ?? null,
                listing_url: listingUrlOf(m.listing) ?? null,
              },
              read: false,
            }));
            const { error: insErr } = await supabase.from('alert_events').insert(events);
            if (insErr) log.error('alert_events insert failed', { error: insErr.message });
          }

          // --- notify: email digest ----------------------------------------------
          if (matches.length > 0 && (goal.notify === 'email' || goal.notify === 'both')) {
            try {
              await sendTransactional({
                userId: goal.userId,
                template: 'watch-goal-digest',
                idempotencyKey: `watch-goal-${goal.id}-${new Date().toISOString().slice(0, 10)}`,
                templateData: {
                  goalLabel: goal.label,
                  matchThreshold: goal.matchThreshold,
                  matches: matches.map((m) => ({
                    address: m.listing.address ?? 'Listing',
                    cityState: [m.listing.city, m.listing.state].filter(Boolean).join(', '),
                    price: Number(m.listing.price ?? 0),
                    beds: m.listing.bedrooms,
                    baths: m.listing.bathrooms,
                    score: m.score.score,
                    rationale: m.score.rationale,
                    listingUrl: listingUrlOf(m.listing),
                    photo: m.listing.imageUrl ?? null,
                  })),
                },
                metadata: { goal_id: goal.id, source: 'watch-goals-evaluate' },
              });
            } catch (e) {
              log.error('digest email failed', { goalId: goal.id, error: getErrorMessage(e) });
            }
          }

          // --- stamp --------------------------------------------------------------
          await supabase
            .from('saved_searches')
            .update({ last_alert_sent: new Date().toISOString() })
            .eq('id', goal.id);
        }

        return jsonResponse(
          {
            ok: true,
            dry_run: dryRun,
            goals_considered: rows?.length ?? 0,
            goals_evaluated: goals.length,
            listings_scored: totalScored,
            matches: totalMatches,
            ai_cost_usd: Number(aiCostUsd.toFixed(4)),
            details: perGoal,
          },
          200,
          req,
        );
      } catch (e) {
        log.error('watch goals evaluation failed', { error: getErrorMessage(e) });
        return errorResponse(getErrorMessage(e), 500, req);
      }
    })(req),
  ),
);
