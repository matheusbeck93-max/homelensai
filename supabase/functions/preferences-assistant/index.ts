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
  buyer_type?: string | null;
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
  buyer_type: null,
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
  if (typeof p.buyer_type === 'string') base.buyer_type = p.buyer_type;
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
    if ('buyer_type' in s) next.buyer_type = typeof s.buyer_type === 'string' ? s.buyer_type : null;
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
    const incoming = patch.append_note.trim();
    const prevNote = (next.freeform_notes ?? '').trim();
    const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const existingLines = prevNote ? prevNote.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const existingKeys = new Set(existingLines.map(norm));
    const incomingLines = incoming.split('\n').map((l) => l.trim()).filter(Boolean);
    const merged = [...existingLines];
    for (const line of incomingLines) {
      const k = norm(line);
      if (k && !existingKeys.has(k)) {
        existingKeys.add(k);
        merged.push(line);
      }
    }
    next.freeform_notes = merged.join('\n').slice(0, 4000);
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

const EXTRACTION_PROMPT = `You extract structured US real estate preferences from a user's chat message and return them as a JSON patch.

Output ONLY by calling update_preferences. Do not write prose.

CRITICAL RULES:
1. Extract EVERY field mentioned in the user's message in ONE call. Do not skip fields.
2. Prefer STRUCTURED fields over freeform_notes. Only use append_note for context that truly fits nowhere structured (e.g. "I work night shifts"). NEVER append text already representable as a structured field.
3. When the user contradicts a previous scalar value ("actually make it 4 bedrooms"), use "set" to overwrite — do not "add". Same for budget, sqft, goal, lifestyle importance.
4. When the user says "only X" or "just X" for locations/types, use set with the full replacement array.
5. Match property type EXACTLY as stated. "townhouse" -> "townhouse", NOT "house". "condo" -> "condo", NOT "house". A "house" is a single-family detached only.

LEXICON (map natural language -> structured fields):
- "walkable / walkability / walk to" -> lifestyle.walkability_importance = high
- "safe / safety / low crime / secure" -> lifestyle.safety_importance = high
- "nature / parks / green / trees / outdoors" -> lifestyle.parks_importance = high
- "good schools / school district / great schools" -> lifestyle.schools_importance = high
- "short commute / close to work / near transit" -> lifestyle.commute_importance = high

GOAL mapping (set goal once, do not overwrite unless user contradicts):
- "buying for my family / our home / primary residence / first home / move-in" -> goal = "buy_home"
- "Primary Residence" (as a standalone short reply) -> goal = "buy_home"
- "Investment / rental property" (standalone) -> goal = "invest"
- "rental / cash flow / investment / BRRRR / flip" -> goal = "invest"
- "renting / lease" -> goal = "rent"
- "researching the market" -> goal = "market_research"

PROPERTY TYPE synonyms -> property_types (add):
- "single family / SFH / detached / standalone house" -> "house"
- "condo / coop / co-op" -> "condo" or "co-op"
- "townhome / townhouse / row house" -> "townhouse"
- "duplex / triplex / 2-4 unit / multifamily" -> "multi-family"
- "land / lot / acreage" -> "land"
- "mobile / manufactured" -> "mobile"
Never coerce "townhouse" or "condo" into "house". If user names a specific type, use exactly that type.

NUMERIC extraction:
- "3-bed / 3 bedrooms / 3br" -> property.bedrooms_min = 3
- "2 baths / 2.5 baths" -> property.bathrooms_min = 2 (or 2.5)
- "1,800 sqft / 1800 square feet" -> property.sqft_min = 1800
- "under $650k / max 650000 / budget 650k" -> budget.purchase_price_max = 650000
- "monthly payment under $3000" -> budget.monthly_payment_max = 3000
- "20% down / $130k down" -> budget.down_payment (compute if percent and price both known; else absolute)

CLASSIFICATION:
- "must have / need / required" -> must_haves (add)
- "would love / nice to have / prefer" -> nice_to_haves (add)
- "no / avoid / dealbreaker / can't have" -> deal_breakers (add)

LOCATIONS:
- Normalize as "City, ST". "only X / just X" -> set.locations = [X] (full replace). Otherwise add.locations.
- Infer the state from well-known city names ("Arlington" near DC -> "Arlington, VA"; "Tampa" -> "Tampa, FL"; "Austin" -> "Austin, TX").
- Region terms (DMV, Bay Area, Tri-State): do NOT add as a location; capture intent via append_note.

SELF-CORRECTION:
- If the user says "you didn't capture X" or "you missed X", emit an empty patch ({}) — the reply step will ask for X.

NOTES:
- Only use append_note for context that does NOT fit any structured field. Never paraphrase a structured fact (like "user wants walkable") into a note — that data already lives in lifestyle.walkability_importance.
- Never re-emit a note whose meaning is already in current freeform_notes.

WORKED EXAMPLE:
User message: "I'm looking for a 3-bedroom townhouse near Arlington under $650k with good schools and a short commute."
Correct patch:
{
  "set": {
    "property": { "bedrooms_min": 3 },
    "budget": { "purchase_price_max": 650000 },
    "lifestyle": { "schools_importance": "high", "commute_importance": "high" }
  },
  "add": {
    "property_types": ["townhouse"],
    "locations": ["Arlington, VA"]
  }
}
No append_note — every fact fits a structured field.

Return only the tool call. Use empty {} if nothing to change.`;

const REPLY_PROMPT = `You are HomeLens's Preferences Assistant — warm, brief, practical.

Style:
- 1-2 sentences. If you changed something, acknowledge it specifically ("Set walkability and safety to high.").
- Ask exactly ONE follow-up about the most useful MISSING field, in this priority order — SKIP any field already filled in the Current preferences JSON:
    1. goal (skip if goal is not null)
    2. locations (skip if non-empty)
    3. property.bedrooms_min (skip if non-null)
    4. property.bathrooms_min (skip if non-null)
    5. budget.purchase_price_max (skip if non-null)
    6. property.types (skip if non-empty)
    7. must_haves (skip if non-empty)
    8. lifestyle importance fields (skip any already set)
- NEVER re-ask for a value already present. Never ask "what's your max price?" if budget.purchase_price_max is set. Never re-ask goal/beds/baths/locations if they are set.
- Do not repeat any question you already asked earlier in this conversation history.
- If all high-priority fields are filled, ask about deal-breakers, timeline, or financing — or confirm and offer to wrap up.
- Provide 2-3 short suggested_replies the user can tap (omit if no follow-up question).
- If the user said "you didn't capture X / you missed X", explicitly ask for X.
- US real estate only. No legal/lending/tax advice. No fair-housing ranking.

Call the reply tool only.`;

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

const UPDATE_TOOL = [TOOLS[0]];
const REPLY_TOOL = [TOOLS[1]];

// ---------- Missing-field priority + suggested-reply chips ----------

type MissingField =
  | 'goal'
  | 'locations'
  | 'budget.purchase_price_max'
  | 'property.bedrooms_min'
  | 'property.bathrooms_min'
  | 'property.types'
  | 'must_haves'
  | 'lifestyle'
  | null;

function nextMissingField(p: Preferences): MissingField {
  const isInvestor = p.goal === 'invest';
  const order: MissingField[] = isInvestor
    ? ['goal', 'budget.purchase_price_max', 'locations', 'property.bedrooms_min', 'property.types', 'lifestyle']
    : ['goal', 'budget.purchase_price_max', 'locations', 'property.types', 'property.bedrooms_min', 'property.bathrooms_min', 'must_haves', 'lifestyle'];
  for (const f of order) {
    if (!f) continue;
    if (f === 'goal' && !p.goal) return 'goal';
    if (f === 'locations' && !(p.locations ?? []).length) return 'locations';
    if (f === 'budget.purchase_price_max' && p.budget?.purchase_price_max == null) return 'budget.purchase_price_max';
    if (f === 'property.bedrooms_min' && p.property?.bedrooms_min == null) return 'property.bedrooms_min';
    if (f === 'property.bathrooms_min' && p.property?.bathrooms_min == null) return 'property.bathrooms_min';
    if (f === 'property.types' && !(p.property?.types ?? []).length) return 'property.types';
    if (f === 'must_haves' && !(p.must_haves ?? []).length) return 'must_haves';
    if (f === 'lifestyle') {
      const l = p.lifestyle ?? {};
      if (!l.schools_importance && !l.commute_importance && !l.safety_importance && !l.walkability_importance && !l.parks_importance) return 'lifestyle';
    }
  }
  return null;
}

function suggestedRepliesFor(field: MissingField): string[] {
  switch (field) {
    case 'goal': return ['Buying a home', 'Investing in rentals', 'Just researching'];
    case 'locations': return ['Tampa, FL', 'Austin, TX', 'Open to suggestions'];
    case 'budget.purchase_price_max': return ['Under $400k', '$400k–$700k', '$700k–$1M', '$1M+'];
    case 'property.bedrooms_min': return ['2+ bedrooms', '3+ bedrooms', '4+ bedrooms'];
    case 'property.bathrooms_min': return ['1+ bathroom', '2+ bathrooms', '3+ bathrooms'];
    case 'property.types': return ['House', 'Townhouse', 'Condo', 'Open to any'];
    case 'must_haves': return ['Garage', 'Yard', 'Home office', 'Skip for now'];
    case 'lifestyle': return ['Good schools', 'Walkable area', 'Short commute', 'Safe neighborhood'];
    case null: return ['Show me what you know so far', 'Start browsing homes'];
    default: return [];
  }
}

function fieldLabel(f: MissingField): string {
  switch (f) {
    case 'goal': return 'your goal (buying vs investing)';
    case 'locations': return 'cities or areas you\'re considering';
    case 'budget.purchase_price_max': return 'your max purchase price';
    case 'property.bedrooms_min': return 'minimum bedrooms';
    case 'property.bathrooms_min': return 'minimum bathrooms';
    case 'property.types': return 'property type (house, townhouse, condo…)';
    case 'must_haves': return 'any must-haves (garage, yard, etc.)';
    case 'lifestyle': return 'lifestyle priorities (schools, walkability, commute)';
    case null: return '';
  }
}

function savedSummary(before: Preferences, after: Preferences): string {
  const parts: string[] = [];
  if (before.goal !== after.goal && after.goal) parts.push(`goal=${after.goal}`);
  const added = (a?: string[], b?: string[]) => (b ?? []).filter((v) => !(a ?? []).some((u) => u.toLowerCase() === v.toLowerCase()));
  const aL = added(before.locations, after.locations); if (aL.length) parts.push(`locations +[${aL.join(', ')}]`);
  const aT = added(before.property?.types, after.property?.types); if (aT.length) parts.push(`types +[${aT.join(', ')}]`);
  const aM = added(before.must_haves, after.must_haves); if (aM.length) parts.push(`must_haves +[${aM.join(', ')}]`);
  const aN = added(before.nice_to_haves, after.nice_to_haves); if (aN.length) parts.push(`nice_to_haves +[${aN.join(', ')}]`);
  const aD = added(before.deal_breakers, after.deal_breakers); if (aD.length) parts.push(`deal_breakers +[${aD.join(', ')}]`);
  if (before.budget?.purchase_price_max !== after.budget?.purchase_price_max && after.budget?.purchase_price_max != null)
    parts.push(`max price=$${after.budget.purchase_price_max.toLocaleString()}`);
  if (before.budget?.monthly_payment_max !== after.budget?.monthly_payment_max && after.budget?.monthly_payment_max != null)
    parts.push(`monthly max=$${after.budget.monthly_payment_max.toLocaleString()}`);
  if (before.property?.bedrooms_min !== after.property?.bedrooms_min && after.property?.bedrooms_min != null)
    parts.push(`beds≥${after.property.bedrooms_min}`);
  if (before.property?.bathrooms_min !== after.property?.bathrooms_min && after.property?.bathrooms_min != null)
    parts.push(`baths≥${after.property.bathrooms_min}`);
  if (before.property?.sqft_min !== after.property?.sqft_min && after.property?.sqft_min != null)
    parts.push(`sqft≥${after.property.sqft_min}`);
  const bl = before.lifestyle ?? {}, al = after.lifestyle ?? {};
  for (const k of ['schools_importance','commute_importance','safety_importance','walkability_importance','parks_importance'] as const) {
    if ((bl as any)[k] !== (al as any)[k] && (al as any)[k]) parts.push(`${k.replace('_importance','')}=${(al as any)[k]}`);
  }
  return parts.join('; ');
}

type GatewayResult =
  | { ok: true; data: any }
  | { ok: false; status: number; rateLimited: boolean; creditsExhausted: boolean; text: string };

async function callGateway(body: Record<string, unknown>): Promise<GatewayResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    log.step('Gateway non-2xx', { status: resp.status, text: text.slice(0, 300) });
    return {
      ok: false,
      status: resp.status,
      rateLimited: resp.status === 429,
      creditsExhausted: resp.status === 402,
      text,
    };
  }
  return { ok: true, data: await resp.json() };
}

function parseToolArgs(data: any, name: string): any | null {
  const calls = data?.choices?.[0]?.message?.tool_calls ?? [];
  for (const tc of calls) {
    if (tc?.function?.name === name) {
      try { return JSON.parse(tc.function.arguments || '{}'); } catch { return null; }
    }
  }
  return null;
}

// Pass 1: extract a structured patch from the user's latest message.
// We FORCE update_preferences so the model can never silently skip the save.
async function extractPatch(
  messages: Array<{ role: string; content: string }>,
  prefs: Preferences,
): Promise<
  | { ok: true; patch: Patch }
  | { ok: false; rateLimited: boolean; creditsExhausted: boolean }
> {
  const result = await callGateway({
    model: 'google/gemini-2.5-flash',
    temperature: 0,
    messages: [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'system', content: `Current preferences JSON:\n${JSON.stringify(prefs, null, 2)}` },
      ...messages,
    ],
    tools: UPDATE_TOOL,
    tool_choice: { type: 'function', function: { name: 'update_preferences' } },
  });
  if (!result.ok) {
    return { ok: false, rateLimited: result.rateLimited, creditsExhausted: result.creditsExhausted };
  }
  const patch = (parseToolArgs(result.data, 'update_preferences') as Patch) ?? {};
  return { ok: true, patch };
}

// Pass 2: generate a data-driven reply that confirms what was actually saved
// and asks about the next-most-important missing field.
async function generateReply(
  messages: Array<{ role: string; content: string }>,
  before: Preferences,
  after: Preferences,
): Promise<
  | { ok: true; reply: { message: string; suggested_replies: string[] } | null }
  | { ok: false; rateLimited: boolean; creditsExhausted: boolean }
> {
  const saved = savedSummary(before, after);
  const missing = nextMissingField(after);
  const chips = suggestedRepliesFor(missing);
  const context = [
    `Saved this turn: ${saved || '(no structured changes)'}`,
    `Current preferences JSON:\n${JSON.stringify(after, null, 2)}`,
    `Next most important MISSING field: ${missing ?? '(everything required is set)'}`,
    missing
      ? `Ask ONE focused question about ${fieldLabel(missing)}. Do NOT ask about any field already filled.`
      : `All key fields are set. Confirm and offer: "Want me to start browsing homes?"`,
    `If something was saved this turn, your reply MUST specifically name what was saved (e.g. "Added Tampa, FL to your locations" or "Set max price to $650k"). Never use the generic phrase "Got it — updated".`,
    `Suggested replies should be 3-4 short chips relevant to that next question. Recommended: ${JSON.stringify(chips)}.`,
  ].join('\n\n');

  const result = await callGateway({
    model: 'google/gemini-2.5-flash',
    temperature: 0.5,
    messages: [
      { role: 'system', content: REPLY_PROMPT },
      { role: 'system', content: context },
      ...messages,
    ],
    tools: REPLY_TOOL,
    tool_choice: { type: 'function', function: { name: 'reply' } },
  });
  if (!result.ok) {
    return { ok: false, rateLimited: result.rateLimited, creditsExhausted: result.creditsExhausted };
  }
  const replyArgs = parseToolArgs(result.data, 'reply');
  if (!replyArgs) return { ok: true, reply: null };
  return {
    ok: true,
    reply: {
      message: String(replyArgs.message ?? '').trim(),
      suggested_replies: Array.isArray(replyArgs.suggested_replies)
        ? replyArgs.suggested_replies.slice(0, 4).map(String)
        : chips,
    },
  };
}

function diffSummary(before: Preferences, after: Preferences): string {
  const changes: string[] = [];
  const b = before, a = after;
  if (b.goal !== a.goal) changes.push(`goal: ${b.goal ?? '∅'} -> ${a.goal ?? '∅'}`);
  const arrDiff = (label: string, x?: string[], y?: string[]) => {
    const added = (y ?? []).filter((v) => !(x ?? []).some((u) => u.toLowerCase() === v.toLowerCase()));
    const removed = (x ?? []).filter((v) => !(y ?? []).some((u) => u.toLowerCase() === v.toLowerCase()));
    if (added.length) changes.push(`+${label}: ${added.join(', ')}`);
    if (removed.length) changes.push(`-${label}: ${removed.join(', ')}`);
  };
  arrDiff('locations', b.locations, a.locations);
  arrDiff('types', b.property?.types, a.property?.types);
  arrDiff('must_haves', b.must_haves, a.must_haves);
  arrDiff('nice_to_haves', b.nice_to_haves, a.nice_to_haves);
  arrDiff('deal_breakers', b.deal_breakers, a.deal_breakers);
  const bp = b.budget ?? {}, ap = a.budget ?? {};
  if (bp.purchase_price_max !== ap.purchase_price_max) changes.push(`price_max: ${ap.purchase_price_max ?? '∅'}`);
  if (bp.monthly_payment_max !== ap.monthly_payment_max) changes.push(`monthly_max: ${ap.monthly_payment_max ?? '∅'}`);
  const bpr = b.property ?? {}, apr = a.property ?? {};
  if (bpr.bedrooms_min !== apr.bedrooms_min) changes.push(`beds_min: ${apr.bedrooms_min ?? '∅'}`);
  if (bpr.bathrooms_min !== apr.bathrooms_min) changes.push(`baths_min: ${apr.bathrooms_min ?? '∅'}`);
  if (bpr.sqft_min !== apr.sqft_min) changes.push(`sqft_min: ${apr.sqft_min ?? '∅'}`);
  const bl = b.lifestyle ?? {}, al = a.lifestyle ?? {};
  for (const k of ['schools_importance','commute_importance','safety_importance','walkability_importance','parks_importance'] as const) {
    if ((bl as any)[k] !== (al as any)[k]) changes.push(`${k}: ${(al as any)[k] ?? '∅'}`);
  }
  return changes.length ? changes.join('; ') : 'no structured changes';
}

function fallbackAck(saved: string, prefs: Preferences): string {
  const missing = nextMissingField(prefs);
  const ask = missing
    ? ` What about ${fieldLabel(missing)}?`
    : ' Want me to start browsing homes?';
  if (saved) {
    return `Saved: ${saved}.${ask}`;
  }
  if (missing) return `Got it.${ask}`;
  return "Your preferences look complete. Want me to start browsing homes?";
}

function nextQuestion(f: MissingField): string {
  switch (f) {
    case 'goal': return 'Are you buying a home or looking for investment properties?';
    case 'locations': return 'Which cities or neighborhoods are you considering?';
    case 'budget.purchase_price_max': return 'What budget or monthly payment range should I use?';
    case 'property.bedrooms_min': return 'How many bedrooms do you need?';
    case 'property.bathrooms_min': return 'How many bathrooms do you need?';
    case 'property.types': return 'What property type are you open to — house, townhouse, or condo?';
    case 'must_haves': return 'Any must-haves like a garage, yard, or home office?';
    case 'lifestyle': return 'What lifestyle priorities matter most — schools, walkability, commute, or safety?';
    case null: return '';
  }
}

function typeLabel(t: string): string {
  const k = t.toLowerCase();
  return ({
    house: 'single-family home',
    townhouse: 'townhouse',
    condo: 'condo',
    'co-op': 'co-op',
    'multi-family': 'multi-family',
    land: 'land',
    mobile: 'mobile home',
  } as Record<string, string>)[k] ?? t;
}

function buyerTypeLabel(b: string): string {
  return ({
    first_time_home_buyer: 'first-time home buyer',
    repeat_buyer: 'repeat buyer',
    move_up_buyer: 'move-up buyer',
    downsizer: 'downsizer',
    relocating_buyer: 'relocating buyer',
  } as Record<string, string>)[b] ?? b.replace(/_/g, ' ');
}

function goalPhrase(g: string): string {
  return ({
    buy_home: 'buying a home',
    invest: 'investing in rentals',
    rent: 'renting',
    market_research: 'researching the market',
    both: 'buying and investing',
    tax_incentives: 'looking into tax incentives',
  } as Record<string, string>)[g] ?? g;
}

function humanAck(before: Preferences, after: Preferences, missing: MissingField): string {
  const phrases: string[] = [];

  const buyerChanged = before.buyer_type !== after.buyer_type && after.buyer_type;
  const goalChanged = before.goal !== after.goal && after.goal;
  if (buyerChanged) {
    phrases.push(`you're a ${buyerTypeLabel(after.buyer_type!)}`);
  } else if (goalChanged) {
    phrases.push(`you're ${goalPhrase(after.goal!)}`);
  }

  const addedTypes = (after.property?.types ?? []).filter(
    (t) => !(before.property?.types ?? []).some((u) => u.toLowerCase() === t.toLowerCase()),
  );
  if (addedTypes.length) {
    phrases.push(`looking for a ${addedTypes.map(typeLabel).join(' or ')}`);
  }

  const addedLocs = (after.locations ?? []).filter(
    (l) => !(before.locations ?? []).some((u) => u.toLowerCase() === l.toLowerCase()),
  );
  if (addedLocs.length) phrases.push(`in ${addedLocs.join(' or ')}`);

  const specs: string[] = [];
  if (before.property?.bedrooms_min !== after.property?.bedrooms_min && after.property?.bedrooms_min != null)
    specs.push(`at least ${after.property.bedrooms_min} bedrooms`);
  if (before.property?.bathrooms_min !== after.property?.bathrooms_min && after.property?.bathrooms_min != null)
    specs.push(`${after.property.bathrooms_min} bathrooms`);
  if (before.property?.sqft_min !== after.property?.sqft_min && after.property?.sqft_min != null)
    specs.push(`${after.property.sqft_min.toLocaleString()} sqft`);
  if (specs.length) phrases.push(`with ${specs.join(', ')}`);

  const budgetBits: string[] = [];
  if (before.budget?.purchase_price_max !== after.budget?.purchase_price_max && after.budget?.purchase_price_max != null)
    budgetBits.push(`a max purchase price of $${after.budget.purchase_price_max.toLocaleString()}`);
  if (before.budget?.monthly_payment_max !== after.budget?.monthly_payment_max && after.budget?.monthly_payment_max != null)
    budgetBits.push(`a max monthly payment of $${after.budget.monthly_payment_max.toLocaleString()}`);
  if (budgetBits.length) phrases.push(budgetBits.join(' and '));

  const lifestyleNew: string[] = [];
  const labels: Record<string, string> = {
    schools_importance: 'good schools',
    safety_importance: 'safety',
    walkability_importance: 'walkability',
    parks_importance: 'parks and nature',
    commute_importance: 'short commute',
  };
  for (const k of Object.keys(labels)) {
    const b = (before.lifestyle as any)?.[k];
    const a = (after.lifestyle as any)?.[k];
    if (a && a !== b) lifestyleNew.push(labels[k]);
  }
  if (lifestyleNew.length) phrases.push(`prioritizing ${lifestyleNew.join(', ')}`);

  const addedMust = (after.must_haves ?? []).filter(
    (l) => !(before.must_haves ?? []).some((u) => u.toLowerCase() === l.toLowerCase()),
  );
  if (addedMust.length) phrases.push(`must-haves: ${addedMust.join(', ')}`);

  const addedDB = (after.deal_breakers ?? []).filter(
    (l) => !(before.deal_breakers ?? []).some((u) => u.toLowerCase() === l.toLowerCase()),
  );
  if (addedDB.length) phrases.push(`avoiding ${addedDB.join(', ')}`);

  const intro = phrases.length ? `Got it — I saved that ${phrases.join(', ')}.` : '';
  const q = missing ? nextQuestion(missing) : '';
  if (intro && q) return `${intro} ${q}`;
  if (intro) return `${intro} Want me to start browsing homes?`;
  if (q) return q;
  return 'Your preferences look complete. Want me to start browsing homes?';
}

// ---------- Deterministic fallback parser ----------

const CITY_MAP: Record<string, string> = {
  tampa: 'Tampa, FL', miami: 'Miami, FL', orlando: 'Orlando, FL', jacksonville: 'Jacksonville, FL',
  austin: 'Austin, TX', dallas: 'Dallas, TX', houston: 'Houston, TX', 'san antonio': 'San Antonio, TX',
  arlington: 'Arlington, VA', alexandria: 'Alexandria, VA', richmond: 'Richmond, VA',
  'washington': 'Washington, DC', 'dc': 'Washington, DC',
  bethesda: 'Bethesda, MD', baltimore: 'Baltimore, MD', rockville: 'Rockville, MD',
  atlanta: 'Atlanta, GA', charlotte: 'Charlotte, NC', raleigh: 'Raleigh, NC', nashville: 'Nashville, TN',
  denver: 'Denver, CO', phoenix: 'Phoenix, AZ', scottsdale: 'Scottsdale, AZ', 'las vegas': 'Las Vegas, NV',
  seattle: 'Seattle, WA', portland: 'Portland, OR',
  'san francisco': 'San Francisco, CA', oakland: 'Oakland, CA', 'san jose': 'San Jose, CA',
  'los angeles': 'Los Angeles, CA', 'san diego': 'San Diego, CA', sacramento: 'Sacramento, CA',
  chicago: 'Chicago, IL', 'new york': 'New York, NY', brooklyn: 'Brooklyn, NY', boston: 'Boston, MA',
  philadelphia: 'Philadelphia, PA', pittsburgh: 'Pittsburgh, PA',
  detroit: 'Detroit, MI', minneapolis: 'Minneapolis, MN', columbus: 'Columbus, OH', cleveland: 'Cleveland, OH',
};

function deterministicParse(text: string): Patch {
  const patch: Patch = {};
  const set: any = {};
  const add: any = {};
  if (!text || !text.trim()) return patch;
  const t = text.toLowerCase();

  // Buyer type (first-time, move-up, etc.) — also implies goal=buy_home
  if (/\b(first[- ]?time\s+(home\s+)?buyer|first[- ]?time\s+homebuyer|1st[- ]?time\s+(home\s+)?buyer)\b/.test(t)) {
    set.buyer_type = 'first_time_home_buyer';
    set.goal = 'buy_home';
  } else if (/\bmove[- ]?up\s+buyer\b/.test(t)) {
    set.buyer_type = 'move_up_buyer';
    set.goal = 'buy_home';
  } else if (/\bdownsiz(?:er|ing)\b/.test(t)) {
    set.buyer_type = 'downsizer';
    set.goal = 'buy_home';
  } else if (/\brelocat(?:ing|ion)\b/.test(t)) {
    set.buyer_type = 'relocating_buyer';
  }

  // Goal
  if (!set.goal) {
    if (/\b(invest|rental|cash[- ]?flow|brrrr|flip|landlord)\b/.test(t)) set.goal = 'invest';
    else if (/\b(rent|lease|leasing|renting)\b/.test(t) && !/rental/.test(t)) set.goal = 'rent';
    else if (/\b(buy|buying|homebuyer|home buyer|\bbuyer\b|primary residence|family home|first home|move[- ]?in|our home|my home)\b/.test(t)) set.goal = 'buy_home';
    else if (/\b(research|researching|just looking|browsing)\b/.test(t)) set.goal = 'market_research';
  }

  // Locations — explicit "City, ST"
  const locs: string[] = [];
  const cityStateRe = /([A-Z][a-zA-Z.\- ]+?),\s*([A-Z]{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = cityStateRe.exec(text)) !== null) {
    const name = m[1].trim().replace(/\s+/g, ' ');
    locs.push(`${name}, ${m[2].toUpperCase()}`);
  }
  // Known city inference
  for (const [k, v] of Object.entries(CITY_MAP)) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(t) && !locs.some((l) => l.toLowerCase() === v.toLowerCase())) locs.push(v);
  }
  if (locs.length) add.locations = locs;

  // Budget
  const budget: any = {};
  // monthly first to avoid swallowing
  const monthly = t.match(/(?:monthly|per month|\/mo|payment)[^$\d]{0,20}\$?\s*([\d,]+)(\s*k)?/);
  if (monthly) {
    let n = parseInt(monthly[1].replace(/,/g, ''), 10);
    if (monthly[2]) n *= 1000;
    if (Number.isFinite(n) && n > 0) budget.monthly_payment_max = n;
  }
  const price = t.match(/(?:under|below|max|up to|budget|around|about|<=?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m|thousand|million)?/) ||
    t.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|m|thousand|million)?/);
  if (price) {
    let n = parseFloat(price[1].replace(/,/g, ''));
    const u = (price[2] || '').toLowerCase();
    if (u === 'k' || u === 'thousand') n *= 1000;
    else if (u === 'm' || u === 'million') n *= 1_000_000;
    if (Number.isFinite(n) && n >= 1000) {
      // avoid duplicating monthly
      if (!budget.monthly_payment_max || Math.abs(budget.monthly_payment_max - n) > 1) {
        budget.purchase_price_max = n;
      }
    }
  }
  if (Object.keys(budget).length) set.budget = budget;

  // Bedrooms / bathrooms
  const bed = t.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:bed(?:room)?s?|br)\b/);
  const bath = t.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:bath(?:room)?s?|ba)\b/);
  const property: any = {};
  if (bed) property.bedrooms_min = parseFloat(bed[1]);
  if (bath) property.bathrooms_min = parseFloat(bath[1]);
  const sqft = t.match(/([\d,]{3,})\s*(?:sqft|sq\.?\s*\/?\s*ft|square\s*feet|sf)\b/);
  if (sqft) {
    const n = parseInt(sqft[1].replace(/,/g, ''), 10);
    if (Number.isFinite(n)) property.sqft_min = n;
  }
  if (Object.keys(property).length) set.property = property;

  // Property types
  const types: string[] = [];
  if (/\btownhouse|townhome|row house\b/.test(t)) types.push('townhouse');
  if (/\bcondo(minium)?\b/.test(t)) types.push('condo');
  if (/\bco-?op\b/.test(t)) types.push('co-op');
  if (/\bmulti[- ]?family|duplex|triplex|fourplex|2-4 unit\b/.test(t)) types.push('multi-family');
  if (/\bland|lot|acreage\b/.test(t)) types.push('land');
  if (/\bmobile|manufactured\b/.test(t)) types.push('mobile');
  if (/\b(single[- ]?family|sfh|detached|standalone house|\bhouse\b)\b/.test(t) && !types.includes('townhouse')) {
    types.push('house');
  }
  if (types.length) add.property_types = [...new Set(types)];

  // Lifestyle importance
  const lifestyle: any = {};
  if (/\b(good schools?|school district|great schools?)\b/.test(t)) lifestyle.schools_importance = 'high';
  if (/\b(safe|safety|low crime|secure)\b/.test(t)) lifestyle.safety_importance = 'high';
  if (/\b(walkab|walk to|walking distance)\b/.test(t)) lifestyle.walkability_importance = 'high';
  if (/\b(parks?|nature|green|trees|outdoors?)\b/.test(t)) lifestyle.parks_importance = 'high';
  if (/\b(short commute|close to work|near transit|public transit|commute)\b/.test(t)) lifestyle.commute_importance = 'high';
  if (Object.keys(lifestyle).length) set.lifestyle = lifestyle;

  // Must / nice / deal-breakers
  const must: string[] = [];
  const nice: string[] = [];
  const drop: string[] = [];
  if (/\b(must have|need(?:s|ed)?|required|gotta have)\b.*?\b(garage|yard|pool|office|basement|parking|ac|fence)\b/.test(t)) {
    const mm = t.match(/\b(garage|yard|pool|office|basement|parking|ac|fence)\b/);
    if (mm) must.push(mm[1]);
  }
  if (/\b(would love|nice to have|prefer)\b.*?\b(garage|yard|pool|office|basement|parking|fence)\b/.test(t)) {
    const mm = t.match(/\b(garage|yard|pool|office|basement|parking|fence)\b/);
    if (mm) nice.push(mm[1]);
  }
  if (/\b(no|avoid|dealbreaker|deal[- ]?breaker|can'?t have|don'?t want)\b/.test(t)) {
    const mm = t.match(/\bno\s+([a-z]{3,15})\b/) || t.match(/\bavoid\s+([a-z]{3,15})\b/);
    if (mm) drop.push(mm[1]);
  }
  if (must.length) add.must_haves = must;
  if (nice.length) add.nice_to_haves = nice;
  if (drop.length) add.deal_breakers = drop;

  if (Object.keys(set).length) patch.set = set;
  if (Object.keys(add).length) patch.add = add;

  // Nothing structured → keep raw text as a note
  if (!patch.set && !patch.add) {
    patch.append_note = text.trim().slice(0, 500);
  }
  return patch;
}

function dedupNoteInPatch(patch: Patch, prevNotes: string): Patch {
  if (!patch?.append_note) return patch;
  const note = patch.append_note.trim();
  if (!note) { const { append_note: _omit, ...rest } = patch; return rest; }
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const prevNorm = norm(prevNotes || '');
  const existingKeys = new Set(
    (prevNotes || '').split('\n').map((l) => norm(l)).filter(Boolean)
  );
  const keptLines = note
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      const k = norm(l);
      if (!k) return false;
      if (existingKeys.has(k)) return false;
      // Skip if the line is already contained as substring in existing notes
      if (prevNorm && prevNorm.includes(k)) return false;
      return true;
    });
  if (keptLines.length === 0) {
    const { append_note: _omit, ...rest } = patch;
    return rest;
  }
  return { ...patch, append_note: keptLines.join('\n') };
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

    // Pass 1: extract & persist BEFORE composing any reply text. This guarantees
    // the assistant's acknowledgment is grounded in what actually got saved.
    const extraction = await extractPatch(messages, currentPrefs);
    let backupMode = false;
    let rateLimited = false;
    let creditsExhausted = false;
    let rawPatch: Patch;
    if (extraction.ok) {
      rawPatch = extraction.patch;
    } else {
      backupMode = true;
      rateLimited = extraction.rateLimited;
      creditsExhausted = extraction.creditsExhausted;
      const latestUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      rawPatch = deterministicParse(latestUser);
      log.step('Fallback parse', { rateLimited, creditsExhausted, hasPatch: !!(rawPatch.set || rawPatch.add || rawPatch.append_note) });
    }

    const patch = dedupNoteInPatch(rawPatch, currentPrefs.freeform_notes ?? '');
    const nextPrefs = applyPatch(currentPrefs, patch);
    const changeSummary = diffSummary(currentPrefs, nextPrefs);
    const saved = savedSummary(currentPrefs, nextPrefs);
    log.step('Extraction', { changes: changeSummary, saved });

    // Persist BEFORE replying so the UI's Current Preferences reflects truth.
    const updates: Record<string, unknown> = { preferences: nextPrefs, ...mirrorToLegacyColumns(nextPrefs) };
    const { error: updateErr } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (updateErr) {
      log.step('Profile update failed', { error: updateErr.message });
      return jsonResponse({
        preferences: currentPrefs,
        message: `I couldn't save that to your profile (${updateErr.message}). Please retry.`,
        suggested_replies: ['Retry'],
        soft_error: true,
      }, 200, req);
    }

    // Deterministic reply — no second AI call. This halves gateway pressure
    // and means setup keeps working even when the gateway is rate-limited.
    const missing = nextMissingField(nextPrefs);
    const suggested_replies = suggestedRepliesFor(missing);
    const message = fallbackAck(saved, nextPrefs);

    return jsonResponse({
      preferences: nextPrefs,
      message,
      suggested_replies,
      saved_summary: saved || null,
      backup_mode: backupMode,
      rate_limited: rateLimited,
      credits_exhausted: creditsExhausted,
    }, 200, req);
  } catch (error) {
    log.step('ERROR', { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error), 500, req);
  }
});