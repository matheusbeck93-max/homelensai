import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExceptionProperty {
  id: string;
  user_id: string;
  property_url: string;
  listing_snapshot: Record<string, any> | null;
  reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mirror of useSavedProperties for the new `user_exception_properties`
 * table. Surfaces listings the user explicitly flagged as "interesting
 * outside my usual criteria" from the Chrome extension.
 */
export function useExceptionProperties(user: { id: string } | null | undefined) {
  const [exceptions, setExceptions] = useState<ExceptionProperty[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setExceptions([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("user_exception_properties" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setExceptions(data as unknown as ExceptionProperty[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user_exception_properties:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_exception_properties",
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("user_exception_properties" as any)
        .delete()
        .eq("id", id);
      if (!error) {
        setExceptions((prev) => prev.filter((p) => p.id !== id));
      }
      return !error;
    },
    [],
  );

  return { exceptions, loading, remove, refresh };
}