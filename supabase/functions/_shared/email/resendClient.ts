/**
 * Thin fetch wrapper around the Resend HTTP API.
 * Uses the RESEND_API_KEY secret. Returns the provider message id on success.
 */

export interface ResendSendInput {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface ResendSendResult {
  messageId: string;
}

export class ResendError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Resend error ${status}`);
    this.name = 'ResendError';
    this.status = status;
    this.body = body;
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendViaResend(input: ResendSendInput): Promise<ResendSendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new ResendError(0, null, 'RESEND_API_KEY is not configured');
  }

  const payload: Record<string, unknown> = {
    from: input.from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
  };
  if (input.html) payload.html = input.html;
  if (input.text) payload.text = input.text;
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.headers) payload.headers = input.headers;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // body may be empty on some errors
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Resend send failed (HTTP ${res.status})`;
    throw new ResendError(res.status, body, message);
  }

  const id =
    body && typeof body === 'object' && 'id' in body
      ? String((body as { id: unknown }).id)
      : '';
  if (!id) {
    throw new ResendError(res.status, body, 'Resend response missing message id');
  }
  return { messageId: id };
}