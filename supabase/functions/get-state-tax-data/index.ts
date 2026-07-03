import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { requireEnv } from '../_shared/env.ts';
import { createLogger } from '../_shared/logging.ts';
import { fetchWithTimeout } from '../_shared/http.ts';
import { precheckAiCredits, deductAiCredits } from '../_shared/aiCredits.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('get-state-tax-data');

const STATE_CODES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC',
};

const STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, name.replace(/\b\w/g, c => c.toUpperCase())])
);

function normalizeState(input: string): string | null {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (STATE_NAMES[upper]) return upper;
  const lower = trimmed.toLowerCase();
  if (STATE_CODES[lower]) return STATE_CODES[lower];
  return null;
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const credits = await precheckAiCredits(req, 'get-state-tax-data');
    if (!credits.allowed && credits.response) return credits.response;

    const { state } = await req.json();
    if (!state) return validationError('State is required');

    const stateCode = normalizeState(state);
    if (!stateCode) return validationError('Invalid state');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check cache (24h TTL)
    const { data: cached } = await supabase
      .from('state_tax_cache')
      .select('*')
      .eq('state_code', stateCode)
      .single();

    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const now = new Date();
      const hoursSince = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return jsonResponse({ rate: Number(cached.rate), source: cached.source, updatedAt: cached.fetched_at, fromCache: true });
      }
    }

    const PERPLEXITY_API_KEY = requireEnv('PERPLEXITY_API_KEY');
    const stateName = STATE_NAMES[stateCode] || stateCode;

    const pResponse = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `What is the current average effective property tax rate for residential real estate in ${stateName}? Please provide just the percentage number and the source name (Tax Foundation, ATTOM, or state government). Format: RATE: X.XX% SOURCE: [name]`,
          },
        ],
      }),
    }, 8000);

    if (!pResponse.ok) {
      throw new Error(`Perplexity returned ${pResponse.status}`);
    }

    const pData = await pResponse.json();
    const content = pData.choices?.[0]?.message?.content || '';

    await deductAiCredits(credits, pData?.usage);

    const rateMatch = content.match(/RATE:\s*(\d+\.?\d*)%?/i);
    const sourceMatch = content.match(/SOURCE:\s*(.+?)(?:\n|$)/i);

    if (!rateMatch) throw new Error('Could not parse rate from Perplexity response');

    const rate = parseFloat(rateMatch[1]);
    const source = sourceMatch ? sourceMatch[1].trim() : 'Perplexity AI';

    if (isNaN(rate) || rate <= 0 || rate > 10) throw new Error('Invalid rate value');

    await supabase
      .from('state_tax_cache')
      .upsert({ state_code: stateCode, rate, source, fetched_at: new Date().toISOString() }, { onConflict: 'state_code' });

    return jsonResponse({ rate, source, updatedAt: new Date().toISOString(), fromCache: false });

  } catch (error) {
    log.error('Error:', error);
    return errorResponse('Failed to fetch tax data');
  }
})(req)));
