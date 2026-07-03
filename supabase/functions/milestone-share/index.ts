/**
 * milestone-share
 *
 * POST { id } — generates a 1080×1080 share image for the milestone,
 * uploads it to the `artifacts` bucket, marks the milestone as shared,
 * and returns a 5-minute signed URL plus pre-filled tweet text.
 *
 * Falls back to returning the raw SVG (status: 'svg') if resvg-wasm
 * rasterization fails.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { z } from 'https://esm.sh/zod@3.23.8';
import { renderPng, buildSvg } from '../_shared/milestones/renderShareImage.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const BodySchema = z.object({ id: z.string().uuid() });

function tweetText(headline: string): string {
  return `${headline} — tracking with HomeLens 🏡 homelensais.com`;
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid_body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth-scoped client (RLS verifies ownership on read/update)
  const authed = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: milestone, error: mErr } = await authed
    .from('delivered_milestones')
    .select('id, user_id, headline, context, category')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (mErr || !milestone) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Service-role client for storage write (artifacts bucket is private)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const objectPath = `milestones/${milestone.user_id}/${milestone.id}.png`;
  let format: 'png' | 'svg' = 'png';
  try {
    const png = await renderPng({
      headline: milestone.headline,
      context: milestone.context,
      eyebrow: milestone.category === 'streak' ? 'Streak' : 'Milestone',
    });
    const { error: upErr } = await admin.storage
      .from('artifacts')
      .upload(objectPath, png, { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;
  } catch (err) {
    console.error('[milestone-share] png failed, falling back to svg', err);
    format = 'svg';
    const svg = buildSvg({
      headline: milestone.headline,
      context: milestone.context,
      eyebrow: milestone.category === 'streak' ? 'Streak' : 'Milestone',
    });
    const svgPath = `milestones/${milestone.user_id}/${milestone.id}.svg`;
    const { error: upErr } = await admin.storage
      .from('artifacts')
      .upload(svgPath, new TextEncoder().encode(svg), {
        contentType: 'image/svg+xml',
        upsert: true,
      });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const finalPath =
    format === 'png'
      ? objectPath
      : `milestones/${milestone.user_id}/${milestone.id}.svg`;
  const { data: signed, error: signErr } = await admin.storage
    .from('artifacts')
    .createSignedUrl(finalPath, 300);
  if (signErr || !signed) {
    return new Response(JSON.stringify({ error: signErr?.message ?? 'sign_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await authed
    .from('delivered_milestones')
    .update({ shared_at: new Date().toISOString() })
    .eq('id', milestone.id);

  return new Response(
    JSON.stringify({
      url: signed.signedUrl,
      format,
      tweetText: tweetText(milestone.headline),
      expiresInSeconds: 300,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
})(req)));