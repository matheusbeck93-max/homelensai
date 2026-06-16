/**
 * Per-user, per-topic dismissal + cooldown tracker (localStorage).
 *
 * - Default cooldown: 30 min after last show.
 * - After 3 dismissals, suppress topic for 7 days.
 * - Active cascade flag is also stored here to suppress unrelated chips.
 */

const KEY = "hl_followup_state_v1";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

export interface TopicState {
  dismissCount: number;
  lastShownAt?: number;
  lastDismissedAt?: number;
  lastClickedAt?: number;
}

export interface FollowupState {
  topics: Record<string, TopicState>;
  activeCascade?: { topicId: string; startedAt: number } | null;
}

function safeRead(): FollowupState {
  if (typeof window === "undefined") return { topics: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { topics: {} };
    const parsed = JSON.parse(raw) as FollowupState;
    return { topics: parsed.topics ?? {}, activeCascade: parsed.activeCascade ?? null };
  } catch {
    return { topics: {} };
  }
}

function safeWrite(state: FollowupState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function getTopicState(topicId: string): TopicState {
  const s = safeRead();
  return s.topics[topicId] ?? { dismissCount: 0 };
}

export function markShown(topicId: string) {
  const s = safeRead();
  const t = s.topics[topicId] ?? { dismissCount: 0 };
  t.lastShownAt = Date.now();
  s.topics[topicId] = t;
  safeWrite(s);
}

export function markClicked(topicId: string) {
  const s = safeRead();
  const t = s.topics[topicId] ?? { dismissCount: 0 };
  t.lastClickedAt = Date.now();
  // Reset dismiss count on click — user is engaged.
  t.dismissCount = 0;
  s.topics[topicId] = t;
  safeWrite(s);
}

export function markDismissed(topicId: string) {
  const s = safeRead();
  const t = s.topics[topicId] ?? { dismissCount: 0 };
  t.dismissCount += 1;
  t.lastDismissedAt = Date.now();
  s.topics[topicId] = t;
  safeWrite(s);
}

/**
 * Is the topic currently suppressed by cooldown or repeated dismissals?
 */
export function isSuppressed(topicId: string, cooldownMinutes = 30): boolean {
  const t = getTopicState(topicId);
  const cooldownMs = cooldownMinutes * 60 * 1000 || DEFAULT_COOLDOWN_MS;
  const now = Date.now();

  // 3+ dismissals → 7-day suppression from the last dismissal.
  if (t.dismissCount >= 3 && t.lastDismissedAt && now - t.lastDismissedAt < SEVEN_DAYS_MS) {
    return true;
  }
  // Cooldown from last show.
  if (t.lastShownAt && now - t.lastShownAt < cooldownMs) {
    return true;
  }
  return false;
}

/* --------------------------- Cascade tracking --------------------------- */

const CASCADE_TIMEOUT_MS = 10 * 60 * 1000; // auto-clear stale cascade after 10 min

export function startCascade(topicId: string) {
  const s = safeRead();
  s.activeCascade = { topicId, startedAt: Date.now() };
  safeWrite(s);
}

export function endCascade() {
  const s = safeRead();
  s.activeCascade = null;
  safeWrite(s);
}

export function getActiveCascade(): { topicId: string; startedAt: number } | null {
  const s = safeRead();
  const c = s.activeCascade;
  if (!c) return null;
  if (Date.now() - c.startedAt > CASCADE_TIMEOUT_MS) {
    endCascade();
    return null;
  }
  return c;
}

export function isCascadeActive(): boolean {
  return getActiveCascade() !== null;
}