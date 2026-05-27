import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { callAiGateway, type AiMessage } from '../_shared/ai-gateway.ts';
import { amortizedBalance, monthsBetween } from '../_shared/rentcast.ts';

const log = createLogger('owned-property-chat');

const SYSTEM_PROMPT = `You are HomeLens Portfolio Advisor — an AI helping a US real-estate
investor reason about a single property they OWN. You receive the full property
context (purchase, loan, current value, rental, alerts, returns) up front.

Rules:
- Decision-first: open with a clear yes/no/likely conclusion when asked a decision question.
- Be concise: 1-3 sentences for factual, short paragraphs + bullets when comparing options.
- Use the actual numbers in the context. Never invent data.
- If asked about something not in the context (e.g. live market rates), say so briefly and recommend the user refresh the valuation or check current rates.
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

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
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

    const trimmedHistory = messages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20);

    const aiMessages: AiMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- PROPERTY CONTEXT ---\n${context}` },
      ...trimmedHistory,
    ];

    const out = await callAiGateway(aiMessages, {
      model: 'google/gemini-2.5-flash',
      temperature: 0.4,
      max_tokens: 800,
    });
    if ('error' in out) return out.error;

    return jsonResponse({ message: out.result.message }, 200, req);
  } catch (e) {
    log.error('chat failed', { error: getErrorMessage(e) });
    return errorResponse(getErrorMessage(e), 500, req);
  }
});