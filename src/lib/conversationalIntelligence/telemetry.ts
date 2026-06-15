/**
 * Fire-and-forget telemetry for Conversational Intelligence events on the
 * web. Mirrors the `extension_followup_*` events emitted by the Chrome
 * extension so we can compare adoption funnels across surfaces.
 *
 * Writes a row to `public.ci_web_events`. RLS scopes to `auth.uid() =
 * user_id`, anonymous sessions are silently no-op'd. Never throws — a
 * telemetry failure must never break a user flow.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SurfaceKind } from "./types";

export type CiEventName =
  | "web_followup_shown"
  | "web_followup_chip_clicked"
  | "web_followup_mismatch_accepted"
  | "web_followup_mismatch_dismissed"
  | "web_artifact_generated"
  | "web_artifact_cap_reached"
  | "web_artifact_failed"
  | "web_macro_card_shown";

export async function trackCiEvent(
  event: CiEventName,
  surface: SurfaceKind,
  props: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await supabase
      .from("ci_web_events")
      .insert([{ user_id: uid, event_name: event, surface, props: props as never }]);
  } catch (err) {
    // Silent — telemetry must never disrupt UX.
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[ci-telemetry] insert failed", err);
    }
  }
}