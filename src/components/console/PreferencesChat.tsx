import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageCircle, RotateCcw, RefreshCw, Pencil, Eye, Save, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PreferencesSummaryCard } from "./PreferencesSummaryCard";
import { PreferencesEditDialog } from "./PreferencesEditDialog";
import { EMPTY_PREFERENCES, type Preferences } from "./preferencesTypes";

interface Turn {
  role: "user" | "assistant";
  content: string;
  suggested?: string[];
}

const OPENING_MESSAGE =
  "Let's set up your HomeLens preferences. Tell me about your search in your own words — for example: \"I'm looking for a 3-bedroom townhouse near Arlington under $650k with good schools and a short commute.\" I'll organize everything for you.";
const OPENING_SUGGESTED = [
  "I'm buying a home for my family",
  "I'm an investor looking for rentals",
  "Show me what you know so far",
];

export function PreferencesChat() {
  const { toast } = useToast();
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: OPENING_MESSAGE, suggested: OPENING_SUGGESTED }]);
  const [preferences, setPreferences] = useState<Preferences>(EMPTY_PREFERENCES);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadInitial = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBooting(false); return; }
    const { data } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .maybeSingle();
    const prefs = (data?.preferences ?? {}) as Preferences;
    setPreferences({ ...EMPTY_PREFERENCES, ...prefs });
    setBooting(false);
  };

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setText("");
    setLoading(true);
    try {
      const messages = nextTurns
        .slice(1) // drop opening assistant message — server adds context
        .map((t) => ({ role: t.role, content: t.content }));
      const { data, error } = await supabase.functions.invoke("preferences-assistant", {
        body: { action: "chat", messages },
      });
      if (error) throw error;
      const reply: Turn = {
        role: "assistant",
        content: data?.message ?? "Got it.",
        suggested: Array.isArray(data?.suggested_replies) ? data.suggested_replies : [],
      };
      setTurns((prev) => [...prev, reply]);
      if (data?.preferences) setPreferences({ ...EMPTY_PREFERENCES, ...data.preferences });
      if (typeof data?.setup_complete === "boolean") setSetupComplete(data.setup_complete);
      if (data?.backup_mode || data?.rate_limited) {
        toast({
          title: "Backup mode",
          description: "Using backup mode — your preferences are still being saved.",
        });
      }
    } catch (e: any) {
      setTurns((prev) => [...prev, { role: "assistant", content: "Something went wrong reaching the assistant. Please try again." }]);
      toast({ title: "Chat error", description: e?.message ?? "Could not reach the assistant.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
  };

  const handleReset = async () => {
    setConfirmReset(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("preferences-assistant", { body: { action: "reset" } });
      if (error) throw error;
      setPreferences({ ...EMPTY_PREFERENCES, ...(data?.preferences ?? {}) });
      setTurns([{ role: "assistant", content: OPENING_MESSAGE, suggested: OPENING_SUGGESTED }]);
      setSetupComplete(false);
      toast({ title: "Preferences reset" });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setTurns([{ role: "assistant", content: OPENING_MESSAGE, suggested: OPENING_SUGGESTED }]);
    setSetupComplete(false);
    toast({ title: "Setup restarted", description: "Preferences kept. Chat cleared." });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("preferences-assistant", { body: { action: "save" } });
      if (error) throw error;
      toast({ title: "Preferences saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async (next: Preferences) => {
    const { data, error } = await supabase.functions.invoke("preferences-assistant", {
      body: { action: "edit", preferences: next },
    });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setPreferences({ ...EMPTY_PREFERENCES, ...(data?.preferences ?? next) });
    toast({ title: "Preferences updated" });
  };

  const handleReview = () => sendMessage("Show me what you know so far.");

  const last = turns[turns.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Preferences assistant
              </span>
              {setupComplete && (
                <span className="flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Setup complete
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={scrollRef}
              className="max-h-[480px] min-h-[320px] overflow-y-auto space-y-3 pr-1"
            >
              {booting && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your preferences…
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {t.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm">
                      {t.content}
                    </div>
                  ) : (
                    <div className="max-w-[90%] text-sm leading-relaxed">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{t.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            {!loading && last?.role === "assistant" && (last.suggested?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2">
                {last.suggested!.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border/50 pt-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type anything — preferences, edits, or questions…"
                disabled={loading}
              />
              <Button type="submit" size="icon" disabled={loading || !text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleSave} disabled={loading}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleReview} disabled={loading}>
                <Eye className="h-3.5 w-3.5 mr-1.5" /> Review summary
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} disabled={loading}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit manually
              </Button>
              <Button size="sm" variant="outline" onClick={handleRestart} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Restart setup
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)} disabled={loading} className="text-destructive hover:text-destructive">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <PreferencesSummaryCard preferences={preferences} />
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all preferences?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear everything HomeLens knows about your search and start a fresh conversation. You can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Reset preferences</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PreferencesEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        value={preferences}
        onSave={handleManualSave}
      />
    </div>
  );
}