/**
 * Rank the follow-up registry against a conversation context and return
 * the top N topics that should be shown as chips this turn.
 *
 * Scoring: `trigger(ctx) * 0.65 + personaWeight(topic) * 0.35`. Persona is
 * a prior, conversation signals dominate (~65/35) per product decision #7.
 *
 * Filters: suppression (cooldown + dismissal), active cascade, threshold.
 */

import {
  FOLLOWUP_REGISTRY,
  personaWeight,
} from "./followupRegistry";
import { isCascadeActive, isSuppressed } from "./followupDismissals";
import type { ConversationalContext, FollowupTopic } from "./types";

export interface RankedTopic {
  topic: FollowupTopic;
  score: number;
}

export interface RankOptions {
  /** Min score; default 0.3. Extension uses 0.4. */
  threshold?: number;
  /** Max chips to return; default 3. Extension uses 2. */
  max?: number;
  /** Ignore cooldown/suppression. Used in tests. */
  ignoreSuppression?: boolean;
}

export function rankFollowups(
  ctx: ConversationalContext,
  opts: RankOptions = {},
): FollowupTopic[] {
  const threshold = opts.threshold ?? 0.3;
  const max = opts.max ?? 3;

  // While the user is mid-cascade, do not propose new topics.
  if (!opts.ignoreSuppression && isCascadeActive()) return [];

  const ranked: RankedTopic[] = [];
  for (const topic of FOLLOWUP_REGISTRY) {
    let trig = 0;
    try {
      trig = topic.trigger(ctx);
    } catch {
      trig = 0;
    }
    if (trig <= 0) continue;

    const pw = personaWeight(topic, ctx);
    const score = trig * 0.65 + pw * 0.35 * (trig > 0 ? 1 : 0);
    if (score < threshold) continue;

    if (!opts.ignoreSuppression && isSuppressed(topic.id, topic.cooldown_minutes)) {
      continue;
    }
    ranked.push({ topic, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, max).map((r) => r.topic);
}