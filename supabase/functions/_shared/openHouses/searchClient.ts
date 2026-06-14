/**
 * In-cluster client for the `open-houses-search` edge function.
 * Used by chat-tool integrations so a single tier/cache/limit path
 * is enforced regardless of entry point.
 */

import { requireEnv } from '../env.ts';
import type { OpenHouseFilters, OpenHouseSearchResult } from './types.ts';

export async function searchOpenHouses(
  filters: OpenHouseFilters,
  authHeader: string | null,
): Promise<OpenHouseSearchResult> {
  const url = `${requireEnv('SUPABASE_URL')}/functions/v1/open-houses-search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Fall back to anon so the function can still run, but most paths pass user JWT.
      Authorization: authHeader ?? `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') ?? ''}`,
    },
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`open-houses-search ${res.status}: ${txt.slice(0, 200)}`);
  }

  return (await res.json()) as OpenHouseSearchResult;
}
