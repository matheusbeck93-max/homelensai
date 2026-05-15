import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse, validationError } from "../_shared/responses.ts";
import { getErrorMessage } from "../_shared/errors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("market-comparator");

const requestSchema = z.object({
  budget: z.number().positive(),
  goal: z.enum(["cash_flow", "appreciation", "hybrid"]),
  horizon: z.enum(["short", "mid", "long"]),
  risk: z.enum(["low", "medium", "high"]),
  markets: z.array(z.string().min(1)).min(2).max(4),
});

const TrendEnum = z.enum(["rising", "flat", "falling", "unknown"]);
const RiskEnum = z.enum(["low", "medium", "high", "unknown"]);

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

const WHITELIST_DOMAINS = [
  "zillow.com",
  "redfin.com",
  "realtor.com",
  "noradarealestate.com",
  "attomdata.com",
  "nar.realtor",
  "census.gov",
];

// ---------------- Phase 0: Normalization ----------------

const NORMALIZE_MAP: Record<string, string> = {
  "nyc": "New York Metro, NY",
  "new york": "New York Metro, NY",
  "new york city": "New York Metro, NY",
  "manhattan": "New York Metro, NY",
  "brooklyn": "New York Metro, NY",
  "queens": "New York Metro, NY",
  "bronx": "New York Metro, NY",
  "jersey city": "Jersey City, NJ",
  "la": "Los Angeles Metro, CA",
  "los angeles": "Los Angeles Metro, CA",
  "sf": "San Francisco Metro, CA",
  "san francisco": "San Francisco Metro, CA",
  "dc": "Washington DC Metro",
  "washington": "Washington DC Metro",
  "washington dc": "Washington DC Metro",
};

function normalizeMarket(input: string): { label: string; assumption?: string } {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  // Direct map
  if (NORMALIZE_MAP[lower]) {
    return { label: NORMALIZE_MAP[lower], assumption: `${trimmed}: assumed metro area.` };
  }
  // "City, ST" already canonical
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(trimmed)) {
    return { label: trimmed.replace(/\s+/g, " ") };
  }
  // No state hint -> add metro assumption
  if (!/,\s*[A-Z]{2}$/.test(trimmed)) {
    return { label: trimmed, assumption: `${trimmed}: ambiguous input — defaulted to metro/best-match.` };
  }
  return { label: trimmed };
}

// ---------------- Numeric parsing & sanity bounds ----------------

function parsePrice(s: string): number | null {
  if (!s || s.toLowerCase() === "n/a") return null;
  const cleaned = s.replace(/[\s,$]/g, "").toLowerCase();
  const m = cleaned.match(/(\d+(?:\.\d+)?)([km])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === "k") n *= 1_000;
  if (m[2] === "m") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

function parsePercent(s: string): number | null {
  if (!s || s.toLowerCase() === "n/a") return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function priceOk(s: string): boolean {
  const n = parsePrice(s);
  return n != null && n >= 50_000 && n <= 5_000_000;
}
function yieldOk(s: string): boolean {
  const n = parsePercent(s);
  return n != null && n >= 0.5 && n <= 25;
}
function apprOk(s: string): boolean {
  const n = parsePercent(s);
  return n != null && n >= -50 && n <= 300;
}

function isMissing(v: string | undefined): boolean {
  return !v || v.trim() === "" || v.trim().toLowerCase() === "n/a" || /see source|varies|unknown/i.test(v);
}

// ---------------- Perplexity calls ----------------

const PPLX_URL = "https://api.perplexity.ai/chat/completions";

async function pplx(args: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  schema: object;
  schemaName: string;
  domainWhitelist?: string[];
  recency?: "day" | "week" | "month" | "year";
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<any | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), args.timeoutMs ?? 25_000);
  try {
    const body: any = {
      model: "sonar",
      temperature: 0.1,
      max_tokens: args.maxTokens ?? 900,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: args.schemaName, schema: args.schema },
      },
    };
    if (args.domainWhitelist?.length) body.search_domain_filter = args.domainWhitelist;
    if (args.recency) body.search_recency_filter = args.recency;

    const res = await fetch(PPLX_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      log.warn("pplx non-ok", res.status, txt.slice(0, 200));
      return null;
    }
    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return { parsed: JSON.parse(cleaned), citations: json?.citations ?? [] };
    } catch (e) {
      log.warn("pplx parse failed", String(e), cleaned.slice(0, 200));
      return null;
    }
  } catch (e) {
    log.warn("pplx fetch error", String(e));
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------------- Per-market row schema for Perplexity ----------------

const ROW_JSON_SCHEMA = {
  type: "object",
  properties: {
    medianPrice: { type: "string" },
    rentalYield: { type: "string" },
    appreciation5y: { type: "string" },
    inventoryTrend: { type: "string", enum: ["rising", "flat", "falling", "unknown"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["medianPrice", "rentalYield", "appreciation5y", "inventoryTrend", "riskLevel"],
};

const PARTIAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    medianPrice: { type: "string" },
    rentalYield: { type: "string" },
    appreciation5y: { type: "string" },
    inventoryTrend: { type: "string", enum: ["rising", "flat", "falling", "unknown"] },
    riskLevel: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    sources: { type: "array", items: { type: "string" } },
  },
};

const ROW_SYSTEM = `You are a US real-estate data extractor. Return STRICT JSON only matching the requested schema. Use ONLY figures supported by your search results. Use rounded numbers prefixed with "~" (e.g. "~$285k", "~7.1%"). For any unknown field output the literal string "n/a". Do not invent. Currency in USD with k/M suffix.`;

type Row = {
  market: string;
  medianPrice: string;
  rentalYield: string;
  appreciation5y: string;
  inventoryTrend: "rising" | "flat" | "falling" | "unknown";
  riskLevel: "low" | "medium" | "high" | "unknown";
};

function emptyRow(label: string): Row {
  return {
    market: label,
    medianPrice: "n/a",
    rentalYield: "n/a",
    appreciation5y: "n/a",
    inventoryTrend: "unknown",
    riskLevel: "unknown",
  };
}

function mergeRow(base: Row, patch: any): { row: Row; usedFields: string[] } {
  const used: string[] = [];
  const out = { ...base };
  const tryField = (key: keyof Row, validator?: (v: string) => boolean) => {
    const v = patch?.[key];
    if (typeof v !== "string") return;
    if (isMissing(v)) return;
    if (validator && !validator(v)) return;
    if (!isMissing(out[key] as string) && (out[key] as string) !== "unknown") return;
    (out as any)[key] = v.trim();
    used.push(key);
  };
  tryField("medianPrice", priceOk);
  tryField("rentalYield", yieldOk);
  tryField("appreciation5y", apprOk);
  // inventoryTrend / riskLevel: accept enum values
  if (typeof patch?.inventoryTrend === "string" && ["rising", "flat", "falling"].includes(patch.inventoryTrend)) {
    if (out.inventoryTrend === "unknown") {
      out.inventoryTrend = patch.inventoryTrend;
      used.push("inventoryTrend");
    }
  }
  if (typeof patch?.riskLevel === "string" && ["low", "medium", "high"].includes(patch.riskLevel)) {
    if (out.riskLevel === "unknown") {
      out.riskLevel = patch.riskLevel as any;
      used.push("riskLevel");
    }
  }
  return { row: out, usedFields: used };
}

function missingFields(row: Row): string[] {
  const m: string[] = [];
  if (isMissing(row.medianPrice) || !priceOk(row.medianPrice)) m.push("medianPrice");
  if (isMissing(row.rentalYield) || !yieldOk(row.rentalYield)) m.push("rentalYield");
  if (isMissing(row.appreciation5y) || !apprOk(row.appreciation5y)) m.push("appreciation5y");
  if (row.inventoryTrend === "unknown") m.push("inventoryTrend");
  if (row.riskLevel === "unknown") m.push("riskLevel");
  return m;
}

// Geographic fallback: city -> metro/county
function expandGeo(label: string): string | null {
  // already a metro/county
  if (/metro|county/i.test(label)) return null;
  const m = label.match(/^([^,]+),\s*([A-Z]{2})$/);
  if (!m) return null;
  return `${m[1].trim()} Metro, ${m[2]}`;
}

// ---------------- Phase 1: per-market fetch with retry ladder ----------------

async function fetchMarket(
  apiKey: string,
  rawInput: string,
  label: string,
): Promise<{ row: Row; sources: string[]; notes: string[] }> {
  const notes: string[] = [];
  const sources: string[] = [];
  let row = emptyRow(label);

  // 1.A — whitelist + recency
  const baseUser = `Provide current US real-estate metrics for: ${label}.
Required fields: medianPrice (USD), rentalYield (gross %), appreciation5y (% over last ~5 years), inventoryTrend (rising/flat/falling), riskLevel (low/medium/high), sources (URLs you used).
Return ONLY the JSON object.`;

  const r1 = await pplx({
    apiKey,
    systemPrompt: ROW_SYSTEM,
    userPrompt: baseUser,
    schema: ROW_JSON_SCHEMA,
    schemaName: "market_row",
    domainWhitelist: WHITELIST_DOMAINS,
    recency: "year",
    timeoutMs: 22_000,
  });
  if (r1?.parsed) {
    const merged = mergeRow(row, r1.parsed);
    row = merged.row;
    if (Array.isArray(r1.parsed.sources)) sources.push(...r1.parsed.sources);
    if (Array.isArray(r1.citations)) sources.push(...r1.citations);
  }

  // 1.B — broaden sources, only missing fields
  let miss = missingFields(row);
  if (miss.length) {
    const r2 = await pplx({
      apiKey,
      systemPrompt: ROW_SYSTEM,
      userPrompt: `For ${label}, fill ONLY these missing US real-estate fields: ${miss.join(", ")}.
Return JSON with just those keys (use "n/a" if truly unavailable). Include sources.`,
      schema: PARTIAL_JSON_SCHEMA,
      schemaName: "market_row_partial",
      recency: "year",
      timeoutMs: 18_000,
    });
    if (r2?.parsed) {
      const merged = mergeRow(row, r2.parsed);
      row = merged.row;
      if (Array.isArray(r2.parsed.sources)) sources.push(...r2.parsed.sources);
      if (Array.isArray(r2.citations)) sources.push(...r2.citations);
    }
  }

  // 1.C — targeted metric fetch for stubborn fields
  miss = missingFields(row);
  if (miss.length) {
    const targeted: string[] = [];
    if (miss.includes("rentalYield")) targeted.push(`typical gross rental yield in ${label}`);
    if (miss.includes("appreciation5y")) targeted.push(`home price appreciation over last 5 years in ${label}`);
    if (miss.includes("inventoryTrend")) targeted.push(`housing inventory trend in ${label}`);
    if (miss.includes("medianPrice")) targeted.push(`current median home price in ${label}`);
    if (miss.includes("riskLevel")) targeted.push(`investment risk level (low/medium/high) for residential rentals in ${label}`);
    if (targeted.length) {
      const r3 = await pplx({
        apiKey,
        systemPrompt: ROW_SYSTEM,
        userPrompt: `Look up: ${targeted.join("; ")}.
Return JSON with the corresponding fields (${miss.join(", ")}). Include sources.`,
        schema: PARTIAL_JSON_SCHEMA,
        schemaName: "market_row_targeted",
        recency: "year",
        timeoutMs: 18_000,
      });
      if (r3?.parsed) {
        const merged = mergeRow(row, r3.parsed);
        row = merged.row;
        if (Array.isArray(r3.parsed.sources)) sources.push(...r3.parsed.sources);
        if (Array.isArray(r3.citations)) sources.push(...r3.citations);
      }
    }
  }

  // 1.D — geographic fallback (city -> metro)
  miss = missingFields(row);
  if (miss.length) {
    const geo = expandGeo(label);
    if (geo) {
      const r4 = await pplx({
        apiKey,
        systemPrompt: ROW_SYSTEM,
        userPrompt: `Use ${geo} as a proxy for ${label}. Fill ONLY these fields: ${miss.join(", ")}. Include sources.`,
        schema: PARTIAL_JSON_SCHEMA,
        schemaName: "market_row_metro",
        recency: "year",
        timeoutMs: 18_000,
      });
      if (r4?.parsed) {
        const before = { ...row };
        const merged = mergeRow(row, r4.parsed);
        row = merged.row;
        if (merged.usedFields.length) {
          notes.push(`Used metro-level data (${geo}) for ${label}.`);
        }
        if (Array.isArray(r4.parsed.sources)) sources.push(...r4.parsed.sources);
        if (Array.isArray(r4.citations)) sources.push(...r4.citations);
      }
    }
  }

  return { row, sources: Array.from(new Set(sources)).slice(0, 6), notes };
}

// ---------------- Phase 2: comparative synthesis (no new search) ----------------

const SYNTH_SCHEMA = {
  type: "object",
  properties: {
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
    insight: { type: "string" },
    insightBullets: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "insight", "insightBullets"],
};

async function synthesize(
  apiKey: string,
  table: Row[],
  budget: number,
  goal: string,
  horizon: string,
  risk: string,
): Promise<any | null> {
  const sys = `You are a US real-estate investment advisor. You receive a comparison table as JSON and the investor's profile. Produce a decision-first verdict and a concise insight grounded ONLY in the data provided. Do NOT invent figures. If a metric is "n/a", reason around the gap. Each verdict winner MUST be one of the exact normalized labels from the table (table[].market). Insight (markdown, 4–7 sentences) MUST include: at least one risk per market, at least one opportunity per market, and at least one explicit cross-market trade-off. insightBullets: 2–3 high-signal decision-oriented bullets (>=40 chars).`;

  const user = `Investor profile:
- Budget: $${budget.toLocaleString("en-US")}
- Goal: ${GOAL_LABEL[goal]}
- Horizon: ${HORIZON_LABEL[horizon]}
- Risk: ${RISK_LABEL[risk]}

Comparison table:
${JSON.stringify(table, null, 2)}

Return STRICT JSON: { verdict, insight, insightBullets }.`;

  // No domain filter / recency — pure synthesis. Use sonar with low temp.
  const res = await pplx({
    apiKey,
    systemPrompt: sys,
    userPrompt: user,
    schema: SYNTH_SCHEMA,
    schemaName: "market_synthesis",
    timeoutMs: 18_000,
    maxTokens: 1100,
  });
  return res?.parsed ?? null;
}

// ---------------- Bullet quality gate ----------------

function bulletLooksGood(b: string): boolean {
  const t = b.trim();
  if (t.length < 30) return false;
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
  if (picked.length < 2) {
    const head = insight.replace(/\s+/g, " ").trim().slice(0, 220);
    if (head && !picked.includes(head)) picked.push(head);
  }
  return picked.slice(0, 3);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ---------------- Handler ----------------

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
    if (!PERPLEXITY_API_KEY) return errorResponse("PERPLEXITY_API_KEY is not configured", 500);

    // Phase 0 — normalize, preserve order
    const normalized = markets.map((m) => {
      const n = normalizeMarket(m);
      return { input: m, label: n.label, assumption: n.assumption };
    });
    const dataNotes: string[] = [];
    for (const n of normalized) if (n.assumption) dataNotes.push(n.assumption);

    log.step("phase0", { normalized: normalized.map((n) => n.label) });

    // Phase 1 — parallel fetch with retry ladder
    const results = await Promise.all(
      normalized.map((n) => fetchMarket(PERPLEXITY_API_KEY, n.input, n.label)),
    );

    const table: Row[] = results.map((r) => r.row);

    // Source tracking
    results.forEach((r, i) => {
      const hosts = Array.from(new Set(r.sources.map(hostnameOf).filter(Boolean))).slice(0, 4);
      if (hosts.length) {
        dataNotes.push(`${normalized[i].label}: data via ${hosts.join(", ")}.`);
      }
      for (const note of r.notes) dataNotes.push(note);
      const stillMissing = missingFields(r.row);
      if (stillMissing.length) {
        dataNotes.push(`${normalized[i].label}: no reliable data for ${stillMissing.join(", ")} — showing n/a.`);
      }
    });

    log.step("phase1.done", {
      filled: table.map((r, i) => ({ m: r.market, missing: missingFields(r) })),
    });

    // Phase 2 — synthesis
    const synth = await synthesize(PERPLEXITY_API_KEY, table, budget, goal, horizon, risk);

    const labels = normalized.map((n) => n.label);
    const fallbackVerdict = {
      cashFlow: labels[0] ?? "n/a",
      appreciation: labels[0] ?? "n/a",
      bestFit: labels[0] ?? "n/a",
      rationale: "Verdict synthesis unavailable — review the comparison table.",
    };

    const verdict = synth?.verdict ?? fallbackVerdict;
    const insight: string = typeof synth?.insight === "string" && synth.insight.trim()
      ? synth.insight
      : "Insight synthesis unavailable. Review the comparison table for the key metrics across each market.";

    let bullets: string[] = Array.isArray(synth?.insightBullets)
      ? synth.insightBullets.map((b: string) => b.replace(/^[-*•]\s*/, "").trim()).filter(Boolean)
      : [];
    const seen = new Set<string>();
    bullets = bullets.filter(bulletLooksGood).filter((b) => {
      const k = b.toLowerCase().slice(0, 50);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 3);
    if (bullets.length < 2) bullets = synthesizeBullets(insight, labels);
    if (bullets.length === 0) bullets = [insight.replace(/\s+/g, " ").trim().slice(0, 200)];

    return jsonResponse({
      verdict,
      table,
      insight,
      insightBullets: bullets,
      dataNotes,
      normalizedLabels: labels,
    });
  } catch (error) {
    log.error("unhandled", error);
    return errorResponse(getErrorMessage(error), 500);
  }
});
