/**
 * Surface-agnostic state hook for the Conversational Intelligence layer.
 *
 * Responsibilities:
 *   - Fetch & cache preferences + dismissals via `extension-followups`
 *     (action: get_state). Memo'd per user; refreshed on every accept/dismiss.
 *   - Expose stable handlers that any surface can pass straight to
 *     <ConversationalIntelligence /> and <PreferenceFollowupCardWeb />.
 *
 * Phase 2 only — Phase 3 will add artifact actions to the same hook.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Preferences, MismatchFollowup, DismissalRow, ListingSnapshot } from "./detectMismatches";
import type { GeneratedArtifact } from "./types";

interface State {
  preferences: Preferences | null;
  dismissals: DismissalRow[];
  smartSuggestionsEnabled: boolean;
  loaded: boolean;
}

const EMPTY: State = {
  preferences: null,
  dismissals: [],
  smartSuggestionsEnabled: true,
  loaded: false,
};

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("extension-followups", {
    body: { action, ...payload },
  });
  if (error) return { ok: false as const, error: error.message ?? "Network error" };
  if (data && typeof data === "object" && (data as any).error) {
    return { ok: false as const, error: String((data as any).error) };
  }
  return { ok: true as const, data };
}

export function useConversationalIntelligenceState(userId: string | null | undefined) {
  const [state, setState] = useState<State>(EMPTY);
  const reqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ ...EMPTY, loaded: true });
      return;
    }
    const myReq = ++reqRef.current;
    const r = await invoke("get_state");
    if (myReq !== reqRef.current) return;
    if (!r.ok) {
      setState({ ...EMPTY, loaded: true });
      return;
    }
    const d = (r.data ?? {}) as {
      preferences?: Preferences | null;
      dismissals?: DismissalRow[];
      settings?: { extension_smart_suggestions_enabled?: boolean };
    };
    setState({
      preferences: d.preferences ?? null,
      dismissals: d.dismissals ?? [],
      smartSuggestionsEnabled: d.settings?.extension_smart_suggestions_enabled !== false,
      loaded: true,
    });
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAccept = useCallback(async (f: MismatchFollowup) => {
    if (!f.update_payload) return { ok: true as const };
    const r = await invoke("update", {
      ...f.update_payload,
      source: "web_chat",
      mismatch_type: f.type,
    });
    if (r.ok) void refresh();
    return r;
  }, [refresh]);

  const onDismiss = useCallback(async (f: MismatchFollowup) => {
    const r = await invoke("dismiss", { mismatch_type: f.type });
    if (r.ok) void refresh();
    return { ok: r.ok };
  }, [refresh]);

  const onSaveException = useCallback(
    async (
      f: MismatchFollowup,
      note: string,
      listingSnapshot?: ListingSnapshot,
      propertyUrl?: string,
    ) => {
      const r = await invoke("save_exception", {
        property_url: propertyUrl ?? "",
        listing_snapshot: (listingSnapshot ?? {}) as Record<string, unknown>,
        note,
        reason: f.type,
      });
      return r;
    },
    [],
  );

  const generateArtifact = useCallback(
    async (
      kind: GeneratedArtifact["kind"],
      input: Record<string, unknown>,
    ): Promise<
      | { ok: true; artifact: GeneratedArtifact; cap: { used: number; limit: number; tier: string } }
      | { ok: false; error: string; cap_reached?: boolean }
    > => {
      const { data, error } = await supabase.functions.invoke("generate-artifact", {
        body: { kind, ...input },
      });
      if (error) return { ok: false, error: error.message ?? "Network error" };
      if (data?.error === "daily_cap_reached") {
        return { ok: false, error: "Daily artifact cap reached for your plan.", cap_reached: true };
      }
      if (data?.error || !data?.artifact) {
        return { ok: false, error: String(data?.error ?? "Unknown error") };
      }
      const a = data.artifact;
      return {
        ok: true,
        artifact: {
          id: a.id,
          kind: a.kind,
          filename: a.filename,
          downloadUrl: a.download_url,
          downloadUrlExpiresAt: a.download_url_expires_at,
          sizeBytes: a.size_bytes,
          createdAt: new Date().toISOString(),
        },
        cap: data.cap,
      };
    },
    [],
  );

  return { ...state, refresh, onAccept, onDismiss, onSaveException, generateArtifact };
}