/**
 * Trigger predicate helpers for the follow-up registry.
 *
 * Each predicate returns a 0..1 signal strength based on the last few
 * messages in the thread. Cheap regex only — no LLM calls. Composable via
 * `weighted()`.
 */

import type { ConversationalContext } from "./types";

function recentText(ctx: ConversationalContext, n = 3): string {
  return ctx.thread
    .slice(-n)
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" \n ")
    .toLowerCase();
}

function score(rx: RegExp, text: string, hit = 1, miss = 0): number {
  return rx.test(text) ? hit : miss;
}

/** Combine signals: max if any strong, else weighted average. */
export function weighted(signals: number[]): number {
  const valid = signals.filter((s) => s > 0);
  if (valid.length === 0) return 0;
  const max = Math.max(...valid);
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.min(1, 0.6 * max + 0.4 * avg);
}

/* ------------------------------- Financing ------------------------------ */

export function mentionsBudget(ctx: ConversationalContext): number {
  return score(/\$|budget|afford|price range|how much can/i, recentText(ctx, 4), 0.8);
}
export function mentionsAffordability(ctx: ConversationalContext): number {
  return score(/afford|affordab|stretched|too expensive|out of reach/i, recentText(ctx, 4), 0.9);
}
export function mentionsMortgage(ctx: ConversationalContext): number {
  return score(/mortgage|loan|monthly payment|piti|interest rate|30[- ]?year/i, recentText(ctx, 4), 0.8);
}
export function mentionsLender(ctx: ConversationalContext): number {
  return score(/lender|bank|broker|loan officer|underwrit/i, recentText(ctx, 4), 1.0);
}
export function mentionsRates(ctx: ConversationalContext): number {
  return score(/\brate(s)?\b|apr|7%|6%|interest/i, recentText(ctx, 4), 0.7);
}
export function mentionsPreApproval(ctx: ConversationalContext): number {
  return score(/pre[- ]?approv|prequal|qualif/i, recentText(ctx, 4), 1.0);
}
export function mentionsRefinance(ctx: ConversationalContext): number {
  return score(/refi|refinanc|cash[- ]?out/i, recentText(ctx, 4), 1.0);
}
export function mentionsDownPayment(ctx: ConversationalContext): number {
  return score(/down[- ]?payment|\b20%\b|\b10%\b|\b5%\b|\b3\.5%\b|fha|conventional/i, recentText(ctx, 4), 0.8);
}
export function isExploringPrices(ctx: ConversationalContext): number {
  return score(/\$\s?\d{2,3}[k,]|\$\s?\d{3,}|\b\d{3}k\b/i, recentText(ctx, 3), 0.6);
}

/* ------------------------------- FTHB ----------------------------------- */

export function mentionsFirstHome(ctx: ConversationalContext): number {
  return score(/first[- ]?home|first[- ]?house|first[- ]?time buyer|fthb|never owned|starter home/i, recentText(ctx, 5), 1.0);
}
export function mentionsAssistance(ctx: ConversationalContext): number {
  return score(/assistance|grant|down[- ]?payment help|dpa|program|subsid/i, recentText(ctx, 4), 0.9);
}

/* --------------------------- Compare properties ------------------------- */

export function mentionsMultipleProperties(ctx: ConversationalContext): number {
  return score(/compare|which one|vs\.|versus|between (these|them)|side[- ]?by[- ]?side/i, recentText(ctx, 4), 1.0);
}
export function mentionsDecisionBetween(ctx: ConversationalContext): number {
  return score(/decide|choose|pick|better deal|which (should|is)/i, recentText(ctx, 4), 0.7);
}
export function userHasSavedProperties(ctx: ConversationalContext, min = 2): number {
  return (ctx.savedPropertiesCount ?? 0) >= min ? 0.6 : 0;
}
export function userBrowsingListings(ctx: ConversationalContext): number {
  return ctx.active.kind === "general_chat" || ctx.active.kind === "extension"
    ? score(/listing|property|home|house|see (more|some)/i, recentText(ctx, 3), 0.4)
    : 0;
}

/* --------------------------- Neighborhood ------------------------------- */

export function mentionsLocation(ctx: ConversationalContext): number {
  // Address-like or city-state-like — broad match.
  return score(/\b(zip|neighborhood|area|township|district|county|city|metro)\b|\b\d{5}\b|, [A-Z]{2}\b/i, recentText(ctx, 4), 0.5);
}
export function mentionsSchools(ctx: ConversationalContext): number {
  return score(/school|elementary|middle school|high school|isd|district/i, recentText(ctx, 4), 1.0);
}
export function mentionsCrime(ctx: ConversationalContext): number {
  return score(/crime|safe|safety|violent|theft/i, recentText(ctx, 4), 1.0);
}
export function mentionsCommute(ctx: ConversationalContext): number {
  return score(/commute|drive (to|time)|traffic|transit/i, recentText(ctx, 4), 0.9);
}
export function userViewingProperty(ctx: ConversationalContext): number {
  if (ctx.active.kind === "owned_property" || ctx.active.kind === "extension") return 0.7;
  return ctx.active.snapshot ? 0.6 : 0;
}

/* --------------------------- Misc context ------------------------------- */

export function mentionsFirstTimeBuyer(ctx: ConversationalContext): number {
  return Math.max(mentionsFirstHome(ctx), mentionsAssistance(ctx) * 0.6);
}