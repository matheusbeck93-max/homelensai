import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';

const log = createLogger('save-analysis');

const BodySchema = z.object({
  propertyUrl: z.string().url().max(2000).optional().nullable(),
  propertyAddress: z.string().max(500).optional().nullable(),
  propertyPrice: z.number().nonnegative().optional().nullable(),
  analysisSummary: z.string().min(1).max(50000),
  investmentScore: z.number().int().min(0).max(100).optional().nullable(),
  scoreLabel: z.string().max(100).optional().nullable(),
  keyMetrics: z.record(z.any()).optional().nullable(),
  source: z.enum(['app', 'extension']).default('app'),
});

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Missing authorization header', 401);
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse('Unauthorized', 401);
    }
    const user = userData.user;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return validationError('Invalid request body', parsed.error.flatten().fieldErrors);
    }
    const body = parsed.data;

    // Premium gate
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      log.step('profile lookup error', { error: profileError.message });
      return errorResponse('Failed to verify subscription', 500);
    }
    if (profile?.subscription_status !== 'premium') {
      return new Response(
        JSON.stringify({ error: 'premium_required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...(await import('../_shared/cors.ts')).corsHeaders } },
      );
    }

    // Duplicate check (by URL)
    if (body.propertyUrl) {
      const { data: existing } = await supabase
        .from('saved_analyses')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_url', body.propertyUrl)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'already_saved', id: existing.id }),
          { status: 409, headers: { 'Content-Type': 'application/json', ...(await import('../_shared/cors.ts')).corsHeaders } },
        );
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('saved_analyses')
      .insert({
        user_id: user.id,
        property_url: body.propertyUrl ?? null,
        property_address: body.propertyAddress ?? null,
        property_price: body.propertyPrice ?? null,
        analysis_summary: body.analysisSummary,
        investment_score: body.investmentScore ?? null,
        score_label: body.scoreLabel ?? null,
        key_metrics: body.keyMetrics ?? null,
        source: body.source,
      })
      .select('id')
      .single();

    if (insertError) {
      log.step('insert error', { error: insertError.message });
      return errorResponse('Failed to save analysis', 500);
    }

    log.step('saved', { userId: user.id, id: inserted.id, source: body.source });
    return jsonResponse({ success: true, id: inserted.id }, 201);
  } catch (err) {
    log.step('ERROR', { message: getErrorMessage(err) });
    return errorResponse(getErrorMessage(err));
  }
});