import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SavedAnalysis {
  id: string;
  user_id: string;
  property_url: string | null;
  property_address: string | null;
  property_price: number | null;
  analysis_summary: string;
  investment_score: number | null;
  score_label: string | null;
  key_metrics: Record<string, any> | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveAnalysisInput {
  propertyUrl?: string | null;
  propertyAddress?: string | null;
  propertyPrice?: number | null;
  analysisSummary: string;
  investmentScore?: number | null;
  scoreLabel?: string | null;
  keyMetrics?: Record<string, any> | null;
  source: "app" | "extension";
}

export type SaveAnalysisResult =
  | { ok: true; id: string }
  | { ok: false; error: "premium_required" | "already_saved" | "unauthorized" | "unknown"; message?: string };

export function useSavedAnalyses() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAnalyses([]);
        return;
      }
      const { data, error } = await supabase
        .from("saved_analyses" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAnalyses((data as unknown as SavedAnalysis[]) || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load saved analyses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedAnalyses();
  }, [fetchSavedAnalyses]);

  const saveAnalysis = useCallback(
    async (input: SaveAnalysisInput): Promise<SaveAnalysisResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false, error: "unauthorized" };

      const { data, error } = await supabase.functions.invoke("save-analysis", {
        body: input,
      });

      if (error) {
        const ctx: any = (error as any).context;
        const status = ctx?.status;
        let payload: any = null;
        try {
          payload = await ctx?.json?.();
        } catch {
          /* ignore */
        }
        if (status === 403 || payload?.error === "premium_required") {
          return { ok: false, error: "premium_required" };
        }
        if (status === 409 || payload?.error === "already_saved") {
          await fetchSavedAnalyses();
          return { ok: false, error: "already_saved" };
        }
        return { ok: false, error: "unknown", message: error.message };
      }

      await fetchSavedAnalyses();
      return { ok: true, id: (data as any)?.id };
    },
    [fetchSavedAnalyses],
  );

  const deleteAnalysis = useCallback(
    async (id: string) => {
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      const { error } = await supabase
        .from("saved_analyses" as any)
        .delete()
        .eq("id", id);
      if (error) {
        await fetchSavedAnalyses();
        throw error;
      }
    },
    [fetchSavedAnalyses],
  );

  const updateNote = useCallback(
    async (id: string, note: string) => {
      setAnalyses((prev) =>
        prev.map((a) => (a.id === id ? { ...a, notes: note } : a)),
      );
      const { error } = await supabase
        .from("saved_analyses" as any)
        .update({ notes: note })
        .eq("id", id);
      if (error) {
        await fetchSavedAnalyses();
        throw error;
      }
    },
    [fetchSavedAnalyses],
  );

  const isUrlSaved = useCallback(
    (url?: string | null) =>
      !!url && analyses.some((a) => a.property_url === url),
    [analyses],
  );

  return {
    analyses,
    loading,
    error,
    fetchSavedAnalyses,
    saveAnalysis,
    deleteAnalysis,
    updateNote,
    isUrlSaved,
  };
}