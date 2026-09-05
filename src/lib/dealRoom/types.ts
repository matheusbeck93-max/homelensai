/**
 * Deal Room — the artifact produced after a listing analysis.
 *
 * A room is a durable, shareable snapshot of one listing: facts, the AI
 * rationale, the Match Score and the verdict, plus the human's checklist.
 * Rooms are persisted locally (see `store.ts`) — see the note in DealRoom.tsx.
 */

export type DealVerdict = "walk_away" | "dig_deeper" | "strong_fit";

export const VERDICT_LABEL: Record<DealVerdict, string> = {
  walk_away: "Walk away",
  dig_deeper: "Dig deeper",
  strong_fit: "Strong fit",
};

export interface DealFacts {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
}

export interface DealChecklistItem {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

export interface DealRoom {
  id: string;
  listingUrl: string;
  createdAt: string;
  updatedAt: string;
  facts: DealFacts;
  /** 0–10, as produced by the Match Score contract. */
  score: number | null;
  verdict: DealVerdict | null;
  /** Full AI analysis prose (markdown-ish, citations already stripped). */
  analysis: string;
  why: string[];
  whyNot: string[];
  checklist: DealChecklistItem[];
}

export function verdictFromScore(score: number | null): DealVerdict | null {
  if (score === null || Number.isNaN(score)) return null;
  if (score >= 8) return "strong_fit";
  if (score >= 5) return "dig_deeper";
  return "walk_away";
}

export function defaultChecklist(): DealChecklistItem[] {
  return [
    {
      id: "dig",
      label: "Dig deeper",
      detail: "Pull the price history, days on market and recent comparable sales.",
      done: false,
    },
    {
      id: "agent",
      label: "Talk to an agent",
      detail: "Ask about seller motivation, condition disclosures and any pending offers.",
      done: false,
    },
    {
      id: "offer_band",
      label: "Set your offer band",
      detail: "Decide the range you'd be comfortable writing, before you tour it.",
      done: false,
    },
    {
      id: "walk_away",
      label: "Set your walk-away line",
      detail: "Write down the price or finding that ends this deal for you.",
      done: false,
    },
  ];
}
