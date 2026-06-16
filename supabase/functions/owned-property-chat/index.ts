import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireEnv } from '../_shared/env.ts';
import {
  amortizedBalance,
  monthsBetween,
  getValuationCached,
  resolveRentcastTier,
  RentcastQuotaError,
  RentcastUpgradeRequiredError,
} from '../_shared/rentcast.ts';
import { enforceFeature } from '../_shared/tierGate.ts';
import { ciSignalsPromptBlock, ciBehaviorPromptBlock, extractCiSignals } from '../_shared/conversationalSignals.ts';
import { detectOpenHouseIntent, runOpenHouseLookup } from '../_shared/openHouses/intent.ts';
import { FOLLOWUP_TOOL_DEFS } from '../_shared/ai/tools/followups/index.ts';
import { MACRO_TOOL_DEFS } from '../_shared/ai/tools/macro/index.ts';
import { FOLLOWUP_CASCADE_PROMPT_BLOCK } from '../_shared/ai/followupSystemPrompt.ts';

const log = createLogger('owned-property-chat');

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT = `You are HomeLens Portfolio Advisor — an AI helping a US real-estate
investor reason about a single property they OWN. You receive the full property
context (purchase, loan, current value, rental, alerts, returns) up front.

Rules:
- Decision-first: open with a clear yes/no/likely conclusion when asked a decision question.
- Be concise: 1-3 sentences for factual, short paragraphs + bullets when comparing options.
- Use the actual numbers in the context. Never invent data.
- For live AVM / rent-market questions, CALL THE TOOLS (estimate_property_value,
  compare_rent_to_market). The user's property address + beds/baths/sqft are in
  PROPERTY CONTEXT — pre-fill the tool args from there, don't ask the user to repeat them.
- TOOL SUCCESS: when the tool returns numeric fields (value, rent, marketRent, low, high),
  USE THEM and cite "RentCast" as the source. Do not apply the error branches below.
- TOOL ERROR (only when the result has an "error" field):
  - error="upgrade_required" → reply with one sentence: "Live property valuations
    need a Buyer or Investor subscription." Do not retry the tool this turn.
  - error="quota_exceeded" → say they've hit today's RentCast cap; suggest revisiting tomorrow.
  - error="rentcast_failed" → say RentCast is temporarily unavailable and answer from the loaded context.
- Strictly US real-estate scoped. Warmly redirect off-topic queries.
- Never include "MATCH_SCORE" — this is the owner chat, not property analysis.`;

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return 'n/a';
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

function buildContext(p: any, rental: any, alerts: any[]): string {
  let balance = Number(p.loan_current_balance ?? 0);
  if (p.has_mortgage && p.loan_original_principal && p.loan_rate_apr && p.loan_term_years && p.loan_start_date) {
    const months = monthsBetween(new Date(p.loan_start_date), new Date());
    balance = amortizedBalance(
      Number(p.loan_original_principal),
      Number(p.loan_rate_apr),
      Number(p.loan_term_years),
      months,
    );
  }
  const value = Number(p.current_value_estimate ?? 0);
  const equity = value - balance;
  const apprec = value - Number(p.purchase_price ?? 0);

  const lines: string[] = [];
  lines.push(`PROPERTY`);
  lines.push(`Address: ${p.address_line1}, ${p.city}, ${p.state} ${p.zip}`);
  lines.push(`Type: ${p.property_type} | ${p.beds ?? '?'}bd/${p.baths ?? '?'}ba | ${p.sqft ?? '?'} sqft | built ${p.year_built ?? '?'}`);
  lines.push(`Primary residence: ${p.is_primary_residence ? 'yes' : 'no'} | Rented: ${p.is_rented ? 'yes' : 'no'}`);
  lines.push('');
  lines.push(`ACQUISITION`);
  lines.push(`Purchase: ${fmt(p.purchase_price)} on ${p.purchase_date}`);
  lines.push(`Down payment: ${fmt(p.down_payment)} | Closing costs: ${fmt(p.closing_costs)}`);
  lines.push('');
  lines.push(`LOAN`);
  if (p.has_mortgage) {
    lines.push(`Original principal: ${fmt(p.loan_original_principal)} @ ${p.loan_rate_apr}% APR / ${p.loan_term_years}yr (started ${p.loan_start_date})`);
    lines.push(`Estimated current balance: ${fmt(balance)}`);
  } else {
    lines.push(`Owned outright (no mortgage).`);
  }
  lines.push('');
  lines.push(`VALUATION & EQUITY`);
  lines.push(`Current value: ${fmt(value)} (source: ${p.current_value_source ?? 'n/a'}, refreshed ${p.current_value_refreshed_at ?? 'n/a'})`);
  lines.push(`Equity: ${fmt(equity)} | Total appreciation since purchase: ${fmt(apprec)}`);
  lines.push('');
  if (rental) {
    lines.push(`RENTAL`);
    lines.push(`Monthly rent: ${fmt(rental.monthly_rent)} | Market rent estimate: ${fmt(rental.market_rent_estimate)}`);
    lines.push(`Lease ends: ${rental.lease_end_date ?? 'n/a'} | Tenant since: ${rental.tenant_start_date ?? 'n/a'}`);
    if (rental.monthly_expenses) lines.push(`Monthly operating expenses: ${fmt(rental.monthly_expenses)}`);
    lines.push('');
  }
  if (alerts.length) {
    lines.push(`ACTIVE ALERTS`);
    for (const a of alerts) lines.push(`- [${a.severity}] ${a.title}: ${a.description}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// Tools (OpenAI / Gemini–compatible JSON Schema)
// ──────────────────────────────────────────────────────────────────────────────

type Json = Record<string, any>;

interface ToolExecCtx {
  userId: string;
  serviceSupabase: ReturnType<typeof createClient>;
  property: any;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Json;
  execute: (input: any, ctx: ToolExecCtx) => Promise<any>;
}

function addrFromProperty(p: any, override: Json = {}) {
  return {
    address_line1: override.address_line1 ?? p.address_line1,
    city: override.city ?? p.city,
    state: override.state ?? p.state,
    zip: override.zip ?? p.zip,
    beds: override.beds ?? p.beds ?? null,
    baths: override.baths ?? p.baths ?? null,
    sqft: override.sqft ?? p.sqft ?? null,
    property_type: override.propertyType ?? p.property_type,
  };
}

const TOOLS: ToolDef[] = [
  {
    name: 'estimate_property_value',
    description: `RentCast-backed value + rent estimate for the OWNED property (or another
US address if explicitly specified). Defaults to THIS property if no address is given.

Cached 24h. Counts against the user's daily RentCast quota (buyer 5, investor 50).

On error="upgrade_required" or "quota_exceeded": do NOT fabricate. Surface the
message and offer context from the loaded PROPERTY CONTEXT instead.`,
    parameters: {
      type: 'object',
      properties: {
        address_line1: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
        beds: { type: 'number' },
        baths: { type: 'number' },
        sqft: { type: 'number' },
        propertyType: { type: 'string' },
      },
    },
    execute: async (input, ctx) => {
      try {
        const tier = await resolveRentcastTier(ctx.serviceSupabase as any, ctx.userId);
        return await getValuationCached(
          ctx.serviceSupabase,
          ctx.userId,
          tier,
          addrFromProperty(ctx.property, input),
        );
      } catch (e) {
        if (e instanceof RentcastUpgradeRequiredError) {
          return {
            error: 'upgrade_required',
            tier: 'free',
            cta: 'Upgrade to Buyer or Investor for live RentCast valuations.',
          };
        }
        if (e instanceof RentcastQuotaError) {
          return { error: 'quota_exceeded', tier: e.tier, limit: e.limit, resetIn: '24h' };
        }
        return { error: 'rentcast_failed', message: (e as Error).message };
      }
    },
  },
  {
    name: 'compare_rent_to_market',
    description: `Compare the owned property's current rent vs RentCast market rent.
If currentRent is omitted, uses the rent loaded in PROPERTY CONTEXT.
Returns marketRent, range, $ delta, % delta, and verdict (below/at/above).

Same error contract as estimate_property_value.`,
    parameters: {
      type: 'object',
      properties: {
        currentRent: { type: 'number' },
        address_line1: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
        beds: { type: 'number' },
        baths: { type: 'number' },
        sqft: { type: 'number' },
      },
    },
    execute: async (input, ctx) => {
      try {
        const tier = await resolveRentcastTier(ctx.serviceSupabase as any, ctx.userId);
        const r = await getValuationCached(
          ctx.serviceSupabase,
          ctx.userId,
          tier,
          addrFromProperty(ctx.property, input),
        );
        if (r.rent == null) return { error: 'no_market_rent', cached: r.cached };
        const currentRent = Number(input.currentRent ?? ctx.property?.__rental_monthly_rent ?? 0);
        if (!currentRent) {
          return {
            marketRent: r.rent,
            marketRentLow: r.rentLow,
            marketRentHigh: r.rentHigh,
            note: 'No current rent on file. Returning market estimate only.',
            cached: r.cached,
            source: 'rentcast',
          };
        }
        const delta = currentRent - r.rent;
        const deltaPct = r.rent ? delta / r.rent : 0;
        let verdict: 'below' | 'at' | 'above' = 'at';
        if (deltaPct <= -0.05) verdict = 'below';
        else if (deltaPct >= 0.05) verdict = 'above';
        return {
          currentRent,
          marketRent: r.rent,
          marketRentLow: r.rentLow,
          marketRentHigh: r.rentHigh,
          delta: Math.round(delta),
          deltaPct: Number(deltaPct.toFixed(3)),
          verdict,
          cached: r.cached,
          source: 'rentcast',
        };
      } catch (e) {
        if (e instanceof RentcastUpgradeRequiredError) {
          return { error: 'upgrade_required', tier: 'free', cta: 'Upgrade to Buyer or Investor for live RentCast valuations.' };
        }
        if (e instanceof RentcastQuotaError) {
          return { error: 'quota_exceeded', tier: e.tier, limit: e.limit, resetIn: '24h' };
        }
        return { error: 'rentcast_failed', message: (e as Error).message };
      }
    },
  },
];

// Inject the v1 follow-up registry tools (test_buying_ability, find_fthb_programs,
// find_local_lenders, compare_properties, research_neighborhood). They use the
// same ToolDef contract; ctx is ignored.
for (const def of FOLLOWUP_TOOL_DEFS) {
  TOOLS.push(def as unknown as ToolDef);
}
// Macro intelligence tools (FRED): rates, Case-Shiller, macro context.
for (const def of MACRO_TOOL_DEFS) {
  TOOLS.push(def as unknown as ToolDef);
}

// ATTOM Data deferred — market-level comps stay on Perplexity + Sonnet for now.
// Revisit when MRR > $25K OR users explicitly request deeper comps/MLS-grade data.
// Cost reference: ATTOM tiers start at ~$500/mo. RentCast (Foundation, $74/mo)
// already covers AVM + rent estimates above. When a third "comp_search" tool
// is added here, evaluate ATTOM vs. RentCast /listings/rental first.

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

async function rawGateway(messages: any[]) {
  const apiKey = requireEnv('LOVABLE_API_KEY');
  const body = {
    model: MODEL,
    messages,
    tools: TOOLS.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
  };
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/** Pull top user memories for prompt injection. Parity with investor-chat. */
async function loadMemoryBlock(svc: ReturnType<typeof createClient>, userId: string): Promise<string> {
  try {
    const { data } = await svc
      .from('user_memories')
      .select('category, content, importance')
      .eq('user_id', userId)
      .eq('user_deleted', false)
      .order('importance', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(10);
    if (!data?.length) return '';
    const lines = data.map((m: any) => `- [${m.category}] ${m.content}`);
    return `\n\n--- USER MEMORY (top ${data.length}) ---\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const gate = await enforceFeature(req, 'INVESTOR_CALCULATOR');
    if (!gate.ok) return gate.error;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return errorResponse('Unauthorized', 401, req);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse('Unauthorized', 401, req);

    const { property_id, messages } = await req.json();
    if (!property_id || !Array.isArray(messages)) {
      return errorResponse('property_id and messages[] required', 400, req);
    }

    // Open-house intercept — comps with open houses for the owned property.
    const latestUserMsg = [...messages].reverse().find((m: any) => m?.role === 'user')?.content ?? '';
    const ohIntent = detectOpenHouseIntent(typeof latestUserMsg === 'string' ? latestUserMsg : '');
    if (ohIntent) {
      try {
        const lookup = await runOpenHouseLookup(ohIntent.args, authHeader);
        return jsonResponse({ message: lookup.markdown, openHouses: lookup.cards }, 200, req);
      } catch (e) {
        log.error('open_house_lookup_failed', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: prop, error: propErr } = await svc
      .from('investor_owned_properties')
      .select('*')
      .eq('id', property_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (propErr) throw propErr;
    if (!prop) return errorResponse('Property not found', 404, req);

    const [{ data: rental }, { data: alerts }] = await Promise.all([
      svc.from('investor_owned_property_rentals').select('*').eq('property_id', property_id).maybeSingle(),
      svc.from('investor_owned_property_alerts').select('alert_type, severity, title, description').eq('property_id', property_id).eq('status', 'active'),
    ]);

    const context = buildContext(prop, rental, alerts ?? []);
    const memoryBlock = await loadMemoryBlock(svc, user.id);
    // Stash rental rent on the property object so compare_rent_to_market can default it.
    (prop as any).__rental_monthly_rent = rental?.monthly_rent ?? null;

    const trimmedHistory = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20);

    const systemContent = `${SYSTEM_PROMPT}\n\n--- PROPERTY CONTEXT ---\n${context}${memoryBlock}\n\n${ciBehaviorPromptBlock({ surface: 'owned' })}\n\n${ciSignalsPromptBlock({
        allowedMismatchTypes: ['target_cap_rate', 'budget_over', 'budget_under'],
        allowedTools: ['generate_mortgage_excel', 'generate_property_report_pdf', 'generate_chart_image'],
      })}\n\n${FOLLOWUP_CASCADE_PROMPT_BLOCK}`;

    const convo: any[] = [
      { role: 'system', content: systemContent },
      ...trimmedHistory,
    ];

    const toolCtx: ToolExecCtx = { userId: user.id, serviceSupabase: svc, property: prop };
    let finalText = '';
    const collectedToolCalls: any[] = [];
    const collectedToolResults: any[] = [];

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const data = await rawGateway(convo);
      const choice = data.choices?.[0];
      if (!choice) break;
      const assistantMsg = choice.message ?? {};
      const content: string = assistantMsg.content ?? '';
      const toolCalls: any[] = assistantMsg.tool_calls ?? [];

      if (!toolCalls.length) {
        finalText = content;
        break;
      }

      convo.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });

      const results = await Promise.all(
        toolCalls.map(async (tc: any) => {
          const name = tc.function?.name;
          let input: any = {};
          try { input = JSON.parse(tc.function?.arguments ?? '{}'); } catch {}
          const tool = TOOL_BY_NAME.get(name);
          if (!tool) {
            return { tool_call_id: tc.id, content: JSON.stringify({ error: `Unknown tool: ${name}` }) };
          }
          try {
            const output = await tool.execute(input, toolCtx);
            collectedToolCalls.push({ id: tc.id, name, input });
            collectedToolResults.push({ id: tc.id, name, output });
            return { tool_call_id: tc.id, content: JSON.stringify(output) };
          } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            collectedToolResults.push({ id: tc.id, name, error: err });
            return { tool_call_id: tc.id, content: JSON.stringify({ error: err }) };
          }
        }),
      );
      for (const r of results) {
        convo.push({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content });
      }
    }

    const { cleanText, signals } = extractCiSignals(finalText);
    return jsonResponse(
      {
        message: cleanText,
        signals: signals ?? undefined,
        toolCalls: collectedToolCalls.length ? collectedToolCalls : undefined,
        toolResults: collectedToolResults.length ? collectedToolResults : undefined,
      },
      200,
      req,
    );
  } catch (e) {
    log.error('chat failed', { error: getErrorMessage(e) });
    return errorResponse(getErrorMessage(e), 500, req);
  }
});