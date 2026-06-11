import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SavedProperty {
  id: string;
  user_id: string;
  property_url: string;
  property_address: string;
  city: string | null;
  state: string | null;
  created_at: string;
  source?: 'main_app' | 'chrome_extension' | 'investor_console' | null;
  ai_analysis?: Record<string, any> | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  image_url?: string | null;
  updated_at?: string | null;
}

export interface SavePropertyInput {
  propertyUrl: string;
  propertyAddress: string;
  city?: string | null;
  state?: string | null;
}

export interface SavePropertyResult {
  ok: boolean;
  id?: string;
  error?: "already_saved" | "unauthorized" | "unknown";
  message?: string;
}

export function useSavedProperties(user: { id: string } | null | undefined) {
  const [properties, setProperties] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setProperties([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_properties" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setProperties(data as unknown as SavedProperty[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: refresh the list when a row is inserted or updated for this
  // user (e.g. Save Property in the Chrome extension while the main app is
  // open in another tab).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`saved_properties:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_properties',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const saveProperty = useCallback(
    async (input: SavePropertyInput): Promise<SavePropertyResult> => {
      if (!user) return { ok: false, error: "unauthorized" };
      // Optimistic-friendly: check if already exists locally
      if (properties.some((p) => p.property_url === input.propertyUrl)) {
        return { ok: false, error: "already_saved" };
      }
      const { data, error } = await supabase
        .from("saved_properties" as any)
        .insert({
          user_id: user.id,
          property_url: input.propertyUrl,
          property_address: input.propertyAddress,
          city: input.city ?? null,
          state: input.state ?? null,
        })
        .select("*")
        .single();
      if (error) {
        const msg = error.message || "";
        if (/duplicate|unique/i.test(msg)) {
          await refresh();
          return { ok: false, error: "already_saved" };
        }
        return { ok: false, error: "unknown", message: msg };
      }
      setProperties((prev) => [data as unknown as SavedProperty, ...prev]);
      return { ok: true, id: (data as any).id };
    },
    [user, properties, refresh],
  );

  const deleteProperty = useCallback(
    async (id: string) => {
      setProperties((prev) => prev.filter((p) => p.id !== id));
      const { error } = await supabase
        .from("saved_properties" as any)
        .delete()
        .eq("id", id);
      if (error) await refresh();
    },
    [refresh],
  );

  const isUrlSaved = useCallback(
    (url?: string | null) =>
      !!url && properties.some((p) => p.property_url === url),
    [properties],
  );

  return { properties, loading, saveProperty, deleteProperty, refresh, isUrlSaved };
}