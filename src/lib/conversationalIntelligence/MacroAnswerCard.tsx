/**
 * MacroAnswerCard — structured rendering for MACRO intent answers.
 *
 * Driven by the `macro_answer` payload inside `ci-signals`. Shows a bold
 * takeaway, 2-4 metric tiles, and an optional confidence bar. Follow-up
 * chips are still rendered by `<ConversationalIntelligence />` below the
 * composer — this card only carries the analytical body.
 */
import { useEffect, useRef } from "react";
import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MacroAnswer } from "./types";
import { trackCiEvent } from "./telemetry";
import type { SurfaceKind } from "./types";

interface Props {
  answer: MacroAnswer;
  /** Surface for telemetry. */
  surface?: SurfaceKind;
  /** Stable id (e.g. turn id) used to fire the shown event only once per turn. */
  turnKey?: string;
  className?: string;
}

function isValid(a: MacroAnswer | null | undefined): a is MacroAnswer {
  return !!a && typeof a.takeaway === "string" && a.takeaway.length > 0 && Array.isArray(a.metrics) && a.metrics.length >= 2;
}

export function MacroAnswerCard({ answer, surface, turnKey, className }: Props) {
  const firedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isValid(answer)) return;
    const k = turnKey ?? "anon";
    if (firedRef.current === k) return;
    firedRef.current = k;
    void trackCiEvent("web_macro_card_shown", surface ?? "general_chat", {
      metric_count: answer.metrics.length,
      has_confidence: typeof answer.confidence === "number",
    });
  }, [answer, surface, turnKey]);

  if (!isValid(answer)) return null;
  const confidence = typeof answer.confidence === "number" ? answer.confidence : null;

  return (
    <div className={cn("not-prose flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-1">
        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
          <MessageSquareText className="w-3 h-3 text-muted-foreground" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Analysis
        </span>
      </div>
      <div className="bg-background border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-foreground font-bold text-base leading-snug mb-4">
          {answer.takeaway}
        </h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
          {answer.metrics.slice(0, 4).map((m, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                {m.label}
              </span>
              <span
                className={cn(
                  "text-lg font-bold tracking-tight",
                  m.trend === "up" && "text-emerald-600 dark:text-emerald-400",
                  m.trend === "down" && "text-destructive",
                  (!m.trend || m.trend === "neutral") && "text-foreground",
                )}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
        {confidence !== null && (
          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Analysis Confidence
              </span>
              <span className="text-xs font-bold text-foreground">{confidence}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {answer.source_note && (
        <p className="px-1 text-[10px] text-muted-foreground">{answer.source_note}</p>
      )}
    </div>
  );
}

/** Helper for surfaces: pull a MacroAnswer off a turn's signals payload. */
export function getMacroAnswer(signals: unknown): MacroAnswer | null {
  if (!signals || typeof signals !== "object") return null;
  const m = (signals as { macro_answer?: unknown }).macro_answer;
  return isValid(m as MacroAnswer) ? (m as MacroAnswer) : null;
}