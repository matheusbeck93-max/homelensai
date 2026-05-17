/**
 * Shared conversation history sanitizer.
 *
 * Both `perplexity-chat` and `ai-chat` previously had divergent rules for
 * trimming, deduping, and (for Perplexity) enforcing strict user/assistant
 * alternation. This module centralizes that logic so token usage and
 * provider compatibility stay consistent across backends.
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatTurn {
  role: ChatRole | string;
  content: string;
}

export interface SanitizeOptions {
  /** Keep only the last N turns. Default: 10. */
  maxTurns?: number;
  /**
   * If true, enforce strict user/assistant alternation starting with `user`
   * (required by the Perplexity API).
   * If false, just dedupe consecutive same-role turns (Gemini is permissive).
   * Default: true.
   */
  enforceAlternation?: boolean;
}

/**
 * Sanitize a raw conversation history for safe dispatch to an LLM:
 *  1. Drop messages with empty content.
 *  2. Keep only the last `maxTurns`.
 *  3. Merge consecutive same-role turns.
 *  4. (optional) Drop leading assistant turns so the history starts with `user`.
 */
export function sanitizeHistory(
  messages: ChatTurn[] | undefined | null,
  opts: SanitizeOptions = {},
): { role: 'user' | 'assistant'; content: string }[] {
  const { maxTurns = 10, enforceAlternation = true } = opts;
  if (!messages || messages.length === 0) return [];

  // Step 1: normalize + filter empty + only user/assistant roles
  const normalized = messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Step 2: keep last N
  const trimmed = normalized.slice(-maxTurns);

  // Step 3: merge consecutive same-role
  const deduped: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of trimmed) {
    const last = deduped[deduped.length - 1];
    if (last && last.role === m.role) {
      deduped[deduped.length - 1] = {
        role: m.role,
        content: last.content + '\n\n' + m.content,
      };
    } else {
      deduped.push(m);
    }
  }

  if (!enforceAlternation) return deduped;

  // Step 4: strip leading assistant messages (Perplexity must start with user)
  while (deduped.length && deduped[0].role !== 'user') deduped.shift();
  return deduped;
}
