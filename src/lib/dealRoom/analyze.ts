/**
 * Deal Room analysis — reuses the existing pipeline. No mock data:
 *  - facts come from `fetch-property` (Firecrawl extraction), placeholder
 *    fallbacks from that function are discarded rather than displayed.
 *  - the verdict, rationale and Match Score come from `perplexity-chat`,
 *    the same path the chat analysis uses (MATCH_SCORE contract).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  defaultChecklist,
  verdictFromScore,
  type DealFacts,
  type DealRoom,
} from "./types";
import { newRoomId } from "./store";

const PLACEHOLDER_ADDRESS = "Property Address";

export function parseMatchScore(content: string): { score: number | null; clean: string } {
  const match = content.match(/MATCH_SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
  if (!match) return { score: null, clean: content };
  const score = Math.max(0, Math.min(10, parseFloat(match[1])));
  return { score, clean: content.replace(match[0], "").trimStart() };
}

/** Remove citation markers and bold markers for clean display. */
export function stripMarkers(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/[\u2070-\u209f]/g, "")
    .trim();
}

async function fetchFacts(url: string): Promise<DealFacts> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-property", { body: { url } });
    if (error) return {};
    const p = (data as { propertyData?: Record<string, unknown> })?.propertyData;
    if (!p) return {};
    const facts: DealFacts = {};
    const address = typeof p.address === "string" ? p.address : "";
    if (address && address !== PLACEHOLDER_ADDRESS) facts.address = address;
    if (typeof p.city === "string" && p.city !== "City") facts.city = p.city;
    if (typeof p.state === "string" && p.state !== "ST") facts.state = p.state;
    if (typeof p.zip === "string" && p.zip !== "00000") facts.zip = p.zip;
    if (typeof p.price === "number" && p.price > 0) facts.price = p.price;
    return facts;
  } catch {
    return {};
  }
}

/** Pull beds / baths / sqft out of the AI prose when the scrape missed them. */
function factsFromProse(text: string): DealFacts {
  const facts: DealFacts = {};
  const beds = text.match(/(\d+)\s*(?:bed|bd|bedroom)s?\b/i);
  const baths = text.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)s?\b/i);
  const sqft = text.match(/([\d,]{3,})\s*(?:sq\.?\s*ft|sqft|square feet)/i);
  if (beds) facts.beds = parseInt(beds[1], 10);
  if (baths) facts.baths = parseFloat(baths[1]);
  if (sqft) facts.sqft = parseInt(sqft[1].replace(/,/g, ""), 10);
  return facts;
}

/**
 * Split the rationale into supporting / cautionary bullets. Fair Housing safe:
 * we only surface what the model wrote about the property and its economics,
 * and we drop any line touching protected-class or demographic language.
 */
const PROTECTED_TERMS =
  /\b(race|racial|ethnic|ethnicity|religio|church|mosque|synagogue|families with children|child-free|nationality|immigrant|disab|handicap|gender|sexual orientation|good schools for|safe neighborhood for|family-friendly demographic)\w*/i;

function splitWhy(text: string): { why: string[]; whyNot: string[] } {
  const lines = text
    .split("\n")
    .map((l) => stripMarkers(l.replace(/^[-*\u2022]\s*/, "").replace(/\*\*/g, "")))
    .filter((l) => l.length > 25 && l.length < 260)
    .filter((l) => !PROTECTED_TERMS.test(l));

  const negative = /\b(risk|concern|however|but |overpriced|above market|caution|downside|expensive|high tax|hoa|flood|deferred maintenance|watch out|red flag)\b/i;
  const why: string[] = [];
  const whyNot: string[] = [];
  for (const line of lines) {
    (negative.test(line) ? whyNot : why).push(line);
    if (why.length >= 4 && whyNot.length >= 4) break;
  }
  return { why: why.slice(0, 4), whyNot: whyNot.slice(0, 4) };
}

export async function analyzeListing(url: string): Promise<DealRoom> {
  const [facts, chat] = await Promise.all([
    fetchFacts(url),
    supabase.functions.invoke("perplexity-chat", {
      body: {
        query:
          `Analyze this listing for me and give a decision: ${url}\n` +
          `Cover: whether the price looks fair, the key risks, monthly cost sketch, and how it fits my profile. ` +
          `Start your reply with the line "MATCH_SCORE: X/10".`,
        conversationHistory: [],
      },
    }),
  ]);

  if (chat.error) throw new Error(chat.error.message || "Analysis failed");
  const raw = (chat.data as { message?: string })?.message || "";
  if (!raw) throw new Error("No analysis returned for that listing.");

  const { score, clean } = parseMatchScore(raw);
  const analysis = stripMarkers(clean);
  const prose = factsFromProse(analysis);
  const merged: DealFacts = { ...prose, ...facts };
  const { why, whyNot } = splitWhy(analysis);
  if (!merged.price) {
    const priceInProse = analysis.match(/\$\s?([\d,]{6,})/);
    if (priceInProse) merged.price = parseInt(priceInProse[1].replace(/,/g, ""), 10);
  }

  const now = new Date().toISOString();
  return {
    id: newRoomId(),
    listingUrl: url,
    createdAt: now,
    updatedAt: now,
    facts: merged,
    score,
    verdict: verdictFromScore(score),
    analysis,
    why,
    whyNot,
    checklist: defaultChecklist(),
  };
}
