// Save Property / Save Chat helpers — called directly from popup.tsx.
// Keeps SUPABASE constants in sync with background.ts / popup.tsx.

const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

export interface SavePropertyPayload {
  listing_url: string;
  scraped_data: {
    address: string;
    city?: string | null;
    state?: string | null;
    price?: number | null;
    beds?: number | null;
    baths?: number | null;
    sqft?: number | null;
    primary_photo_url?: string | null;
  };
  ai_analysis?: Record<string, unknown> | null;
}

export interface SaveChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SaveChatPayload {
  thread_id_client: string;
  title?: string;
  messages: SaveChatMessage[];
  property_context?: { listing_url?: string | null } | null;
}

export type SaveResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function call<T>(path: string, body: unknown, authHeader: string): Promise<SaveResult<T>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
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
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || 'network_error' };
  }
}

export interface SavePropertyResponse {
  saved_property_id: string;
  is_new: boolean;
  view_url: string;
}

export interface SaveChatResponse {
  thread_id: string;
  is_new: boolean;
  appended: number;
  view_url: string;
}

export function saveProperty(payload: SavePropertyPayload, authHeader: string) {
  return call<SavePropertyResponse>('extension-save-property', payload, authHeader);
}

export function saveChat(payload: SaveChatPayload, authHeader: string) {
  return call<SaveChatResponse>('extension-save-chat', payload, authHeader);
}