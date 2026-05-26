import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireEnv, optionalEnv } from '../_shared/env.ts';
import {
  computeMetrics,
  computeRoi,
  computeBuyingPower,
  projectAmortizationSchedule,
} from '../_shared/calcEngine.ts';

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are HomeLens Investor Console. You answer the user's US real-estate
investment questions by calling the provided tools and narrating the result.

Rules:
- Prefer tools over arithmetic in prose. If the user asks for any number, call a tool.
- Choose tools by intent. "ROI?" usually needs compute_roi + compute_metrics + get_market_stats.
- For multi-part questions, call multiple tools in parallel before replying.
- Be concise (2-4 short paragraphs max). Reference tool outputs by anchor in [Card Name] brackets, e.g. "see [Metrics Grid]".
- Never invent property data. If asked about a property you cannot look up, ask which one or call list_listings.
- Never include MATCH_SCORE prefixes; this surface is the Investor Console, not property analysis.`;

// ──────────────────────────────────────────────────────────────────────────────
// Tool definitions (OpenAI/Gemini compatible JSON Schema)
// ──────────────────────────────────────────────────────────────────────────────

type Json = Record<string, any>;

interface Tool {
  name: string;
  description: string;
  parameters: Json;
  execute: (input: any, ctx: ExecutionContext) => Promise<any>;
}

interface ExecutionContext {
  userId: string;
  supabase: ReturnType<typeof createClient>;
  serviceSupabase: ReturnType<typeof createClient>;
}

const TOOLS: Tool[] = [
  {
    name: 'compute_metrics',
    description:
      'Compute cap rate, cash-on-cash, NOI, and monthly cash flow for a property purchase. Use whenever the user asks about returns, cash flow, or profitability of a specific price/rent/financing combo.',
    parameters: {
      type: 'object',
      properties: {
        price: { type: 'number', description: 'Purchase price in USD' },
        monthlyRent: { type: 'number', description: 'Gross monthly rent (estimated if omitted)' },
        market: { type: 'string', description: 'City, ST — used to look up defaults' },
        financing: {
          type: 'object',
          properties: {
            downPct: { type: 'number' },
            rateApr: { type: 'number' },
            termYears: { type: 'number' },
          },
        },
        operating: {
          type: 'object',
          properties: {
            vacancyPct: { type: 'number' },
            propertyTaxYearly: { type: 'number' },
            insuranceYearly: { type: 'number' },
            maintenancePctOfRent: { type: 'number' },
            managementPctOfRent: { type: 'number' },
          },
        },
      },
      required: ['price'],
    },
    execute: async (input) => computeMetrics(input),
  },
  {
    name: 'compute_roi',
    description:
      'Compute multi-year ROI: year-by-year cash flow, equity buildup, appreciation, IRR. Use when the user asks about "ROI", "return over N years", or "if I hold for X years".',
    parameters: {
      type: 'object',
      properties: {
        price: { type: 'number' },
        monthlyRent: { type: 'number' },
        market: { type: 'string' },
        holdYears: { type: 'number' },
        appreciationYoy: { type: 'number', description: 'e.g. 0.04 = 4%/yr' },
        rentGrowthYoy: { type: 'number' },
        financing: { type: 'object' },
        operating: { type: 'object' },
      },
      required: ['price', 'holdYears'],
    },
    execute: async (input) => computeRoi(input),
  },
  {
    name: 'compute_buying_power',
    description:
      'Given the user\'s cash, compute how many listings in each market they can afford and where median price sits relative to their reach.',
    parameters: {
      type: 'object',
      properties: {
        cashAvailable: { type: 'number' },
        downPct: { type: 'number' },
        rateApr: { type: 'number' },
        termYears: { type: 'number' },
        markets: {
          type: 'array',
          items: { type: 'string', description: 'Market name e.g. "Austin, TX"' },
        },
      },
      required: ['cashAvailable', 'markets'],
    },
    execute: async (input, ctx) => {
      const markets = await loadMarketSnapshots(ctx, input.markets);
      return computeBuyingPower({
        cashAvailable: input.cashAvailable,
        downPct: input.downPct,
        rateApr: input.rateApr,
        termYears: input.termYears,
        markets,
      });
    },
  },
  {
    name: 'project_amortization',
    description:
      'Project a mortgage amortization schedule: principal vs interest per year, remaining balance, totals.',
    parameters: {
      type: 'object',
      properties: {
        price: { type: 'number' },
        downPct: { type: 'number' },
        rateApr: { type: 'number' },
        termYears: { type: 'number' },
      },
      required: ['price'],
    },
    execute: async (input) => {
      const downPct = input.downPct ?? 0.25;
      const rateApr = input.rateApr ?? 0.07;
      const termYears = input.termYears ?? 30;
      const loanAmount = input.price * (1 - downPct);
      return projectAmortizationSchedule(loanAmount, rateApr, termYears);
    },
  },
  {
    name: 'get_market_stats',
    description:
      'Look up market-level stats: median list price, median rent, appreciation, rent growth, vacancy, days on market. Cached daily. Triggers a fresh Perplexity lookup on cache miss.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => {
      const stats = await getMarketStats(ctx, input.market);
      return stats;
    },
  },
  {
    name: 'list_listings',
    description:
      'List active properties in a market matching the user\'s filters. Returns address, price, beds/baths/sqft, estimated cap rate.',
    parameters: {
      type: 'object',
      properties: {
        market: { type: 'string' },
        maxPrice: { type: 'number' },
        minPrice: { type: 'number' },
        minBeds: { type: 'number' },
        minBaths: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['market'],
    },
    execute: async (input, ctx) => listListings(ctx, input),
  },
  {
    name: 'compare_properties',
    description:
      'Compare N properties side-by-side on key metrics. Highlights the winner per metric.',
    parameters: {
      type: 'object',
      properties: {
        propertyIds: { type: 'array', items: { type: 'string' } },
        metrics: { type: 'array', items: { type: 'string' } },
      },
      required: ['propertyIds'],
    },
    execute: async (input, ctx) => compareProperties(ctx, input),
  },
  {
    name: 'show_reduction_heatmap',
    description:
      'Show where price reductions are clustering across the requested markets, ZIP × week.',
    parameters: {
      type: 'object',
      properties: {
        markets: { type: 'array', items: { type: 'string' } },
        weeks: { type: 'number', default: 8 },
      },
      required: ['markets'],
    },
    execute: async (_input) => ({
      rows: [],
      maxIntensity: 0,
      note: 'Reduction heatmap data is being indexed. Surface coming online — for now ask the brief for snapshot insights.',
    }),
  },
  {
    name: 'find_comparable_sales',
    description:
      'Find recent comparable sales in a market matching beds/baths/sqft range. Returns sale price, date, $/sqft.',
    parameters: {
      type: 'object',
      properties: {
        market: { type: 'string' },
        beds: { type: 'number' },
        baths: { type: 'number' },
        sqftMin: { type: 'number' },
        sqftMax: { type: 'number' },
        lookbackDays: { type: 'number', default: 90 },
        limit: { type: 'number', default: 8 },
      },
      required: ['market'],
    },
    execute: async (input, ctx) => findComparableSales(ctx, input),
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Persona-priority tools (8 new) — affordability, ARV, flip spread,
// neighborhood quality, migration, employment, absorption, supply pipeline.
// ──────────────────────────────────────────────────────────────────────────────

TOOLS.push(
  {
    name: 'compute_affordability_index',
    description:
      'Compute an affordability index for a buyer: max home price they can afford given income, debt, down payment, and rate. Returns max price, PITI breakdown, DTI, and a 0–100 score (100 = very comfortable, <50 = stretched).',
    parameters: {
      type: 'object',
      properties: {
        annualIncome: { type: 'number' },
        monthlyDebt: { type: 'number', description: 'Existing monthly debt payments' },
        downPayment: { type: 'number' },
        rateApr: { type: 'number', description: 'e.g. 0.07 for 7%' },
        termYears: { type: 'number', default: 30 },
        propertyTaxRate: { type: 'number', description: 'Yearly, e.g. 0.018 for 1.8%' },
        insuranceYearly: { type: 'number' },
        hoaMonthly: { type: 'number' },
        targetPrice: { type: 'number', description: 'Optional — score this specific price' },
      },
      required: ['annualIncome'],
    },
    execute: async (input) => computeAffordabilityIndex(input),
  },
  {
    name: 'estimate_arv',
    description:
      'Estimate After-Repair Value for a flip. Uses recent comp medians (or supplied comps) and a renovation tier multiplier.',
    parameters: {
      type: 'object',
      properties: {
        market: { type: 'string' },
        beds: { type: 'number' },
        baths: { type: 'number' },
        sqft: { type: 'number' },
        renovationTier: { type: 'string', enum: ['light', 'standard', 'heavy'] },
      },
      required: ['market', 'sqft'],
    },
    execute: async (input, ctx) => estimateArv(ctx, input),
  },
  {
    name: 'compute_flip_spread',
    description:
      'Compute the flip spread: ARV minus purchase, renovation, holding, and selling costs. Returns gross profit, ROI, and a go/no-go signal.',
    parameters: {
      type: 'object',
      properties: {
        purchasePrice: { type: 'number' },
        renovationCost: { type: 'number' },
        arv: { type: 'number' },
        holdMonths: { type: 'number', default: 6 },
        sellingCostPct: { type: 'number', default: 0.08 },
        carryingCostMonthly: { type: 'number' },
      },
      required: ['purchasePrice', 'renovationCost', 'arv'],
    },
    execute: async (input) => computeFlipSpread(input),
  },
  {
    name: 'get_neighborhood_quality',
    description:
      'Look up neighborhood-quality signals for a market or ZIP: school rating proxy, crime index, walkability. Sourced from Perplexity when external APIs unavailable.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' }, zip: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => getNeighborhoodQuality(ctx, input),
  },
  {
    name: 'get_migration_trends',
    description:
      'Net migration into/out of a metro area over the last 5 years. Uses Census ACS B07001 (geographic mobility) when available; falls back to Perplexity.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => getMigrationTrends(ctx, input),
  },
  {
    name: 'get_employment_trends',
    description:
      'Employment & unemployment trends for a metro area over the last 24 months. Uses BLS LAUS (no key required for basic queries); falls back to Perplexity.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => getEmploymentTrends(ctx, input),
  },
  {
    name: 'get_absorption_rate',
    description:
      'Absorption rate (months of supply) for a market. Lower = seller market, higher = buyer market. Computed from active listings ÷ monthly sales pace.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => getAbsorptionRate(ctx, input),
  },
  {
    name: 'get_supply_pipeline',
    description:
      'Construction pipeline for a metro: building permits issued (last 12 months) + new housing starts. Uses Census Building Permits Survey when CENSUS_API_KEY is set.',
    parameters: {
      type: 'object',
      properties: { market: { type: 'string' } },
      required: ['market'],
    },
    execute: async (input, ctx) => getSupplyPipeline(ctx, input),
  },
);

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// ──────────────────────────────────────────────────────────────────────────────
// DB-backed tool helpers
// ──────────────────────────────────────────────────────────────────────────────

async function loadMarketSnapshots(ctx: ExecutionContext, marketNames: string[]) {
  const out: { name: string; medianListPrice: number; totalListings: number }[] = [];
  for (const name of marketNames) {
    const stats = await getMarketStats(ctx, name);
    out.push({
      name,
      medianListPrice: Number(stats.medianListPrice) || 400000,
      totalListings: Number(stats.activeListings) || 200,
    });
  }
  return out;
}

async function getMarketStats(ctx: ExecutionContext, market: string) {
  const normalized = market.trim();
  const { data: cached } = await ctx.serviceSupabase
    .from('market_stats')
    .select('*')
    .eq('market', normalized)
    .maybeSingle();

  const isFresh = cached && Date.now() - new Date(cached.refreshed_at).getTime() < 24 * 60 * 60 * 1000;
  if (isFresh) {
    return toMarketStatsOutput(cached);
  }

  // Perplexity fallback
  const fresh = await fetchMarketStatsFromPerplexity(normalized);
  if (fresh) {
    await ctx.serviceSupabase.from('market_stats').upsert({
      market: normalized,
      ...fresh,
      source: 'perplexity',
      refreshed_at: new Date().toISOString(),
    });
    return toMarketStatsOutput({ market: normalized, ...fresh, source: 'perplexity', refreshed_at: new Date().toISOString() });
  }

  if (cached) return toMarketStatsOutput(cached);
  return {
    market: normalized,
    medianListPrice: null,
    medianRentMonthly: null,
    appreciationYoy: null,
    rentGrowthYoy: null,
    vacancyRate: null,
    daysOnMarketMedian: null,
    activeListings: null,
    refreshedAt: null,
    source: 'unavailable',
    error: 'Market stats not yet available for this market.',
  };
}

function toMarketStatsOutput(row: any) {
  return {
    market: row.market,
    medianListPrice: row.median_list_price ?? null,
    medianRentMonthly: row.median_rent_monthly ?? null,
    appreciationYoy: row.appreciation_yoy ?? null,
    rentGrowthYoy: row.rent_growth_yoy ?? null,
    vacancyRate: row.vacancy_rate ?? null,
    daysOnMarketMedian: row.days_on_market_median ?? null,
    activeListings: row.active_listings ?? null,
    refreshedAt: row.refreshed_at,
    source: row.source ?? null,
  };
}

async function fetchMarketStatsFromPerplexity(market: string): Promise<Json | null> {
  const apiKey = optionalEnv('PERPLEXITY_API_KEY');
  if (!apiKey) return null;
  const prompt = `For the US real estate market "${market}", return ONLY a compact JSON object with these keys (no prose, no markdown):
median_list_price (number, USD),
median_rent_monthly (number, USD),
appreciation_yoy (number, decimal, e.g. 0.058 for 5.8%),
rent_growth_yoy (number, decimal),
vacancy_rate (number, decimal),
days_on_market_median (integer),
active_listings (integer).
If a value is unknown, use null.`;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const jsonText = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (e) {
    console.error('Perplexity market_stats failed:', e);
    return null;
  }
}

async function listListings(ctx: ExecutionContext, input: any) {
  const limit = Math.min(input.limit ?? 10, 25);
  let q = ctx.serviceSupabase.from('properties').select('*').eq('status', 'active').limit(limit);
  if (input.market) {
    const [city, state] = input.market.split(',').map((s: string) => s.trim());
    if (city) q = q.ilike('city', city);
    if (state) q = q.ilike('state', state);
  }
  if (input.maxPrice) q = q.lte('price', input.maxPrice);
  if (input.minPrice) q = q.gte('price', input.minPrice);
  if (input.minBeds) q = q.gte('beds', input.minBeds);
  if (input.minBaths) q = q.gte('baths', input.minBaths);
  const { data, error } = await q;
  if (error) return { listings: [], total: 0, error: error.message };
  const listings = (data ?? []).map((p: any) => {
    const m = computeMetrics({ price: Number(p.price) });
    return {
      id: p.id,
      address: `${p.address}, ${p.city}, ${p.state}`,
      price: Number(p.price),
      beds: p.beds,
      baths: Number(p.baths),
      sqft: p.sqft,
      capRate: m.capRate,
      daysOnMarket: p.list_date
        ? Math.floor((Date.now() - new Date(p.list_date).getTime()) / 86400000)
        : null,
      thumbUrl: p.image_urls?.[0] ?? null,
    };
  });
  return { listings, total: listings.length, market: input.market };
}

async function compareProperties(ctx: ExecutionContext, input: any) {
  const ids: string[] = input.propertyIds ?? [];
  if (!ids.length) return { rows: [], winnerByMetric: {}, error: 'No property IDs supplied' };
  const { data, error } = await ctx.serviceSupabase
    .from('properties')
    .select('*')
    .in('id', ids);
  if (error) return { rows: [], winnerByMetric: {}, error: error.message };
  const rows = (data ?? []).map((p: any) => {
    const m = computeMetrics({ price: Number(p.price) });
    return {
      propertyId: p.id,
      address: `${p.address}, ${p.city}, ${p.state}`,
      price: Number(p.price),
      capRate: m.capRate,
      monthlyCashFlow: m.monthlyCashFlow,
      noi: m.noi,
      pricePerSqft: p.sqft ? Number(p.price) / p.sqft : null,
    };
  });
  const winnerByMetric: Record<string, string> = {};
  const metrics = ['capRate', 'monthlyCashFlow', 'noi'];
  for (const metric of metrics) {
    let best: any = null;
    for (const r of rows) {
      if (best === null || (r as any)[metric] > (best as any)[metric]) best = r;
    }
    if (best) winnerByMetric[metric] = best.propertyId;
  }
  return { rows, winnerByMetric };
}

async function findComparableSales(ctx: ExecutionContext, input: any) {
  return {
    comps: [],
    stats: { medianPricePerSqft: null, avgDaysOnMarket: null },
    note: 'Comparable sales index is being built. Try get_market_stats for now.',
    market: input.market,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// SSE
// ──────────────────────────────────────────────────────────────────────────────

function sseEvent(event: string, data: Json): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ──────────────────────────────────────────────────────────────────────────────
// LLM tool-use loop (via Lovable AI Gateway, OpenAI-compatible)
// ──────────────────────────────────────────────────────────────────────────────

async function callGateway(messages: any[], stream = false) {
  const apiKey = requireEnv('LOVABLE_API_KEY');
  const body = {
    model: MODEL,
    messages,
    tools: TOOLS.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
    stream,
  };
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway ${res.status}: ${text}`);
  }
  return res;
}

// ──────────────────────────────────────────────────────────────────────────────
// Server
// ──────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = optionalEnv('SUPABASE_ANON_KEY') ?? '';

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userSupabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceSupabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid auth' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { threadId, messages, activeCardContext } = payload as {
    threadId?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    activeCardContext?: any;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ensure thread
  let effectiveThreadId = threadId;
  if (!effectiveThreadId) {
    const { data: newThread, error: tErr } = await userSupabase
      .from('investor_console_threads')
      .insert({ user_id: userId, title: messages[messages.length - 1].content.slice(0, 80) })
      .select('id')
      .single();
    if (tErr) {
      return new Response(JSON.stringify({ error: tErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    effectiveThreadId = newThread.id;
  }

  // Persist user message
  const userMessage = messages[messages.length - 1];
  await userSupabase.from('investor_chat_messages').insert({
    thread_id: effectiveThreadId,
    role: 'user',
    content: userMessage.content,
    active_card_context: activeCardContext ?? null,
  });

  // Load persona for system-prompt injection (best-effort).
  let personaContext: { persona: string; secondary: string[] } = { persona: 'mixed', secondary: [] };
  try {
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('persona, persona_secondary')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.persona) personaContext.persona = profile.persona;
    if (Array.isArray(profile?.persona_secondary)) personaContext.secondary = profile.persona_secondary;
  } catch (_e) { /* ignore */ }

  const ctx: ExecutionContext = { userId, supabase: userSupabase, serviceSupabase };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Json) => controller.enqueue(sseEvent(event, data));
      send('thread', { threadId: effectiveThreadId });

      let convo: any[] = [
        { role: 'system', content: buildSystemPrompt(activeCardContext, personaContext) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const collectedToolCalls: any[] = [];
      const collectedToolResults: any[] = [];
      let finalText = '';

      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const res = await callGateway(convo, false);
          const data = await res.json();
          const choice = data.choices?.[0];
          if (!choice) break;

          const assistantMsg = choice.message;
          const content: string = assistantMsg?.content ?? '';
          const toolCalls: any[] = assistantMsg?.tool_calls ?? [];

          if (content) {
            send('text_delta', { delta: content });
            finalText += content;
          }

          if (!toolCalls.length) break;

          // Append assistant tool-call message to convo
          convo.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls,
          });

          // Emit tool_use_start for each and execute in parallel
          const results = await Promise.all(
            toolCalls.map(async (tc) => {
              const name = tc.function?.name;
              let input: any = {};
              try {
                input = JSON.parse(tc.function?.arguments ?? '{}');
              } catch {}
              send('tool_use_start', { id: tc.id, name, input });
              const tool = TOOL_BY_NAME.get(name);
              if (!tool) {
                const err = `Unknown tool: ${name}`;
                send('tool_use_error', { id: tc.id, error: err });
                collectedToolResults.push({ id: tc.id, name, error: err });
                return { tool_call_id: tc.id, content: JSON.stringify({ error: err }) };
              }
              try {
                const output = await tool.execute(input, ctx);
                send('tool_use_result', { id: tc.id, name, output });
                collectedToolCalls.push({ id: tc.id, name, input });
                collectedToolResults.push({ id: tc.id, name, output });
                return { tool_call_id: tc.id, content: JSON.stringify(output) };
              } catch (e) {
                const err = e instanceof Error ? e.message : String(e);
                send('tool_use_error', { id: tc.id, error: err });
                collectedToolResults.push({ id: tc.id, name, error: err });
                return { tool_call_id: tc.id, content: JSON.stringify({ error: err }) };
              }
            }),
          );

          for (const r of results) {
            convo.push({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content });
          }
        }

        // Persist assistant message
        const { data: persisted } = await userSupabase
          .from('investor_chat_messages')
          .insert({
            thread_id: effectiveThreadId,
            role: 'assistant',
            content: finalText,
            tool_calls: collectedToolCalls,
            tool_results: collectedToolResults,
            active_card_context: activeCardContext ?? null,
          })
          .select('id')
          .single();

        // Bump thread updated_at
        await userSupabase
          .from('investor_console_threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', effectiveThreadId);

        send('turn_done', { messageId: persisted?.id ?? null, threadId: effectiveThreadId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('investor-chat error:', msg);
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

const PERSONA_PRIORITY_KPIS: Record<string, string[]> = {
  first_time_buyer: ['affordability index', 'mortgage payment (PITI)', 'days on market', 'appreciation', 'school and crime trends'],
  rental_investor: ['cap rate', 'cash flow', 'occupancy', 'rent growth', 'taxes and insurance'],
  flipper: ['ARV', 'days on market', 'renovation spread', 'local appreciation', 'recent comps'],
  institutional: ['migration', 'employment growth', 'NOI', 'vacancy', 'absorption rate', 'permits and housing starts'],
  mixed: ['affordability', 'cap rate', 'cash flow', 'appreciation', 'market growth'],
};

function buildPersonaBlock(persona: string, secondary: string[]): string {
  const kpis = PERSONA_PRIORITY_KPIS[persona] ?? PERSONA_PRIORITY_KPIS.mixed;
  const secondaryNote = secondary.length
    ? `\nSecondary interests (lower weight): ${secondary.join(', ')}.`
    : '';
  return `\n\nThe user's investor persona is "${persona}".${secondaryNote}
Their priority KPIs are:
${kpis.map((k) => `- ${k}`).join('\n')}

When the user asks an open-ended question (e.g. "what should I look at?", "give me an overview"), prefer tools that surface these KPIs. For specific questions, answer those directly regardless of persona — persona is a bias, not a filter.`;
}

function buildSystemPrompt(activeCardContext?: any, personaContext?: { persona: string; secondary: string[] }) {
  const personaBlock = personaContext ? buildPersonaBlock(personaContext.persona, personaContext.secondary) : '';
  if (!activeCardContext) return SYSTEM_PROMPT + personaBlock;
  return `${SYSTEM_PROMPT}${personaBlock}

The user is investigating a brief card titled "${activeCardContext?.card?.title ?? 'unknown'}". Context: ${activeCardContext?.summary ?? ''}. Ground your answer in that card when relevant.`;
}