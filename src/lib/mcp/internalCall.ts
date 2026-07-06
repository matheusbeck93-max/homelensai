import type { ToolContext } from "@lovable.dev/mcp-js";

declare const process: { env: Record<string, string | undefined> };

/**
 * Invoke another HomeLens edge function from an MCP tool, forwarding the
 * user's Supabase JWT so RLS + existing tier/credit guards inside that
 * function still apply. Returns { ok, status, data }.
 */
export async function internalCall<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: boolean; status: number; data: T | { error?: string; message?: string } }> {
  const url = process.env.SUPABASE_URL!;
  const apikey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  const token = ctx.getToken();
  const res = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey,
      Authorization: `Bearer ${token ?? apikey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* keep as text */
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

/** Extract a human-readable error message from an internalCall failure. */
export function extractErr(data: unknown): string {
  if (!data) return "Request failed.";
  if (typeof data === "string") return data.slice(0, 500);
  const d = data as { error?: unknown; message?: unknown; code?: unknown };
  const msg = (typeof d.error === "string" && d.error)
    || (typeof d.message === "string" && d.message)
    || (typeof d.code === "string" && d.code)
    || "Request failed.";
  return String(msg).slice(0, 500);
}