/**
 * Transactional email sender for HomeLens.
 *
 * Responsibilities:
 *   1. Look up the recipient's profile email + preferences.
 *   2. Skip when the user has unsubscribed, disabled all emails, or disabled
 *      the feature flag matching the template.
 *   3. Skip when the recipient is in the suppression list.
 *   4. Write a `pending` row to `email_send_log` (idempotency-keyed).
 *   5. Render the template via the registry, call Resend.
 *   6. Update the row to `sent` or `failed`.
 *
 * Re-calling with the same `(userId, template, idempotencyKey)` returns the
 * existing log row instead of re-sending.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendViaResend, ResendError } from './resendClient.ts';
import {
  TEMPLATES,
  type TemplateName,
  type TemplateRenderResult,
} from './templates/registry.ts';
import { buildUnsubscribeUrl, ensureUnsubscribeToken } from './unsubscribe.ts';

export const SENDER_FROM = Deno.env.get('EMAIL_SENDER_FROM') ?? 'HomeLens <hello@homelensais.com>';

export interface SendTransactionalInput<T extends TemplateName = TemplateName> {
  userId: string;
  template: T;
  templateData: Parameters<(typeof TEMPLATES)[T]['render']>[0];
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  recipientEmailOverride?: string; // for tests / re-sends
}

export type SendOutcome =
  | { status: 'sent'; messageId: string; logId: string }
  | { status: 'skipped'; reason: string; logId: string }
  | { status: 'duplicate'; logId: string }
  | { status: 'failed'; error: string; logId: string };

function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function sendTransactional<T extends TemplateName>(
  input: SendTransactionalInput<T>,
): Promise<SendOutcome> {
  const supabase = adminClient();
  const def = TEMPLATES[input.template];
  if (!def) {
    return { status: 'failed', error: `Unknown template ${input.template}`, logId: '' };
  }

  // 1. Idempotency: short-circuit if we already have a row for this key.
  const { data: existing } = await supabase
    .from('email_send_log')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('template', input.template)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing && (existing.status === 'sent' || existing.status === 'pending')) {
    return { status: 'duplicate', logId: existing.id as string };
  }

  // 2. Resolve recipient + preferences.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', input.userId)
    .maybeSingle();

  const recipient = input.recipientEmailOverride ?? (profile?.email as string | undefined);
  if (!recipient) {
    const log = await insertLog(supabase, input, 'failed', null, 'no recipient email');
    return { status: 'failed', error: 'no recipient email', logId: log.id };
  }

  const { data: prefs } = await supabase
    .from('email_preferences')
    .select('*')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (prefs?.unsubscribed_at) {
    const log = await insertLog(supabase, input, 'skipped_prefs', recipient, 'user unsubscribed');
    return { status: 'skipped', reason: 'unsubscribed', logId: log.id };
  }
  if (prefs && prefs.enabled === false) {
    const log = await insertLog(supabase, input, 'skipped_prefs', recipient, 'all emails disabled');
    return { status: 'skipped', reason: 'all_disabled', logId: log.id };
  }
  if (def.featureFlag && prefs && (prefs as Record<string, unknown>)[def.featureFlag] === false) {
    const log = await insertLog(supabase, input, 'skipped_prefs', recipient, `${def.featureFlag} disabled`);
    return { status: 'skipped', reason: def.featureFlag, logId: log.id };
  }

  // 3. Suppression check.
  const { data: suppressed } = await supabase
    .from('email_suppression')
    .select('email')
    .eq('email', recipient.toLowerCase())
    .maybeSingle();
  if (suppressed) {
    const log = await insertLog(supabase, input, 'suppressed', recipient, 'recipient suppressed');
    return { status: 'skipped', reason: 'suppressed', logId: log.id };
  }

  // 4. Insert pending log row.
  const pending = await insertLog(supabase, input, 'pending', recipient, null);

  // 5. Render + send.
  const unsubToken = await ensureUnsubscribeToken(supabase, input.userId);
  const unsubscribeUrl = buildUnsubscribeUrl(unsubToken);
  let rendered: TemplateRenderResult;
  try {
    rendered = await def.render(input.templateData, {
      recipientEmail: recipient,
      recipientName: (profile?.full_name as string | undefined) ?? null,
      unsubscribeUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateLog(supabase, pending.id, { status: 'failed', error_message: `render: ${msg}` });
    return { status: 'failed', error: msg, logId: pending.id };
  }

  try {
    const result = await sendViaResend({
      from: SENDER_FROM,
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    await updateLog(supabase, pending.id, { status: 'sent', message_id: result.messageId });
    return { status: 'sent', messageId: result.messageId, logId: pending.id };
  } catch (err) {
    const msg =
      err instanceof ResendError ? `${err.status}: ${err.message}` :
      err instanceof Error ? err.message : String(err);
    await updateLog(supabase, pending.id, { status: 'failed', error_message: msg });
    return { status: 'failed', error: msg, logId: pending.id };
  }
}

async function insertLog(
  supabase: SupabaseClient,
  input: SendTransactionalInput,
  status: string,
  recipient: string | null,
  errorMessage: string | null,
) {
  const row = {
    user_id: input.userId,
    template: input.template,
    recipient_email: recipient ?? '',
    idempotency_key: input.idempotencyKey,
    status,
    error_message: errorMessage,
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('email_send_log')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    // Even if logging fails (e.g. duplicate idempotency on race), surface a
    // synthetic id so callers can return.
    return { id: 'log-write-failed' };
  }
  return data as { id: string };
}

async function updateLog(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  if (!id || id === 'log-write-failed') return;
  await supabase.from('email_send_log').update(patch).eq('id', id);
}