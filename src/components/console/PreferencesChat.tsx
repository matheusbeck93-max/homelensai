import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Sparkles, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Choice {
  label: string;
  value: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  choices?: Choice[];
  multiSelect?: boolean;
  allowText?: boolean;
  done?: boolean;
  savedFields?: string[];
}

interface ProfileSummary {
  primary_goal?: string | null;
  preferred_cities?: string[] | null;
  buyer_types?: string[] | null;
  budget_min?: number | null;
  budget_max?: number | null;
  min_bedrooms?: number | null;
  min_bathrooms?: number | null;
  min_sqft?: number | null;
  max_sqft?: number | null;
  must_have_features?: string[] | null;
  investment_strategies?: string[] | null;
  hold_period_years?: number | null;
  financing_preferences?: string[] | null;
  has_children?: boolean | null;
  children_ages?: string[] | null;
  climate_preference?: string | null;
  safety_priority?: string | null;
  about_me?: string | null;
}

const LABEL_FOR_VALUE: Record<string, string> = {
  first_time_buyer: "First-time Buyer",
  move_up_buyer: "Move-up Buyer",
  investor: "Investor",
  downsizer: "Downsizer",
  relocator: "Relocator",
  primary_residence: "Primary Residence",
  buy_and_hold: "Buy & Hold",
  flip: "Fix & Flip",
  vacation_home: "Vacation Home",
  brrrr: "BRRRR",
  house_hack: "House Hacking",
  cash: "Cash",
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
  hard_money: "Hard Money",
  garage: "Garage",
  pool: "Pool",
  yard: "Yard",
  basement: "Basement",
  "central-ac": "Central A/C",
  "updated-kitchen": "Updated Kitchen",
  "home-office": "Home Office",
  "open-floor-plan": "Open Floor Plan",
  infant: "Infant (0–2)",
  toddler: "Toddler (3–5)",
  elementary: "Elementary (6–10)",
  "middle-school": "Middle School (11–13)",
  "high-school": "High School (14–18)",
  warm: "Warm",
  mild: "Mild",
  cold: "Cold",
  four_seasons: "Four Seasons",
  no_preference: "No Preference",
  very_high: "Very High",
  high: "High",
  medium: "Medium",
  low: "Low",
  buy_home: "Buy a home",
  invest: "Invest",
  both: "Both",
};

const pretty = (v: string) => LABEL_FOR_VALUE[v] ?? v;
const money = (n?: number | null) => (n != null ? `$${n.toLocaleString()}` : null);

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1 text-sm">
      <span className="text-muted-foreground min-w-[120px]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PreferencesSummary({ profile }: { profile: ProfileSummary | null }) {
  if (!profile) return null;
  const budget =
    profile.budget_min || profile.budget_max
      ? `${money(profile.budget_min) ?? "—"} – ${money(profile.budget_max) ?? "—"}`
      : null;
  const sqft =
    profile.min_sqft || profile.max_sqft
      ? `${profile.min_sqft ?? "—"} – ${profile.max_sqft ?? "—"} sqft`
      : null;

  const hasAny =
    profile.primary_goal ||
    (profile.preferred_cities && profile.preferred_cities.length) ||
    (profile.buyer_types && profile.buyer_types.length) ||
    budget ||
    profile.min_bedrooms ||
    profile.min_bathrooms ||
    sqft ||
    (profile.must_have_features && profile.must_have_features.length) ||
    (profile.investment_strategies && profile.investment_strategies.length) ||
    profile.hold_period_years ||
    (profile.financing_preferences && profile.financing_preferences.length) ||
    profile.has_children ||
    profile.climate_preference ||
    profile.safety_priority ||
    profile.about_me;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          Your preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasAny && (
          <p className="text-sm text-muted-foreground">Nothing saved yet — start chatting below.</p>
        )}
        {hasAny && (
          <div className="divide-y divide-border/50">
            <SummaryRow label="Goal" value={profile.primary_goal ? pretty(profile.primary_goal) : null} />
            <SummaryRow label="Cities" value={profile.preferred_cities?.join(" • ")} />
            <SummaryRow
              label="Persona"
              value={profile.buyer_types?.map(pretty).join(", ")}
            />
            <SummaryRow label="Budget" value={budget} />
            <SummaryRow label="Beds / Baths" value={profile.min_bedrooms || profile.min_bathrooms ? `${profile.min_bedrooms ?? "—"}+ bd / ${profile.min_bathrooms ?? "—"}+ ba` : null} />
            <SummaryRow label="Size" value={sqft} />
            <SummaryRow
              label="Must-haves"
              value={profile.must_have_features?.map(pretty).join(", ")}
            />
            <SummaryRow
              label="Strategy"
              value={profile.investment_strategies?.map(pretty).join(", ")}
            />
            <SummaryRow label="Hold period" value={profile.hold_period_years ? `${profile.hold_period_years} yr` : null} />
            <SummaryRow
              label="Financing"
              value={profile.financing_preferences?.map(pretty).join(", ")}
            />
            <SummaryRow
              label="Kids"
              value={profile.has_children ? (profile.children_ages?.map(pretty).join(", ") || "Yes") : null}
            />
            <SummaryRow label="Climate" value={profile.climate_preference ? pretty(profile.climate_preference) : null} />
            <SummaryRow label="Safety" value={profile.safety_priority ? pretty(profile.safety_priority) : null} />
            <SummaryRow label="About me" value={profile.about_me} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INITIAL_TURN: Turn = {
  role: "assistant",
  content:
    "Hi! Let's set up your HomeLens preferences — you can change anything anytime.\n\n**What's your primary goal with HomeLens?**",
  choices: [
    { label: "Buy a home", value: "buy_home" },
    { label: "Invest", value: "invest" },
    { label: "Both", value: "both" },
  ],
  multiSelect: false,
  allowText: false,
};

export function PreferencesChat() {
  const { toast } = useToast();
  const [turns, setTurns] = useState<Turn[]>([INITIAL_TURN]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select(
        "primary_goal, preferred_cities, buyer_types, budget_min, budget_max, min_bedrooms, min_bathrooms, min_sqft, max_sqft, must_have_features, investment_strategies, hold_period_years, financing_preferences, has_children, children_ages, climate_preference, safety_priority, about_me",
      )
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as ProfileSummary | null) ?? null);
  };

  const callChat = async (newTurns: Turn[]) => {
    setLoading(true);
    try {
      const messages = newTurns.map((t) => ({ role: t.role, content: t.content }));
      const { data, error } = await supabase.functions.invoke("preferences-chat", {
        body: { messages },
      });
      if (error) throw error;
      const assistant: Turn = {
        role: "assistant",
        content: data?.assistant_message ?? "Tell me more.",
        choices: Array.isArray(data?.choices) ? data.choices : [],
        multiSelect: !!data?.multi_select,
        allowText: data?.allow_text !== false,
        done: !!data?.done,
        savedFields: Array.isArray(data?.saved_fields) ? data.saved_fields : [],
      };
      setTurns((prev) => [...prev, assistant]);
      if (assistant.savedFields && assistant.savedFields.length > 0) {
        await loadProfile();
      }
    } catch (e: any) {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong reaching the assistant. Try again, or just type your answer below and I'll save it.",
        },
      ]);
      toast({
        title: "Chat error",
        description: e?.message ?? "Could not reach the preferences assistant.",
        variant: "destructive",
      });
    } finally {
      setSelected([]);
      setLoading(false);
    }
  };

  // Initial load — just fetch profile; the opening question is preloaded.
  useEffect(() => {
    (async () => {
      await loadProfile();
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const last = turns[turns.length - 1];
  const canShowChoices = !loading && last?.role === "assistant" && (last.choices?.length ?? 0) > 0;
  const canUseText = !loading && last?.role === "assistant" && last.allowText !== false;

  const sendUserMessage = async (content: string) => {
    if (!content.trim()) return;
    const next: Turn[] = [...turns, { role: "user", content: content.trim() }];
    setTurns(next);
    setText("");
    await callChat(next);
  };

  const toggleChoice = (value: string) => {
    if (!last?.multiSelect) {
      sendUserMessage(pretty(value));
      return;
    }
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const submitMultiSelect = () => {
    if (selected.length === 0) return;
    const labels = selected.map(pretty).join(", ");
    sendUserMessage(labels);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendUserMessage(text);
  };

  return (
    <div className="space-y-4">
      <PreferencesSummary profile={profile} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Choose your preferences — change at any time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={scrollRef}
            className="max-h-[480px] min-h-[280px] overflow-y-auto space-y-3 pr-1"
          >
            {booting && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your preferences…
              </div>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                {t.role === "user" ? (
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm">
                    {t.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] text-sm leading-relaxed">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{t.content}</ReactMarkdown>
                    </div>
                    {t.savedFields && t.savedFields.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.savedFields.map((f) => (
                          <Badge key={f} variant="secondary" className="text-[10px]">
                            Saved: {f.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && !booting && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {canShowChoices && last?.choices && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {last.choices.map((c) => {
                  const isSelected = selected.includes(c.value);
                  return (
                    <Button
                      key={c.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleChoice(c.value)}
                      className="rounded-full"
                    >
                      {c.label}
                    </Button>
                  );
                })}
              </div>
              {last.multiSelect && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={submitMultiSelect} disabled={selected.length === 0}>
                    Confirm {selected.length > 0 ? `(${selected.length})` : ""}
                  </Button>
                </div>
              )}
            </div>
          )}

          {canUseText && (
            <form onSubmit={handleTextSubmit} className="flex items-center gap-2 border-t border-border/50 pt-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={last.done ? "Type what you'd like to change…" : "Type your answer, or ask to change anything…"}
                disabled={loading}
                autoFocus
              />
              <Button type="submit" size="icon" disabled={loading || !text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}