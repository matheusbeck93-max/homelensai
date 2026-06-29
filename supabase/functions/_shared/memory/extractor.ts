/**
 * Session memory extractor — turns a chat transcript into 0-5 durable memories.
 * Uses Anthropic directly (Sonnet) so it doesn't touch the per-surface router
 * budget pools used by user-facing chat.
 */

import { completeWithFallback } from '../ai/router.ts';
import type { ExtractedMemoryCandidate, MemoryCategory } from './types.ts';

const SYSTEM_PROMPT = `You extract durable, useful long-term memories about a real-estate user from a chat transcript.

ONLY extract things that will still be true and useful in 3+ months. Examples of GOOD memories:
- "Wants to relocate to Charlotte NC within 12 months"
- "Cannot tolerate HOA fees above $300/mo"
- "Owns a rental in Atlanta, considers self a buy-and-hold investor"
- "Has a 7-year-old child, schools are a deal-breaker"
- "Prefers concise answers with bullets, not long prose"

DO NOT extract:
- Anything ephemeral (today's mortgage rate, a specific listing they viewed)
- Restatements of system facts already on the profile (their email, their tier)
- Anything the user contradicted later in the same conversation
- Generic small talk
- Anything you are guessing about — only what was clearly stated

Importance scale (1-5):
- 5: hard deal-breaker, life goal, financial constraint
- 4: strong stable preference (location, strategy)
- 3: clear preference that may evolve
- 2: helpful background context
- 1: minor stylistic preference

Categories: preference | goal | constraint | context | fact | behavior.

Return STRICT JSON only, no prose. Shape:
{"memories":[{"category":"...","content":"...","importance":3}, ...]}

Return at most 5 memories. Return {"memories":[]} if nothing qualifies.`;

const VALID_CATEGORIES: MemoryCategory[] = [
  'preference',
  'goal',
  'constraint',
  'context',
  'fact',
  'behavior',
];

export interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function buildTranscript(messages: TranscriptMessage[]): string {
  return messages
    .filter((m) => m.role !== 'system' && (m.content ?? '').trim().length > 0)
    .slice(-40) // cap at most recent 40 turns
    .map((m) => `[${m.role.toUpperCase()}] ${m.content.trim().slice(0, 2000)}`)
    .join('\n\n');
}

export async function summarizeConversation(
  messages: TranscriptMessage[],
  _userId: string,
): Promise<ExtractedMemoryCandidate[]> {
  const transcript = buildTranscript(messages);
  if (transcript.length < 40) return []; // nothing worth extracting

  let raw: string;
  try {
    const result = await completeWithFallback('memory_categorization', {
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Transcript:\n\n${transcript}` },
      ],
      maxTokens: 800,
      temperature: 0.1,
      responseFormat: 'json',
    }, { userId: _userId, tier: 'buyer' });
    raw = result.text ?? '';
  } catch (err) {
    console.warn('[memory.extractor] anthropic call failed', err);
    return [];
  }

  const json = extractJson(raw);
  if (!json) return [];

  try {
    const parsed = JSON.parse(json);
    const list = Array.isArray(parsed?.memories) ? parsed.memories : [];
    const out: ExtractedMemoryCandidate[] = [];
    for (const item of list.slice(0, 5)) {
      const content = String(item?.content ?? '').trim();
      const category = String(item?.category ?? '').trim().toLowerCase() as MemoryCategory;
      const importance = Math.max(1, Math.min(5, Math.round(Number(item?.importance ?? 3))));
      if (!content || content.length > 400) continue;
      if (!VALID_CATEGORIES.includes(category)) continue;
      out.push({ content, category, importance });
    }
    return out;
  } catch (err) {
    console.warn('[memory.extractor] JSON parse failed', err);
    return [];
  }
}

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence) return fence[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}