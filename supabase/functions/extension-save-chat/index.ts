import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getSupabaseEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('extension-save-chat');

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(20000),
});

const BodySchema = z.object({
  thread_id_client: z.string().min(1).max(120),
  title: z.string().max(200).optional().nullable(),
  messages: z.array(MessageSchema).min(1).max(200),
  property_context: z.object({
    listing_url: z.string().url().optional().nullable(),
  }).optional().nullable(),
});

function deriveTitle(input: { title?: string | null; messages: { role: string; content: string }[] }): string {
  if (input.title && input.title.trim()) return input.title.trim().slice(0, 80);
  const firstUser = input.messages.find((m) => m.role === 'user');
  const base = firstUser?.content?.trim() || 'Extension chat';
  return base.length > 60 ? base.slice(0, 57) + '...' : base;
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const t0 = Date.now();
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { thread_id_client, title, messages, property_context } = parsed.data;
    const propertyUrl = property_context?.listing_url ?? null;

    const { url, serviceRoleKey } = getSupabaseEnv();
    const supabase = createClient(url, serviceRoleKey);

    // Find or create the conversation.
    let threadId: string;
    let isNew = false;
    const { data: existing } = await supabase
      .from('conversations')
      .select('id, property_url')
      .eq('user_id', user.id)
      .eq('client_thread_id', thread_id_client)
      .maybeSingle();

    if (existing) {
      threadId = existing.id;
      // Backfill property_url if it was null and we now have one.
      if (!existing.property_url && propertyUrl) {
        await supabase
          .from('conversations')
          .update({ property_url: propertyUrl })
          .eq('id', threadId);
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: deriveTitle({ title, messages }),
          source: 'chrome_extension',
          client_thread_id: thread_id_client,
          property_url: propertyUrl,
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      threadId = created.id;
      isNew = true;
    }

    // Idempotent append: count existing messages, insert only the tail.
    const { count: existingCount, error: countErr } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', threadId);
    if (countErr) throw countErr;

    const startAt = existingCount ?? 0;
    const toInsert = messages.slice(startAt).map((m) => ({
      conversation_id: threadId,
      role: m.role,
      content: m.content,
    }));

    if (toInsert.length > 0) {
      const { error: msgErr } = await supabase.from('messages').insert(toInsert);
      if (msgErr) throw msgErr;
      // Bump updated_at so the thread sorts to the top in /chats.
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
    }

    const body = {
      thread_id: threadId,
      is_new: isNew,
      appended: toInsert.length,
      view_url: `/chats?c=${threadId}`,
    };
    log.info('saved', {
      user_id: user.id,
      is_new: isNew,
      appended: toInsert.length,
      latency_ms: Date.now() - t0,
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    log.error('failed', { error: err?.message });
    return new Response(
      JSON.stringify({ error: 'internal_error', message: err?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});