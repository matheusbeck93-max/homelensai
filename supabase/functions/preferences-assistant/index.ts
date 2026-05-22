import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getSupabaseEnv } from '../_shared/env.ts';

const log = createLogger('preferences-assistant');

// ---------- Preference schema ----------

type Importance = 'low' | 'medium' | 'high' | null;

interface Preferences {
  goal?: string | null;
  locations?: string[];
  budget?: {
    purchase_price_max?: number | null;
    monthly_payment_max?: number | null;
    down_payment?: number | null;
  };
  property?: {
    types?: string[];
    bedrooms_min?: number | null;
    bathrooms_min?: number | null;
    sqft_min?: number | null;
  };
  lifestyle?: {
    schools_importance?: Importance;
    commute_importance?: Importance;
    safety_importance?: Importance;
    walkability_importance?: Importance;
    parks_importance?: Importance;
  };
  investment?: {
    strategy?: string | null;
    cash_flow_target?: number | null;
    appreciation_focus?: boolean | null;
    fixer_upper_ok?: boolean | null;
    risk_tolerance?: 'low' | 'medium' | 'high' | null;
  };
  must_haves?: string[];
  nice_to_haves?: string[];
  deal_breakers?: string[];
  freeform_notes?: string;
  updated_at?: string;
}

const EMPTY_PREFS: Preferences = {
  goal: null,
  locations: [],
  budget: { purchase_price_max: null, monthly_payment_max: null, down_payment: null },
  property: { types: [], bedrooms_min: null, bathrooms_min: null, sqft_min: null },
  lifestyle: {
    schools_importance: null,
    commute_importance: null,
    safety_importance: null,
    walkability_importance: null,
    parks_importance: null,
  },
  investment: {
    strategy: null,
    cash_flow_target: null,
    appreciation_focus: null,
    fixer_upper_ok: null,
    risk_tolerance: null,
  },
  must_haves: [],
  nice_to_haves: [],
  deal_breakers: [],
  freeform_notes: '',
};

function normalizePrefs(input: unknown): Preferences {
  const base: Preferences = JSON.parse(JSON.stringify(EMPTY_PREFS));
  if (!input || typeof input !== 'object') return base;
  const p = input as Record<string, any>;
  if (typeof p.goal === 'string') base.goal = p.goal;
  if (Array.isArray(p.locations)) base.locations = p.locations.filter((x) => typeof x === 'string');
  if (p.budget && typeof p.budget === 'object') {
    base.budget = {
      purchase_price_max: numOrNull(p.budget.purchase_price_max),
      monthly_payment_max: numOrNull(p.budget.monthly_payment_max),
      down_payment: numOrNull(p.budget.down_payment),
    };
  }
  if (p.property && typeof p.property === 'object') {
    base.property = {
      types: Array.isArray(p.property.types) ? p.property.types.filter((x: unknown) => typeof x === 'string') : [],
      bedrooms_min: numOrNull(p.property.bedrooms_min),
      bathrooms_min: numOrNull(p.property.bathrooms_min),
      sqft_min: numOrNull(p.property.sqft_min),
    };
  }
  if (p.lifestyle && typeof p.lifestyle === 'object') {
    base.lifestyle = {
      schools_importance: importance(p.lifestyle.schools_importance),
      commute_importance: importance(p.lifestyle.commute_importance),
      safety_importance: importance(p.lifestyle.safety_importance),
      walkability_importance: importance(p.lifestyle.walkability_importance),
      parks_importance: importance(p.lifestyle.parks_importance),
    };
  }
  if (p.investment && typeof p.investment === 'object') {
    base.investment = {
      strategy: typeof p.investment.strategy === 'string' ? p.investment.strategy : null,
      cash_flow_target: numOrNull(p.investment.cash_flow_target),
      appreciation_focus: typeof p.investment.appreciation_focus === 'boolean' ? p.investment.appreciation_focus : null,
      fixer_upper_ok: typeof p.investment.fixer_upper_ok === 'boolean' ? p.investment.fixer_upper_ok : null,
      risk_tolerance: importance(p.investment.risk_tolerance) as any,
    };
  }
  base.must_haves = strArr(p.must_haves);
  base.nice_to_haves = strArr(p.nice_to_haves);
  base.deal_breakers = strArr(p.deal_breakers);
  if (typeof p.freeform_notes === 'string') base.freeform_notes = p.freeform_notes.slice(0, 4000);
  if (typeof p.updated_at === 'string') base.updated_at = p.updated_at;
  return base;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function importance(v: unknown): Importance {
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return null;
}
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()))];
}
function dedupCI(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

// ---------- Patch application ----------

interface Patch {
  set?: Partial<Preferences> & Record<string, any>;
  add?: {
    locations?: string[];
    property_types?: string[];
    must_haves?: string[];
    nice_to_haves?: string[];
    deal_breakers?: string[];
  };
  remove?: {
    locations?: string[];
    property_types?: string[];
    must_haves?: string[];
    nice_to_haves?: string[];
    deal_breakers?: string[];
  };
  append_note?: string;
}

function applyPatch(prev: Preferences, patch: Patch | undefined | null): Preferences {
  const next = normalizePrefs(prev); // clone
  if (!patch || typeof patch !== 'object') return next;

  if (patch.set && typeof patch.set === 'object') {
    const s = patch.set as any;
    if ('goal' in s) next.goal = typeof s.goal === 'string' ? s.goal : null;
    if ('freeform_notes' in s && typeof s.freeform_notes === 'string') next.freeform_notes = s.freeform_notes.slice(0, 4000);
    if (s.budget && typeof s.budget === 'object') {
      next.budget = {
        purchase_price_max: 'purchase_price_max' in s.budget ? numOrNull(s.budget.purchase_price_max) : next.budget!.purchase_price_max ?? null,
        monthly_payment_max: 'monthly_payment_max' in s.budget ? numOrNull(s.budget.monthly_payment_max) : next.budget!.monthly_payment_max ?? null,
        down_payment: 'down_payment' in s.budget ? numOrNull(s.budget.down_payment) : next.budget!.down_payment ?? null,
      };
    }
    if (s.property && typeof s.property === 'object') {
      next.property = {
        types: Array.isArray(s.property.types) ? strArr(s.property.types) : next.property!.types ?? [],
        bedrooms_min: 'bedrooms_min' in s.property ? numOrNull(s.property.bedrooms_min) : next.property!.bedrooms_min ?? null,
        bathrooms_min: 'bathrooms_min' in s.property ? numOrNull(s.property.bathrooms_min) : next.property!.bathrooms_min ?? null,
        sqft_min: 'sqft_min' in s.property ? numOrNull(s.property.sqft_min) : next.property!.sqft_min ?? null,
      };
    }
    if (s.lifestyle && typeof s.lifestyle === 'object') {
      next.lifestyle = { ...next.lifestyle };
      for (const k of ['schools_importance', 'commute_importance', 'safety_importance', 'walkability_importance', 'parks_importance'] as const) {
        if (k in s.lifestyle) (next.lifestyle as any)[k] = importance(s.lifestyle[k]);
      }
    }
    if (s.investment && typeof s.investment === 'object') {
      next.investment = { ...next.investment };
      if ('strategy' in s.investment) next.investment!.strategy = typeof s.investment.strategy === 'string' ? s.investment.strategy : null;
      if ('cash_flow_target' in s.investment) next.investment!.cash_flow_target = numOrNull(s.investment.cash_flow_target);
      if ('appreciation_focus' in s.investment) next.investment!.appreciation_focus = typeof s.investment.appreciation_focus === 'boolean' ? s.investment.appreciation_focus : null;
      if ('fixer_upper_ok' in s.investment) next.investment!.fixer_upper_ok = typeof s.investment.fixer_upper_ok === 'boolean' ? s.investment.fixer_upper_ok : null;
      if ('risk_tolerance' in s.investment) next.investment!.risk_tolerance = importance(s.investment.risk_tolerance) as any;
    }
    // Array overrides via set (full replace)
    if (Array.isArray(s.locations)) next.locations = strArr(s.locations);
    if (Array.isArray(s.must_haves)) next.must_haves = strArr(s.must_haves);
    if (Array.isArray(s.nice_to_haves)) next.nice_to_haves = strArr(s.nice_to_haves);
    if (Array.isArray(s.deal_breakers)) next.deal_breakers = strArr(s.deal_breakers);
  }

  if (patch.add && typeof patch.add === 'object') {
    if (Array.isArray(patch.add.locations)) next.locations = dedupCI([...(next.locations ?? []), ...strArr(patch.add.locations)]);
    if (Array.isArray(patch.add.property_types)) next.property!.types = dedupCI([...(next.property!.types ?? []), ...strArr(patch.add.property_types)]);
    if (Array.isArray(patch.add.must_haves)) next.must_haves = dedupCI([...(next.must_haves ?? []), ...strArr(patch.add.must_haves)]);
    if (Array.isArray(patch.add.nice_to_haves)) next.nice_to_haves = dedupCI([...(next.nice_to_haves ?? []), ...strArr(patch.add.nice_to_haves)]);
    if (Array.isArray(patch.add.deal_breakers)) next.deal_breakers = dedupCI([...(next.deal_breakers ?? []), ...strArr(patch.add.deal_breakers)]);
  }

  if (patch.remove && typeof patch.remove === 'object') {
    const drop = (arr: string[] | undefined, rm: string[]) => {
      const lower = new Set(rm.map((x) => x.toLowerCase()));
      return (arr ?? []).filter((x) => !lower.has(x.toLowerCase()));
    };
    if (Array.isArray(patch.remove.locations)) next.locations = drop(next.locations, strArr(patch.remove.locations));
    if (Array.isArray(patch.remove.property_types)) next.property!.types = drop(next.property!.types, strArr(patch.remove.property_types));
    if (Array.isArray(patch.remove.must_haves)) next.must_haves = drop(next.must_haves, strArr(patch.remove.must_haves));
    if (Array.isArray(patch.remove.nice_to_haves)) next.nice_to_haves = drop(next.nice_to_haves, strArr(patch.remove.nice_to_haves));
    if (Array.isArray(patch.remove.deal_breakers)) next.deal_breakers = drop(next.deal_breakers, strArr(patch.remove.deal_breakers));
  }

  if (typeof patch.append_note === 'string' && patch.append_note.trim()) {
    const prevNote = (next.freeform_notes ?? '').trim();
    next.freeform_notes = (prevNote ? `${prevNote}\n${patch.append_note.trim()}` : patch.append_note.trim()).slice(0, 4000);
  }

  next.updated_at = new Date().toISOString();
  return next;
}

// ---------- Legacy column mirror ----------

function mirrorToLegacyColumns(prefs: Preferences): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (Array.isArray(prefs.locations) && prefs.locations.length) out.preferred_cities = prefs.locations;
  if (prefs.budget?.purchase_price_max != null) out.budget_max = prefs.budget.purchase_price_max;
  if (prefs.property?.bedrooms_min != null) out.min_bedrooms = prefs.property.bedrooms_min;
  if (prefs.property?.bathrooms_min != null) out.min_bathrooms = prefs.property.bathrooms_min;
  if (prefs.property?.sqft_min != null) out.min_sqft = prefs.property.sqft_min;
  if (prefs.goal === 'buy_home' || prefs.goal === 'invest' || prefs.goal === 'both' || prefs.goal === 'rent' || prefs.goal === 'market_research') {
    out.primary_goal = prefs.goal === 'rent' || prefs.goal === 'market_research' ? prefs.goal : prefs.goal;
  }
  if (prefs.freeform_notes) out.about_me = prefs.freeform_notes;
  return out;
}

// ---------- AI ----------

const SYSTEM_PROMPT = `You are HomeLens's Preferences Assistant. Your job is to help the user define and refine their US real estate preferences through natural conversation.

Guidelines:
- Be warm, brief, and practical. One short paragraph plus at most one follow-up question.
- Accept partial answers. Never demand a full questionnaire.
- Extract structured data from natural language and update preferences via the update_preferences tool.
- When the user contradicts a previous preference, update it and briefly acknowledge ("Got it — removed condos.").
- Normalize locations as "City, ST" (e.g. "Arlington, VA"). Accept regions like "DMV" but ask the user which cities to include.
- Importance fields use only: low, medium, high.
- Property types: house, townhouse, condo, multi-family, land, mobile, co-op.
- Goal values: buy_home, invest, rent, market_research, tax_incentives, unknown.
- Use the "add" / "remove" patch ops for arrays unless the user clearly wants a full replace ("only Tampa") — then use "set".
- For vague input, capture as freeform_notes via append_note and ask one helpful follow-up.
- Do NOT give legal, lending, tax, or financial advice. Do NOT rank neighborhoods by protected classes or make fair-housing claims.
- Only discuss US real estate. Politely redirect off-topic asks.
- ALWAYS call BOTH tools in every turn: update_preferences first (with an empty patch if there's nothing to change), then reply.

The reply tool's "message" is shown to the user as the assistant's chat bubble. Keep it concise.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_preferences',
      description: 'Apply a patch to the user\'s preferences. Use set for direct values, add/remove for array operations, append_note for freeform context. Send an empty object {} if nothing changes.',
      parameters: {
        type: 'object',
        properties: {
          set: {
            type: 'object',
            description: 'Direct field assignments. Nested objects supported for budget, property, lifestyle, investment.',
            additionalProperties: true,
          },
          add: {
            type: 'object',
            description: 'Append items to array fields.',
            properties: {
              locations: { type: 'array', items: { type: 'string' } },
              property_types: { type: 'array', items: { type: 'string' } },
              must_haves: { type: 'array', items: { type: 'string' } },
              nice_to_haves: { type: 'array', items: { type: 'string' } },
              deal_breakers: { type: 'array', items: { type: 'string' } },
            },
          },
          remove: {
            type: 'object',
            description: 'Remove items from array fields (case-insensitive match).',
            properties: {
              locations: { type: 'array', items: { type: 'string' } },
              property_types: { type: 'array', items: { type: 'string' } },
              must_haves: { type: 'array', items: { type: 'string' } },
              nice_to_haves: { type: 'array', items: { type: 'string' } },
              deal_breakers: { type: 'array', items: { type: 'string' } },
            },
          },
          append_note: { type: 'string', description: 'Free-form text to append to freeform_notes.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reply',
      description: 'Send the chat message to the user.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Assistant message shown in the chat.' },
          suggested_replies: {
            type: 'array',
            description: 'Up to 4 short quick-reply chips the user can tap.',
            items: { type: 'string' },
          },
        },
        required: ['message'],
      },
    },
  },
];

async function callAI(messages: Array<{ role: string; content: string }>, prefs: Preferences) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const body = {
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current preferences JSON:\n${JSON.stringify(prefs, null, 2)}` },
      ...messages,
    ],
    tools: TOOLS,
    tool_choice: 'required',
  };

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const choice = data.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];

  let patch: Patch | null = null;
  let reply = { message: '', suggested_replies: [] as string[] };

  for (const tc of toolCalls) {
    try {
      const args = JSON.parse(tc.function.arguments || '{}');
      if (tc.function.name === 'update_preferences') patch = args;
      else if (tc.function.name === 'reply') reply = { message: String(args.message ?? ''), suggested_replies: Array.isArray(args.suggested_replies) ? args.suggested_replies.slice(0, 4).map(String) : [] };
    } catch (e) {
      log.step('Failed to parse tool call', { error: getErrorMessage(e), name: tc.function?.name });
    }
  }

  if (!reply.message) {
    reply.message = choice?.message?.content?.trim() || "Got it. What else should I know about your search?";
  }

  return { patch, reply };
}

// ---------- HTTP ----------

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401, req);

    const { url, serviceRoleKey } = getSupabaseEnv();
    const supabase = createClient(url, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return errorResponse('Unauthorized', 401, req);

    const body = await req.json().catch(() => null) as
      | { action?: 'chat' | 'reset' | 'save' | 'edit'; messages?: Array<{ role: string; content: string }>; preferences?: unknown }
      | null;
    if (!body) return validationError('Request body required', undefined, req);

    const action = body.action ?? 'chat';

    // Load current prefs
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle();
    const currentPrefs = normalizePrefs(profile?.preferences);

    if (action === 'reset') {
      const empty = normalizePrefs({});
      empty.updated_at = new Date().toISOString();
      await supabase.from('profiles').update({
        preferences: empty,
        preferred_cities: null,
        budget_max: null,
        min_bedrooms: null,
        min_bathrooms: null,
        min_sqft: null,
        about_me: null,
      }).eq('id', user.id);
      return jsonResponse({ preferences: empty, message: 'Preferences cleared. Tell me about your search whenever you\'re ready.' }, 200, req);
    }

    if (action === 'save') {
      // No-op save — current prefs are already persisted on each chat turn.
      return jsonResponse({ preferences: currentPrefs, message: 'Saved.' }, 200, req);
    }

    if (action === 'edit') {
      const next = normalizePrefs(body.preferences);
      next.updated_at = new Date().toISOString();
      await supabase.from('profiles').update({
        preferences: next,
        ...mirrorToLegacyColumns(next),
      }).eq('id', user.id);
      return jsonResponse({ preferences: next, message: 'Preferences updated.' }, 200, req);
    }

    // action === 'chat'
    const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) : [];

    // Opening turn — no user messages yet.
    if (messages.length === 0) {
      return jsonResponse({
        preferences: currentPrefs,
        message:
          "Let's set up your HomeLens preferences. You can answer naturally — for example: \"I'm looking for a 3-bedroom townhouse near Arlington under $650k with good schools and a short commute.\" I'll organize everything for you.",
        suggested_replies: [
          "I'm buying a home for my family",
          "I'm an investor looking for rentals",
          "Show me what you know so far",
        ],
      }, 200, req);
    }

    const { patch, reply } = await callAI(messages, currentPrefs);
    const nextPrefs = patch ? applyPatch(currentPrefs, patch) : currentPrefs;

    // Persist
    const updates: Record<string, unknown> = { preferences: nextPrefs, ...mirrorToLegacyColumns(nextPrefs) };
    const { error: updateErr } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (updateErr) log.step('Profile update failed', { error: updateErr.message });

    return jsonResponse({
      preferences: nextPrefs,
      message: reply.message,
      suggested_replies: reply.suggested_replies,
    }, 200, req);
  } catch (error) {
    log.step('ERROR', { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error), 500, req);
  }
});