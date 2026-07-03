/**
 * memory-summarize-session
 *
 * POST { conversationId } — loads recent messages from a conversation,
 * extracts durable memories via Anthropic, persists them, then prunes
 * to the tier cap. Idempotent: marks conversations.last_summarized_at.
 *
 * Callable by:
 *   - the user (authed JWT) for "summarise this thread now"
 *   - the cron sweeper (service-role)
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders } from '../_shared/cors.ts';
import { summarizeConversation, type TranscriptMessage } from '../_shared/memory/extractor.ts';
import { pruneMemories } from '../_shared/memory/prune.ts';
import { resolveMemoryTier } from '../_shared/memory/types.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const BodySchema = z.object({ conversationId: z.string().uuid() });

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: 'invalid_body' }, 400);
  }
  const { conversationId } = parsed.data;

  // Service-role client — we need cross-user read for the cron path, and
  // memory writes use the user's id explicitly anyway.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: convo, error: convoErr } = await admin
    .from('conversations')
    .select('id, user_id, last_summarized_at, updated_at')
    .eq('id', conversationId)
    .maybeSingle();
  if (convoErr || !convo) return json({ error: 'conversation_not_found' }, 404);

  // Optional caller-auth gate: if a JWT is present, verify it matches the
  // conversation owner. The cron path has no JWT and is allowed by
  // verify_jwt=false on the function deploy.
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: who } = await userClient.auth.getUser();
    if (who?.user && who.user.id !== convo.user_id) {
      return json({ error: 'forbidden' }, 403);
    }
  }

  // Skip if we already summarised after the most recent activity.
  if (
    convo.last_summarized_at &&
    new Date(convo.last_summarized_at).getTime() >= new Date(convo.updated_at).getTime()
  ) {
    return json({ ok: true, skipped: 'already_summarized', inserted: 0 });
  }

  const { data: msgs, error: msgErr } = await admin
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(80);
  if (msgErr) return json({ error: msgErr.message }, 500);

  const transcript: TranscriptMessage[] = (msgs ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' }));

  if (transcript.length < 2) {
    await admin
      .from('conversations')
      .update({ last_summarized_at: new Date().toISOString() })
      .eq('id', conversationId);
    return json({ ok: true, skipped: 'too_short', inserted: 0 });
  }

  const candidates = await summarizeConversation(transcript, convo.user_id);

  let inserted = 0;
  if (candidates.length > 0) {
    const rows = candidates.map((c) => ({
      user_id: convo.user_id,
      category: c.category,
      content: c.content,
      importance: c.importance,
      source: 'extracted',
      source_conversation_id: conversationId,
    }));
    const { data: ins, error: insErr } = await admin
      .from('user_memories')
      .insert(rows)
      .select('id');
    if (insErr) console.warn('[memory-summarize-session] insert failed', insErr);
    inserted = ins?.length ?? 0;
  }

  // Look up tier for prune cap.
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, tier')
    .eq('id', convo.user_id)
    .maybeSingle();
  const tier = resolveMemoryTier(
    (profile as any)?.tier ?? (profile as any)?.subscription_status,
  );
  const pruneResult = await pruneMemories(admin, convo.user_id, tier);

  await admin
    .from('conversations')
    .update({ last_summarized_at: new Date().toISOString() })
    .eq('id', conversationId);

  return json({ ok: true, inserted, ...pruneResult });
})(req)));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}