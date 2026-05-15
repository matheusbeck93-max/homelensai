import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse, validationError } from "../_shared/responses.ts";
import { getErrorMessage } from "../_shared/errors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

const requestSchema = z.object({
  budget: z.number().positive(),
  goal: z.enum(["cash_flow", "appreciation", "hybrid"]),
  horizon: z.enum(["short", "mid", "long"]),
  risk: z.enum(["low", "medium", "high"]),
  markets: z.array(z.string().min(1)).min(2).max(4),
});

const TrendEnum = z.enum(["rising", "flat", "falling", "unknown"]);
const RiskEnum = z.enum(["low", "medium", "high", "unknown"]);

const tableRowSchema = z.object({
  market: z.string(),
  medianPrice: z.string(),
  rentalYield: z.string(),
  appreciation5y: z.string(),
  inventoryTrend: TrendEnum,
  riskLevel: RiskEnum,
});

const aiResponseSchema = z.object({
  normalizedMarkets: z.array(z.object({
    input: z.string(),
    label: z.string(),
    assumption: z.string().optional().nullable(),
  })),
  verdict: z.object({
    cashFlow: z.string(),
    appreciation: z.string(),
    bestFit: z.string(),
    rationale: z.string(),
  }),
  table: z.array(tableRowSchema),
  insight: z.string(),
  insightBullets: z.array(z.string()).optional().default([]),
  dataNotes: z.array(z.string()).optional().default([]),
});

function emptyRow(label: string) {
  return {
    market: label,
    medianPrice: "n/a",
    rentalYield: "n/a",
    appreciation5y: "n/a",
    inventoryTrend: "unknown" as const,
    riskLevel: "unknown" as const,
  };
}

function safeRow(row: unknown, fallbackLabel: string) {
  const parsed = tableRowSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  return emptyRow(fallbackLabel);
}

function bulletLooksGood(b: string): boolean {
  const t = b.trim();
  if (t.length < 30) return false;
  // generic openers
  if (/^(consider|overall|in summary|note that)\b/i.test(t)) return false;
  return true;
}

function synthesizeBullets(insight: string, labels: string[]): string[] {
  const sentences = insight
    .replace(/[#*_>`]/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 240);

  const score = (s: string) => {
    let n = 0;
    if (/\d/.test(s)) n += 2;
    if (/%|\$/.test(s)) n += 1;
    if (/\b(risk|trade-?off|opportunity|yield|appreciation|cash\s*flow|cap\s*rate|inventory|vacancy)\b/i.test(s)) n += 2;
    for (const l of labels) {
      if (s.toLowerCase().includes(l.toLowerCase().split(",")[0].trim().toLowerCase())) {
        n += 1;
        break;
      }
    }
    return n;
  };

  const ranked = [...sentences].sort((a, b) => score(b) - score(a));
  const picked: string[] = [];
  for (const s of ranked) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.toLowerCase().slice(0, 40) === s.toLowerCase().slice(0, 40))) {
      picked.push(s);
    }
  }
  // pad to at least 2 if possible by reusing trimmed insight head
  if (picked.length < 2) {
    const head = insight.replace(/\s+/g, " ").trim().slice(0, 220);
    if (head && !picked.includes(head)) picked.push(head);
  }
  return picked.slice(0, 3);
}

function enforceLabel(text: string, input: string, canonical: string): string {
  if (!input || !canonical || input === canonical) return text;
  // Replace standalone occurrences of the raw input with canonical label.
  const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  return text.replace(re, canonical);
}

const GOAL_LABEL: Record<string, string> = {
  cash_flow: "Cash flow (rental income)",
  appreciation: "Appreciation",
  hybrid: "Hybrid (cash flow + appreciation)",
};
const HORIZON_LABEL: Record<string, string> = {
  short: "Short-term (1–3 years)",
  mid: "Mid-term (3–7 years)",
  long: "Long-term (7+ years)",
};
const RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("Invalid request", parsed.error.flatten());
    }
    const { budget, goal, horizon, risk, markets } = parsed.data;

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return errorResponse("PERPLEXITY_API_KEY is not configured", 500);
    }

    const systemPrompt = `You are a US real estate market comparison engine for investors. You return STRICT JSON only — no prose, no code fences.

RULES:
- Use only data supported by your search results. Never invent figures.
- For any unknown metric, output the literal string "n/a" and add a one-line entry to dataNotes.
- Always include EVERY requested market in the table — never omit one. If unknown, fill with n/a / "unknown".
- Normalize every input market to a canonical city or metro label, e.g. "nyc" -> "New York Metro, NY", "tampa" -> "Tampa Metro, FL". For ambiguous inputs (bare "New York", "Springfield"), assume the metro area and add an explicit dataNotes entry.
- Use the SAME normalized label everywhere it appears (verdict, table.market, insight, insightBullets).
- Insight requirements (markdown, 4–8 sentences):
  * At least one risk per market
  * At least one opportunity per market
  * At least one explicit cross-market trade-off
  * Tie directly to the user's budget, goal, horizon, and risk
- insightBullets: 2–3 high-signal bullets summarizing the key takeaway for chat hand-off (each ≥40 chars, decision-oriented, no fluff).
- Prefer rounded values prefixed with "~" (e.g. "~$285k", "~7.1%") over false precision.
- Currency in USD with k/M suffix when convenient.

OUTPUT JSON SHAPE (strict):
{
  "normalizedMarkets": [{"input": string, "label": string, "assumption"?: string}],
  "verdict": {"cashFlow": string, "appreciation": string, "bestFit": string, "rationale": string},
  "table": [{"market": string, "medianPrice": string, "rentalYield": string, "appreciation5y": string, "inventoryTrend": "rising"|"flat"|"falling"|"unknown", "riskLevel": "low"|"medium"|"high"|"unknown"}],
  "insight": string,
  "insightBullets": string[],
  "dataNotes": string[]
}`;

    const userPrompt = `Investor profile:
- Budget: $${budget.toLocaleString("en-US")}
- Goal: ${GOAL_LABEL[goal]}
- Time horizon: ${HORIZON_LABEL[horizon]}
- Risk tolerance: ${RISK_LABEL[risk]}

Markets to compare (in this order): ${markets.map((m, i) => `${i + 1}. ${m}`).join(" | ")}

Return STRICT JSON matching the schema. Order the table to match the input order above (after normalization). Each verdict winner MUST be one of the normalized labels.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let pplxRes: Response;
    try {
      pplxRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "sonar",
          temperature: 0.2,
          max_tokens: 1800,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "market_comparator",
              schema: {
                type: "object",
                properties: {
                  normalizedMarkets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        input: { type: "string" },
                        label: { type: "string" },
                        assumption: { type: "string" },
                      },
                      required: ["input", "label"],
                    },
                  },
                  verdict: {
                    type: "object",
                    properties: {
                      cashFlow: { type: "string" },
                      appreciation: { type: "string" },
                      bestFit: { type: "string" },
                      rationale: { type: "string" },
                    },
                    required: ["cashFlow", "appreciation", "bestFit", "rationale"],
                  },
                  table: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        market: { type: "string" },
                        medianPrice: { type: "string" },
                        rentalYield: { type: "string" },
                        appreciation5y: { type: "string" },
                        inventoryTrend: { type: "string", enum: ["rising", "flat", "falling", "unknown"] },
                        riskLevel: { type: "string", enum: ["low", "medium", "high", "unknown"] },
                      },
                      required: ["market", "medianPrice", "rentalYield", "appreciation5y", "inventoryTrend", "riskLevel"],
                    },
                  },
                  insight: { type: "string" },
                  insightBullets: { type: "array", items: { type: "string" } },
                  dataNotes: { type: "array", items: { type: "string" } },
                },
                required: ["normalizedMarkets", "verdict", "table", "insight"],
              },
            },
          },
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error("market-comparator: perplexity fetch failed", err);
      return errorResponse("Comparison engine timed out. Please try again.", 504);
    }
    clearTimeout(timeout);

    if (pplxRes.status === 429) {
      return errorResponse("Rate limit reached. Please try again shortly.", 429);
    }
    if (pplxRes.status === 402) {
      return errorResponse("AI credits exhausted. Please try again later.", 402);
    }
    if (!pplxRes.ok) {
      const txt = await pplxRes.text();
      console.error("market-comparator: perplexity error", pplxRes.status, txt);
      return errorResponse("Comparison engine unavailable.", 502);
    }

    const pplxJson = await pplxRes.json();
    const rawContent: string = pplxJson?.choices?.[0]?.message?.content ?? "";

    let aiObj: unknown;
    try {
      // Strip code fences if any sneak through
      const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      aiObj = JSON.parse(cleaned);
    } catch (e) {
      console.error("market-comparator: JSON parse failed", e, rawContent.slice(0, 400));
      return errorResponse("Comparison engine returned malformed data.", 502);
    }

    const aiParsed = aiResponseSchema.safeParse(aiObj);
    if (!aiParsed.success) {
      console.error("market-comparator: schema validation failed", aiParsed.error.flatten());
      return errorResponse("Comparison engine returned invalid shape.", 502);
    }
    const ai = aiParsed.data;

    // ---- Build canonical input -> label map (preserve user input order) ----
    const labelMap = new Map<string, string>();
    const dataNotes = [...(ai.dataNotes ?? [])];
    for (const input of markets) {
      const match = ai.normalizedMarkets.find(
        (n) => n.input.trim().toLowerCase() === input.trim().toLowerCase(),
      ) ?? ai.normalizedMarkets.find(
        (n) => n.label.toLowerCase().includes(input.trim().toLowerCase()),
      );
      const label = match?.label?.trim() || input.trim();
      labelMap.set(input, label);
      if (match?.assumption) dataNotes.push(match.assumption);
    }

    // ---- Build table preserving input order, fill gaps ----
    const table = markets.map((input) => {
      const label = labelMap.get(input)!;
      const row = ai.table.find((r) => {
        const m = r.market?.trim().toLowerCase() ?? "";
        return m === label.toLowerCase() || m === input.trim().toLowerCase() || m.includes(label.split(",")[0].toLowerCase());
      });
      if (!row) {
        dataNotes.push(`No comparable data returned for "${label}" — showing n/a.`);
        return emptyRow(label);
      }
      const safe = safeRow(row, label);
      return { ...safe, market: label };
    });

    const canonicalLabels = Array.from(labelMap.values());

    // ---- Enforce canonical labels in verdict ----
    const enforceVerdict = (v: string): string => {
      let out = v;
      for (const [input, label] of labelMap.entries()) {
        out = enforceLabel(out, input, label);
      }
      return out.trim();
    };
    const verdict = {
      cashFlow: enforceVerdict(ai.verdict.cashFlow),
      appreciation: enforceVerdict(ai.verdict.appreciation),
      bestFit: enforceVerdict(ai.verdict.bestFit),
      rationale: enforceVerdict(ai.verdict.rationale),
    };

    // ---- Enforce canonical labels in insight ----
    let insight = ai.insight;
    for (const [input, label] of labelMap.entries()) {
      insight = enforceLabel(insight, input, label);
    }

    // ---- Insight content rules check (warn-only) ----
    const lowerInsight = insight.toLowerCase();
    for (const label of canonicalLabels) {
      const head = label.split(",")[0].trim().toLowerCase();
      const block = lowerInsight; // simple presence check
      const hasRisk = /\brisk|downside|concern|caution|vulnerab/.test(block) && block.includes(head);
      const hasOpp = /\bopportunity|upside|tailwind|growth|advantage|attractive/.test(block) && block.includes(head);
      if (!hasRisk) dataNotes.push(`Insight may not explicitly cover risks for ${label}.`);
      if (!hasOpp) dataNotes.push(`Insight may not explicitly cover opportunities for ${label}.`);
    }
    const hasTradeoff = /\btrade-?off|versus|compared to|whereas|while [A-Z]|on the other hand\b/i.test(insight);
    if (!hasTradeoff) dataNotes.push("Insight may lack an explicit cross-market trade-off.");

    // ---- insightBullets quality gate + fallback ----
    let bullets = (ai.insightBullets ?? [])
      .map((b) => b.replace(/^[-*•]\s*/, "").trim())
      .filter((b) => b.length > 0);
    const goodBullets = bullets.filter(bulletLooksGood);
    const seen = new Set<string>();
    const dedup = goodBullets.filter((b) => {
      const key = b.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (dedup.length < 2) {
      bullets = synthesizeBullets(insight, canonicalLabels);
    } else {
      bullets = dedup.slice(0, 3);
    }
    if (bullets.length === 0) {
      bullets = [insight.replace(/\s+/g, " ").trim().slice(0, 200)];
    }

    return jsonResponse({
      verdict,
      table,
      insight,
      insightBullets: bullets,
      dataNotes,
      normalizedLabels: canonicalLabels,
    });
  } catch (error) {
    console.error("market-comparator error", error);
    return errorResponse(getErrorMessage(error), 500);
  }
});
