/**
 * Thin fetch wrappers for the `extension-followups` edge function.
 * Mirrors the style of `saveActions.ts` — caller passes the auth header.
 */

const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

import type { UpdatePayload, DismissalRow, Preferences } from './detectMismatches';

export interface FollowupSettings {
  extension_smart_suggestions_enabled: boolean;
}

export interface FollowupState {
  preferences: Preferences & { persona?: string | null; primary_goal?: string | null };
  dismissals: DismissalRow[];
  settings: FollowupSettings;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function call<T>(body: unknown, authHeader: string): Promise<Result<T>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/extension-followups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let err = `http_${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.error === 'string') err = data.error;
      } catch (_) { /* ignore */ }
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || 'network_error' };
  }
}

export function getFollowupState(authHeader: string) {
  return call<FollowupState>({ action: 'get_state' }, authHeader);
}

export function updatePreferences(
  payload: UpdatePayload & { source: string; source_listing_url?: string; mismatch_type?: string },
  authHeader: string,
) {
  return call<{ success: boolean; updated_preferences: unknown }>(
    { action: 'update', ...payload },
    authHeader,
  );
}

export function dismissFollowup(mismatch_type: string, authHeader: string) {
  return call<{ success: boolean }>({ action: 'dismiss', mismatch_type }, authHeader);
}

export function saveException(
  payload: {
    property_url: string;
    listing_snapshot: Record<string, unknown>;
    reason?: string;
    note?: string;
  },
  authHeader: string,
) {
  return call<{ success: boolean; id: string }>(
    { action: 'save_exception', ...payload },
    authHeader,
  );
}