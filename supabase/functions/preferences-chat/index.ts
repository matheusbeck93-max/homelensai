import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getSupabaseEnv } from '../_shared/env.ts';
import { parseCityList } from '../_shared/usCities.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('preferences-chat');

type ProfileRecord = Record<string, unknown>;

interface Choice {
  label: string;
  value: string;
}

interface Question {
  key: string;
  assistant_message: string;
  choices?: Choice[];
  multi_select?: boolean;
  allow_text?: boolean;
}

/** Columns this function is allowed to write to on profiles. Anything else is dropped. */
const ALLOWED_FIELDS = new Set<string>([
  'primary_goal',
  'preferred_cities',
  'buyer_types',
  'budget_min',
  'budget_max',
  'min_bedrooms',
  'min_bathrooms',
  'min_sqft',
  'max_sqft',
  'must_have_features',
  'investment_strategies',
  'hold_period_years',
  'financing_preferences',
  'has_children',
  'children_ages',
  'climate_preference',
  'safety_priority',
  'about_me',
  'onboarding_completed',
]);

const PRIMARY_GOAL_CHOICES: Choice[] = [
  { label: 'Buy a home', value: 'buy_home' },
  { label: 'Invest', value: 'invest' },
  { label: 'Both', value: 'both' },
];

const PERSONA_CHOICES: Choice[] = [
  { label: 'First-time Buyer', value: 'first_time_buyer' },
  { label: 'Move-up Buyer', value: 'move_up_buyer' },
  { label: 'Investor', value: 'investor' },
  { label: 'Downsizer', value: 'downsizer' },
  { label: 'Relocator', value: 'relocator' },
];

const BUDGET_CHOICES: Choice[] = [
  { label: 'Under $300k', value: 'budget_under_300' },
  { label: '$300k–$500k', value: 'budget_300_500' },
  { label: '$500k–$750k', value: 'budget_500_750' },
  { label: '$750k–$1M', value: 'budget_750_1000' },
  { label: '$1M+', value: 'budget_over_1000' },
];

const BEDROOM_CHOICES: Choice[] = [
  { label: '1+ bed', value: '1' },
  { label: '2+ beds', value: '2' },
  { label: '3+ beds', value: '3' },
  { label: '4+ beds', value: '4' },
  { label: '5+ beds', value: '5' },
];

const BATHROOM_CHOICES: Choice[] = [
  { label: '1+ bath', value: '1' },
  { label: '2+ baths', value: '2' },
  { label: '3+ baths', value: '3' },
  { label: '4+ baths', value: '4' },
];

const FEATURE_CHOICES: Choice[] = [
  { label: 'Garage', value: 'garage' },
  { label: 'Pool', value: 'pool' },
  { label: 'Yard', value: 'yard' },
  { label: 'Basement', value: 'basement' },
  { label: 'Central A/C', value: 'central-ac' },
  { label: 'Updated Kitchen', value: 'updated-kitchen' },
  { label: 'Home Office', value: 'home-office' },
  { label: 'Open Floor Plan', value: 'open-floor-plan' },
  { label: 'No preference', value: 'no_preference' },
];

const STRATEGY_CHOICES: Choice[] = [
  { label: 'Primary Residence', value: 'primary_residence' },
  { label: 'Buy & Hold', value: 'buy_and_hold' },
  { label: 'Fix & Flip', value: 'flip' },
  { label: 'Vacation Home', value: 'vacation_home' },
  { label: 'BRRRR', value: 'brrrr' },
  { label: 'House Hacking', value: 'house_hack' },
];

const HOLD_PERIOD_CHOICES: Choice[] = [
  { label: '1 year', value: '1' },
  { label: '3 years', value: '3' },
  { label: '5 years', value: '5' },
  { label: '10+ years', value: '10' },
];

const FINANCING_CHOICES: Choice[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'Conventional', value: 'conventional' },
  { label: 'FHA', value: 'fha' },
  { label: 'VA', value: 'va' },
  { label: 'USDA', value: 'usda' },
  { label: 'Hard Money', value: 'hard_money' },
];

const YES_NO_CHOICES: Choice[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

const CHILD_AGE_CHOICES: Choice[] = [
  { label: 'Infant (0–2)', value: 'infant' },
  { label: 'Toddler (3–5)', value: 'toddler' },
  { label: 'Elementary (6–10)', value: 'elementary' },
  { label: 'Middle School (11–13)', value: 'middle-school' },
  { label: 'High School (14–18)', value: 'high-school' },
];

const CLIMATE_CHOICES: Choice[] = [
  { label: 'Warm', value: 'warm' },
  { label: 'Mild', value: 'mild' },
  { label: 'Cold', value: 'cold' },
  { label: 'Four Seasons', value: 'four_seasons' },
  { label: 'No Preference', value: 'no_preference' },
];

const SAFETY_CHOICES: Choice[] = [
  { label: 'Very High', value: 'very_high' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const SKIP_CHOICES: Choice[] = [{ label: 'Skip', value: 'skip' }];

/** Navigation buttons surfaced on every onboarding question turn. */
const NAV_CHOICES_FULL: Choice[] = [
  { label: '← Back', value: 'nav:back' },
  { label: 'Skip', value: 'nav:skip' },
  { label: '↻ Reset all', value: 'nav:restart' },
];
const NAV_CHOICES_FIRST: Choice[] = [
  { label: 'Skip', value: 'nav:skip' },
  { label: '↻ Reset all', value: 'nav:restart' },
];

const EDIT_CATEGORY_CHOICES: Choice[] = [
  { label: 'Goal', value: 'edit:primary_goal' },
  { label: 'Cities', value: 'edit:preferred_cities' },
  { label: 'Persona', value: 'edit:buyer_types' },
  { label: 'Budget', value: 'edit:budget' },
  { label: 'Bedrooms', value: 'edit:min_bedrooms' },
  { label: 'Bathrooms', value: 'edit:min_bathrooms' },
  { label: 'Features', value: 'edit:must_have_features' },
  { label: 'Strategy', value: 'edit:investment_strategies' },
  { label: 'Hold period', value: 'edit:hold_period_years' },
  { label: 'Financing', value: 'edit:financing_preferences' },
  { label: 'Kids', value: 'edit:has_children' },
  { label: 'Climate', value: 'edit:climate_preference' },
  { label: 'Safety', value: 'edit:safety_priority' },
  { label: 'About me', value: 'edit:about_me' },
  { label: 'Reset preferences', value: 'edit:restart_all' },
];

const COMPLETION_CHOICES: Choice[] = [
  { label: 'Done', value: 'complete:looks_good' },
  { label: 'Change something', value: 'complete:change' },
  { label: 'Reset preferences', value: 'complete:restart' },
];

const FRIENDLY_FIELD_LABEL: Record<string, string> = {
  primary_goal: 'goal',
  preferred_cities: 'cities',
  buyer_types: 'persona',
  budget: 'budget',
  budget_min: 'budget',
  budget_max: 'budget',
  min_bedrooms: 'minimum bedrooms',
  min_bathrooms: 'minimum bathrooms',
  must_have_features: 'must-have features',
  investment_strategies: 'investment strategy',
  hold_period_years: 'hold period',
  financing_preferences: 'financing',
  has_children: 'kids info',
  children_ages: 'kids info',
  climate_preference: 'climate preference',
  safety_priority: 'safety priority',
  about_me: 'note',
  onboarding_completed: 'preferences',
};

const EDITABLE_KEYS = new Set(
  EDIT_CATEGORY_CHOICES.map((c) => c.value.replace(/^edit:/, '')).filter((k) => k !== 'restart_all'),
);

const CATEGORY_KEYWORDS: Array<{ key: string; words: string[] }> = [
  { key: 'primary_goal', words: ['goal', 'objective'] },
  { key: 'preferred_cities', words: ['city', 'cities', 'location', 'area', 'where'] },
  { key: 'buyer_types', words: ['persona', 'buyer type', 'profile'] },
  { key: 'budget', words: ['budget', 'price', 'afford', 'money'] },
  { key: 'min_bedrooms', words: ['bedroom', 'beds', 'br'] },
  { key: 'min_bathrooms', words: ['bathroom', 'baths', 'ba'] },
  { key: 'must_have_features', words: ['feature', 'amenit', 'must have'] },
  { key: 'investment_strategies', words: ['strategy', 'invest'] },
  { key: 'hold_period_years', words: ['hold', 'duration'] },
  { key: 'financing_preferences', words: ['financ', 'loan', 'mortgage', 'cash'] },
  { key: 'has_children', words: ['kid', 'child', 'school'] },
  { key: 'climate_preference', words: ['climate', 'weather', 'warm', 'cold'] },
  { key: 'safety_priority', words: ['safe', 'crime'] },
  { key: 'about_me', words: ['about', 'note', 'else'] },
];

const STATE_MARKER_RE = /\n?<!--pc:(.*?)-->/g;

function encodeState(state: Record<string, unknown>): string {
  return `\n<!--pc:${JSON.stringify(state)}-->`;
}

function decodeStateFromLastAssistant(
  messages: Array<{ role: string; content: string }>,
): Record<string, unknown> | null {
  const last = [...messages].reverse().find((m) => m?.role === 'assistant' && typeof m.content === 'string');
  if (!last) return null;
  const match = [...last.content.matchAll(STATE_MARKER_RE)].pop();
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function detectEditCategory(content: string): string | null {
  const trimmed = content.trim();
  const exact = EDIT_CATEGORY_CHOICES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase() || c.value === trimmed);
  if (exact) return exact.value.replace(/^edit:/, '');
  if (/^restart|reset|start over|change (all|everything)/i.test(trimmed)) return 'restart_all';
  const lower = trimmed.toLowerCase();
  for (const c of CATEGORY_KEYWORDS) {
    if (c.words.some((w) => lower.includes(w))) return c.key;
  }
  return null;
}

function questionForKey(key: string): Question | null {
  switch (key) {
    case 'primary_goal':
      return { key, assistant_message: "What's your primary goal with HomeLens?", choices: PRIMARY_GOAL_CHOICES, multi_select: false, allow_text: false };
    case 'preferred_cities':
      return { key, assistant_message: 'Which US cities or areas are you interested in? You can list more than one.', allow_text: true };
    case 'buyer_types':
      return { key, assistant_message: 'Which profile best describes you?', choices: PERSONA_CHOICES, multi_select: true, allow_text: false };
    case 'budget':
      return { key, assistant_message: "What's your ideal budget range?", choices: BUDGET_CHOICES, multi_select: false, allow_text: true };
    case 'min_bedrooms':
      return { key, assistant_message: 'Minimum bedrooms?', choices: BEDROOM_CHOICES, multi_select: false, allow_text: true };
    case 'min_bathrooms':
      return { key, assistant_message: 'Minimum bathrooms?', choices: BATHROOM_CHOICES, multi_select: false, allow_text: true };
    case 'must_have_features':
      return { key, assistant_message: 'Which features matter most?', choices: FEATURE_CHOICES, multi_select: true, allow_text: true };
    case 'investment_strategies':
      return { key, assistant_message: 'Which investment strategy fits best?', choices: STRATEGY_CHOICES, multi_select: true, allow_text: false };
    case 'hold_period_years':
      return { key, assistant_message: 'How long do you expect to hold the property?', choices: HOLD_PERIOD_CHOICES, multi_select: false, allow_text: true };
    case 'financing_preferences':
      return { key, assistant_message: 'How do you expect to finance the purchase?', choices: FINANCING_CHOICES, multi_select: true, allow_text: false };
    case 'has_children':
      return { key, assistant_message: 'Should HomeLens consider children or school-age needs?', choices: YES_NO_CHOICES, multi_select: false, allow_text: false };
    case 'children_ages':
      return { key, assistant_message: 'Which age ranges should HomeLens consider?', choices: CHILD_AGE_CHOICES, multi_select: true, allow_text: false };
    case 'climate_preference':
      return { key, assistant_message: 'What climate do you prefer?', choices: CLIMATE_CHOICES, multi_select: false, allow_text: false };
    case 'safety_priority':
      return { key, assistant_message: 'How important is neighborhood safety in your search?', choices: SAFETY_CHOICES, multi_select: false, allow_text: false };
    case 'about_me':
      return { key, assistant_message: 'Anything else HomeLens should know about your search?', choices: SKIP_CHOICES, multi_select: false, allow_text: true };
    default:
      return null;
  }
}

function formatCurrentValue(key: string, profile: ProfileRecord): string | null {
  const v = profile[key];
  const money = (n: unknown) => (typeof n === 'number' ? `$${n.toLocaleString()}` : null);
  switch (key) {
    case 'primary_goal':
    case 'climate_preference':
    case 'safety_priority':
      return typeof v === 'string' ? v.replace(/_/g, ' ') : null;
    case 'preferred_cities':
    case 'buyer_types':
    case 'must_have_features':
    case 'investment_strategies':
    case 'financing_preferences':
    case 'children_ages':
      return Array.isArray(v) && v.length ? v.join(', ') : null;
    case 'budget': {
      const lo = money(profile.budget_min); const hi = money(profile.budget_max);
      if (!lo && !hi) return null;
      return `${lo ?? '—'} – ${hi ?? '—'}`;
    }
    case 'min_bedrooms':
    case 'min_bathrooms':
    case 'hold_period_years':
      return typeof v === 'number' ? String(v) : null;
    case 'has_children':
      return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : null;
    case 'about_me':
      return typeof v === 'string' && v ? cleanAboutMeValue(v) || null : null;
    default:
      return null;
  }
}

function editMenuResponse(prefix?: string) {
  return {
    assistant_message:
      `${prefix ? `${prefix} ` : ''}What would you like to update? Pick a category or just type what you'd like to change.` +
      encodeState({ mode: 'edit_menu' }),
    choices: EDIT_CATEGORY_CHOICES,
    nav_choices: [] as Choice[],
    multi_select: false,
    allow_text: true,
    done: false,
    saved_fields: [] as string[],
  };
}

function recapLines(profile: ProfileRecord): string[] {
  const items: Array<[string, string]> = [
    ['Goal', formatCurrentValue('primary_goal', profile) ?? ''],
    ['Cities', formatCurrentValue('preferred_cities', profile) ?? ''],
    ['Persona', formatCurrentValue('buyer_types', profile) ?? ''],
    ['Budget', formatCurrentValue('budget', profile) ?? ''],
    ['Bedrooms', formatCurrentValue('min_bedrooms', profile) ?? ''],
    ['Bathrooms', formatCurrentValue('min_bathrooms', profile) ?? ''],
    ['Features', formatCurrentValue('must_have_features', profile) ?? ''],
    ['Strategy', formatCurrentValue('investment_strategies', profile) ?? ''],
    ['Hold period', formatCurrentValue('hold_period_years', profile) ?? ''],
    ['Financing', formatCurrentValue('financing_preferences', profile) ?? ''],
    ['Kids', formatCurrentValue('has_children', profile) ?? ''],
    ['Climate', formatCurrentValue('climate_preference', profile) ?? ''],
    ['Safety', formatCurrentValue('safety_priority', profile) ?? ''],
    ['Note', formatCurrentValue('about_me', profile) ?? ''],
  ];
  return items.filter(([, v]) => v).map(([k, v]) => `- **${k}:** ${v}`);
}

function completionSummaryResponse(profile: ProfileRecord, savedFields: string[]) {
  const recap = recapLines(profile);
  const body = [
    "All saved. Your preferences are ready.",
    recap.length ? `\n**Here's what I have:**\n${recap.join('\n')}` : '',
    `\nYou can type things like "reset preferences", "edit budget", or add any note (e.g. "close to a Whole Foods").`,
  ]
    .filter(Boolean)
    .join('\n');
  return {
    assistant_message: `${body}${encodeState({ mode: 'completed_summary' })}`,
    choices: COMPLETION_CHOICES,
    nav_choices: [] as Choice[],
    multi_select: false,
    allow_text: true,
    done: true,
    saved_fields: savedFields,
  };
}

function finalAcknowledgementResponse() {
  return {
    assistant_message:
      `Got it — saved. Ask me anytime to "edit" or "reset", or add a new preference like "close to a Whole Foods".` +
      encodeState({ mode: 'closed' }),
    choices: [] as Choice[],
    nav_choices: [] as Choice[],
    multi_select: false,
    allow_text: true,
    done: true,
    saved_fields: [] as string[],
  };
}

function questionResponseWithState(
  question: Question,
  profile: ProfileRecord,
  opts: { editing: boolean; prefix?: string; questionIndex?: number },
) {
  const current = opts.editing ? formatCurrentValue(question.key, profile) : null;
  const lead = opts.prefix ? `${opts.prefix} ` : '';
  const ctx = current ? `Your current ${question.key.replace(/_/g, ' ')}: **${current}**.\n\n` : '';
  const idx = opts.questionIndex ?? 0;
  const state = opts.editing
    ? encodeState({ mode: 'editing', key: question.key })
    : encodeState({ mode: 'onboarding', key: question.key, idx });
  const nav = opts.editing ? [] : (idx === 0 ? NAV_CHOICES_FIRST : NAV_CHOICES_FULL);
  return {
    assistant_message: `${lead}${ctx}${question.assistant_message}${state}`,
    choices: question.choices ?? [],
    nav_choices: nav,
    multi_select: Boolean(question.multi_select),
    allow_text: question.allow_text !== false,
    done: false,
    saved_fields: [] as string[],
  };
}
const PERSONA_VALUES = PERSONA_CHOICES.map((c) => c.value);
const STRATEGY_VALUES = STRATEGY_CHOICES.map((c) => c.value);
const FINANCING_VALUES = FINANCING_CHOICES.map((c) => c.value);
const FEATURE_VALUES = FEATURE_CHOICES.filter((c) => c.value !== 'no_preference').map((c) => c.value);
const CHILD_AGE_VALUES = CHILD_AGE_CHOICES.map((c) => c.value);
const CLIMATE_VALUES = CLIMATE_CHOICES.map((c) => c.value);
const SAFETY_VALUES = SAFETY_CHOICES.map((c) => c.value);
const PRIMARY_GOAL_VALUES = PRIMARY_GOAL_CHOICES.map((c) => c.value);

function sanitizeUpdates(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    out[key] = normalizeFieldValue(key, value);
  }
  return out;
}

function normalizeFieldValue(key: string, value: unknown): unknown {
  if (value === '' || value === undefined) return null;

  const intFields = ['budget_min', 'budget_max', 'min_bedrooms', 'min_bathrooms', 'min_sqft', 'max_sqft', 'hold_period_years'];
  if (intFields.includes(key)) {
    if (value === null) return null;
    const n = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, ''), 10) : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  if (key === 'has_children' || key === 'onboarding_completed') return Boolean(value);

  const arrayFields: Record<string, string[] | null> = {
    preferred_cities: null,
    buyer_types: PERSONA_VALUES,
    investment_strategies: STRATEGY_VALUES,
    financing_preferences: FINANCING_VALUES,
    must_have_features: null,
    children_ages: CHILD_AGE_VALUES,
  };
  if (key in arrayFields) {
    if (value === null) return null;
    if (Array.isArray(value) && value.length === 0) return [];
    const arr = Array.isArray(value) ? value : [value];
    const cleaned = arr
      .map((v) => (typeof v === 'string' ? v.trim() : v))
      .filter((v) => typeof v === 'string' && v.length > 0) as string[];
    const whitelist = arrayFields[key];
    const filtered = whitelist ? cleaned.filter((v) => whitelist.includes(v)) : cleaned;
    return filtered.length > 0 ? filtered : null;
  }

  const enumFields: Record<string, string[]> = {
    primary_goal: PRIMARY_GOAL_VALUES,
    climate_preference: CLIMATE_VALUES,
    safety_priority: SAFETY_VALUES,
  };
  if (key in enumFields) {
    if (value === null) return null;
    const v = typeof value === 'string' ? value : String(value);
    return enumFields[key].includes(v) ? v : null;
  }

  if (key === 'about_me') {
    if (value === null) return null;
    const cleaned = cleanAboutMeValue(value);
    return cleaned || null;
  }

  return value;
}

function hasValue(profile: ProfileRecord, key: string): boolean {
  const value = profile[key];
  return value !== null && value !== undefined && value !== '';
}

function hasArray(profile: ProfileRecord, key: string): boolean {
  return Array.isArray(profile[key]);
}

function isInvestmentRelevant(profile: ProfileRecord): boolean {
  const goal = profile.primary_goal;
  const buyerTypes = Array.isArray(profile.buyer_types) ? profile.buyer_types : [];
  return goal === 'invest' || goal === 'both' || buyerTypes.includes('investor');
}

function nextQuestion(profile: ProfileRecord): Question | null {
  if (profile.onboarding_completed === true) return null;
  if (!hasValue(profile, 'primary_goal')) {
    return {
      key: 'primary_goal',
      assistant_message: "What's your primary goal with HomeLens?",
      choices: PRIMARY_GOAL_CHOICES,
      multi_select: false,
      allow_text: false,
    };
  }
  if (!hasArray(profile, 'preferred_cities')) {
    return {
      key: 'preferred_cities',
      assistant_message: 'Which US cities or areas are you interested in? You can list more than one.',
      allow_text: true,
    };
  }
  if (!hasArray(profile, 'buyer_types')) {
    return {
      key: 'buyer_types',
      assistant_message: 'Which profile best describes you?',
      choices: PERSONA_CHOICES,
      multi_select: true,
      allow_text: false,
    };
  }
  if (!hasValue(profile, 'budget_min') && !hasValue(profile, 'budget_max')) {
    return {
      key: 'budget',
      assistant_message: "What's your ideal budget range?",
      choices: BUDGET_CHOICES,
      multi_select: false,
      allow_text: true,
    };
  }
  if (!hasValue(profile, 'min_bedrooms')) {
    return {
      key: 'min_bedrooms',
      assistant_message: 'Minimum bedrooms?',
      choices: BEDROOM_CHOICES,
      multi_select: false,
      allow_text: true,
    };
  }
  if (!hasValue(profile, 'min_bathrooms')) {
    return {
      key: 'min_bathrooms',
      assistant_message: 'Minimum bathrooms?',
      choices: BATHROOM_CHOICES,
      multi_select: false,
      allow_text: true,
    };
  }
  if (!hasArray(profile, 'must_have_features')) {
    return {
      key: 'must_have_features',
      assistant_message: 'Which features matter most?',
      choices: FEATURE_CHOICES,
      multi_select: true,
      allow_text: true,
    };
  }
  if (isInvestmentRelevant(profile) && !hasArray(profile, 'investment_strategies')) {
    return {
      key: 'investment_strategies',
      assistant_message: 'Which investment strategy fits best?',
      choices: STRATEGY_CHOICES,
      multi_select: true,
      allow_text: false,
    };
  }
  if (isInvestmentRelevant(profile) && !hasValue(profile, 'hold_period_years')) {
    return {
      key: 'hold_period_years',
      assistant_message: 'How long do you expect to hold the property?',
      choices: HOLD_PERIOD_CHOICES,
      multi_select: false,
      allow_text: true,
    };
  }
  if (!hasArray(profile, 'financing_preferences')) {
    return {
      key: 'financing_preferences',
      assistant_message: 'How do you expect to finance the purchase?',
      choices: FINANCING_CHOICES,
      multi_select: true,
      allow_text: false,
    };
  }
  if (!hasValue(profile, 'has_children')) {
    return {
      key: 'has_children',
      assistant_message: 'Should HomeLens consider children or school-age needs?',
      choices: YES_NO_CHOICES,
      multi_select: false,
      allow_text: false,
    };
  }
  if (profile.has_children === true && !hasArray(profile, 'children_ages')) {
    return {
      key: 'children_ages',
      assistant_message: 'Which age ranges should HomeLens consider?',
      choices: CHILD_AGE_CHOICES,
      multi_select: true,
      allow_text: false,
    };
  }
  if (!hasValue(profile, 'climate_preference')) {
    return {
      key: 'climate_preference',
      assistant_message: 'What climate do you prefer?',
      choices: CLIMATE_CHOICES,
      multi_select: false,
      allow_text: false,
    };
  }
  if (!hasValue(profile, 'safety_priority')) {
    return {
      key: 'safety_priority',
      assistant_message: 'How important is neighborhood safety in your search?',
      choices: SAFETY_CHOICES,
      multi_select: false,
      allow_text: false,
    };
  }
  if (!hasValue(profile, 'about_me')) {
    return {
      key: 'about_me',
      assistant_message: 'Anything else HomeLens should know about your search?',
      choices: SKIP_CHOICES,
      multi_select: false,
      allow_text: true,
    };
  }
  return null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\$/g, '')
    .replace(/[,+]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function selectedValues(content: string, choices: Choice[]): string[] {
  const normalizedContent = normalizeText(content);
  const chunks = content
    .split(/[,;\n]|\band\b/i)
    .map(normalizeText)
    .filter(Boolean);
  const out = new Set<string>();

  for (const choice of choices) {
    const label = normalizeText(choice.label);
    const value = normalizeText(choice.value);
    if (normalizedContent === label || normalizedContent === value || chunks.includes(label) || chunks.includes(value)) {
      out.add(choice.value);
    }
  }

  return [...out];
}

function toKebab(value: string): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

function parseCities(content: string): { accepted: string[]; rejected: string[] } {
  return parseCityList(content);
}

function titleCase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function parseMoneyNumbers(content: string): number[] {
  const matches = [...content.matchAll(/(\d+(?:\.\d+)?)\s*(m|million|k|thousand)?/gi)];
  const numbers = matches.map((match) => {
    const amount = Number(match[1]);
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'm' || suffix === 'million') return Math.round(amount * 1_000_000);
    if (suffix === 'k' || suffix === 'thousand') return Math.round(amount * 1_000);
    return Math.round(amount);
  });

  if (numbers.length === 2 && numbers[0] < 10_000 && numbers[1] >= 100_000) {
    numbers[0] = numbers[1] >= 1_000_000 ? numbers[0] * 1_000_000 : numbers[0] * 1_000;
  }

  return numbers;
}

function parseBudget(content: string): Record<string, unknown> {
  const budgetChoice = selectedValues(content, BUDGET_CHOICES)[0];
  if (budgetChoice === 'budget_under_300') return { budget_max: 300_000 };
  if (budgetChoice === 'budget_300_500') return { budget_min: 300_000, budget_max: 500_000 };
  if (budgetChoice === 'budget_500_750') return { budget_min: 500_000, budget_max: 750_000 };
  if (budgetChoice === 'budget_750_1000') return { budget_min: 750_000, budget_max: 1_000_000 };
  if (budgetChoice === 'budget_over_1000') return { budget_min: 1_000_000 };

  const numbers = parseMoneyNumbers(content);
  if (numbers.length >= 2) {
    const [min, max] = numbers.slice(0, 2).sort((a, b) => a - b);
    return { budget_min: min, budget_max: max };
  }
  if (numbers.length === 1) {
    const lower = content.toLowerCase();
    if (/over|above|from|minimum|min\b/.test(lower)) return { budget_min: numbers[0] };
    return { budget_max: numbers[0] };
  }
  return {};
}

function parseFirstNumber(content: string, choices: Choice[]): number | null {
  const selected = selectedValues(content, choices)[0];
  if (selected) return Number(selected);
  const match = content.match(/\d+/);
  return match ? Number(match[0]) : null;
}

interface ParsedAnswer {
  updates: Record<string, unknown>;
  note?: string;
}

function parseAnswerForQuestion(question: Question | null, content: string): ParsedAnswer {
  if (!question) return { updates: {} };

  switch (question.key) {
    case 'primary_goal': {
      const value = selectedValues(content, PRIMARY_GOAL_CHOICES)[0];
      return { updates: value ? { primary_goal: value } : {} };
    }
    case 'preferred_cities': {
      const { accepted, rejected } = parseCities(content);
      if (accepted.length) {
        let note: string | undefined;
        if (rejected.length) {
          note = `I couldn't recognize: ${rejected.join(', ')}. I saved the rest.`;
        }
        return { updates: { preferred_cities: accepted }, note };
      }
      const note = rejected.length
        ? `I couldn't recognize "${rejected.join(', ')}" as a US city or state. Try something like "Austin, TX" or "Florida".`
        : `Please share at least one US city or state (e.g. "Austin, TX").`;
      return { updates: {}, note };
    }
    case 'buyer_types': {
      const values = selectedValues(content, PERSONA_CHOICES);
      return { updates: values.length ? { buyer_types: values } : {} };
    }
    case 'budget':
      return { updates: parseBudget(content) };
    case 'min_bedrooms': {
      const n = parseFirstNumber(content, BEDROOM_CHOICES);
      return { updates: n ? { min_bedrooms: n } : {} };
    }
    case 'min_bathrooms': {
      const n = parseFirstNumber(content, BATHROOM_CHOICES);
      return { updates: n ? { min_bathrooms: n } : {} };
    }
    case 'must_have_features': {
      const values = selectedValues(content, FEATURE_CHOICES);
      if (values.includes('no_preference')) return { updates: { must_have_features: [] } };
      if (values.length) return { updates: { must_have_features: values.filter((v) => v !== 'no_preference') } };
      const custom = content
        .split(/[,;\n]|\band\b/i)
        .map(toKebab)
        .filter(Boolean);
      return { updates: custom.length ? { must_have_features: custom } : {} };
    }
    case 'investment_strategies': {
      const values = selectedValues(content, STRATEGY_CHOICES);
      return { updates: values.length ? { investment_strategies: values } : {} };
    }
    case 'hold_period_years': {
      const n = parseFirstNumber(content, HOLD_PERIOD_CHOICES);
      return { updates: n ? { hold_period_years: n } : {} };
    }
    case 'financing_preferences': {
      const values = selectedValues(content, FINANCING_CHOICES);
      return { updates: values.length ? { financing_preferences: values } : {} };
    }
    case 'has_children': {
      const value = selectedValues(content, YES_NO_CHOICES)[0];
      if (value === 'yes') return { updates: { has_children: true } };
      if (value === 'no') return { updates: { has_children: false, children_ages: [] } };
      return { updates: {} };
    }
    case 'children_ages': {
      const values = selectedValues(content, CHILD_AGE_CHOICES);
      return { updates: values.length ? { children_ages: values } : {} };
    }
    case 'climate_preference': {
      const value = selectedValues(content, CLIMATE_CHOICES)[0];
      return { updates: value ? { climate_preference: value } : {} };
    }
    case 'safety_priority': {
      const value = selectedValues(content, SAFETY_CHOICES)[0];
      return { updates: value ? { safety_priority: value } : {} };
    }
    case 'about_me': {
      const skip = selectedValues(content, SKIP_CHOICES)[0];
      if (skip === 'skip') return { updates: { onboarding_completed: true } };
      return { updates: content.trim() ? { about_me: content.trim() } : {} };
    }
    default:
      return { updates: {} };
  }
}

function latestUserMessage(messages: Array<{ role: string; content: string }>): string | null {
  const latest = [...messages].reverse().find((m) => m?.role === 'user' && typeof m.content === 'string' && m.content.trim());
  return latest?.content.trim() ?? null;
}

/** Ordered list of question keys for back/forward navigation in onboarding. */
const QUESTION_ORDER: string[] = [
  'primary_goal',
  'preferred_cities',
  'buyer_types',
  'budget',
  'min_bedrooms',
  'min_bathrooms',
  'must_have_features',
  'investment_strategies',
  'hold_period_years',
  'financing_preferences',
  'has_children',
  'children_ages',
  'climate_preference',
  'safety_priority',
  'about_me',
];

type Intent =
  | { kind: 'reset' }
  | { kind: 'back' }
  | { kind: 'skip' }
  | { kind: 'edit'; key: string; valueText?: string }
  | { kind: 'custom_pref'; text: string }
  | { kind: 'ui_command' }
  | { kind: 'answer' };

function detectIntent(raw: string, opts: { inQuestionnaire: boolean }): Intent {
  const t = raw.trim();
  const low = t.toLowerCase();
  // Reserved UI command tokens emitted by buttons — never treat as free text.
  if (t === 'complete:restart') return { kind: 'reset' };
  if (t === 'complete:change' || t === 'complete:looks_good') return { kind: 'ui_command' };
  // Explicit nav buttons
  if (t === 'nav:back' || /^(back|go back|previous|prev)\b\.?$/i.test(low)) return { kind: 'back' };
  if (t === 'nav:skip' || /^skip\b\.?$/i.test(low)) return { kind: 'skip' };
  if (
    t === 'nav:restart' ||
    /^(reset|restart|start over|clear all|wipe)( (everything|preferences|all|prefs))?\b\.?$/i.test(low) ||
    /^reset preferences?\b/i.test(low) ||
    /^restart preferences?\b/i.test(low)
  ) return { kind: 'reset' };
  // edit:<field> button or "edit <field>" / "change <field>" / "update <field>"
  if (t.startsWith('edit:')) {
    const k = t.slice(5);
    if (k === 'restart_all') return { kind: 'reset' };
    if (EDITABLE_KEYS.has(k)) return { kind: 'edit', key: k };
    // Unknown edit:* token — don't fall through to custom_pref.
    return { kind: 'ui_command' };
  }
  // Natural language "change/edit/update <category> [to <value>]" — capture value too.
  const editMatch = t.match(/^(edit|change|update|set)\s+(?:my\s+)?(.+)$/i);
  if (editMatch) {
    const rest = editMatch[2];
    const restLow = rest.toLowerCase();
    for (const c of CATEGORY_KEYWORDS) {
      if (c.words.some((w) => restLow.includes(w))) {
        // Strip the category words + optional "to" / ":" to isolate the value.
        let valueText = rest;
        const sepMatch = valueText.match(/\b(?:to|:|=)\b\s*(.+)$/i);
        if (sepMatch) valueText = sepMatch[1];
        else {
          // Drop the first matched category word
          for (const w of c.words) {
            const re = new RegExp(`\\b${w}\\w*\\b`, 'i');
            if (re.test(valueText)) { valueText = valueText.replace(re, '').trim(); break; }
          }
        }
        valueText = valueText.trim().replace(/^[,:;\s-]+/, '').trim();
        return { kind: 'edit', key: c.key, valueText: valueText || undefined };
      }
    }
  }
  // Outside the questionnaire, treat any free text as a custom preference note.
  if (!opts.inQuestionnaire) {
    return { kind: 'custom_pref', text: t };
  }
  return { kind: 'answer' };
}

function appendAboutMe(existing: unknown, addition: string): string {
  const prev = cleanAboutMeValue(existing);
  const { text: add } = stripReservedTokens(addition);
  if (!add) return prev;
  if (!prev) return add.slice(0, 2000);
  return `${prev}; ${add}`.slice(0, 2000);
}

function stripReservedTokens(value: string): { text: string; hadCommand: boolean } {
  const hadCommand = /\b(?:complete:(?:change|restart|looks_good)|nav:(?:back|skip|restart)|edit:restart_all)\b/i.test(value);
  return {
    text: value.replace(/\b(?:complete:(?:change|restart|looks_good)|nav:(?:back|skip|restart)|edit:restart_all)\b/gi, '').trim(),
    hadCommand,
  };
}

function looksLikeLocationOnlyPreference(value: string): boolean {
  const { text } = stripReservedTokens(value);
  if (!text) return false;
  const { accepted, rejected } = parseCities(text);
  const stateWordRe = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;
  const hasPreferenceWords = /\b(close|near|nearby|within|walk|store|school|commute|transit|park|grocery|whole\s*foods|trader\s*joe|costco)\b/i.test(text);
  if (accepted.length > 0 && rejected.length === 0) return true;
  return stateWordRe.test(text) && (text.includes(',') || /\bcounty\b/i.test(text)) && !hasPreferenceWords;
}

function cleanAboutMeValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .split(';')
    .map((part) => stripReservedTokens(part))
    .filter(({ text, hadCommand }) => text && !hadCommand && !looksLikeLocationOnlyPreference(text))
    .map(({ text }) => text)
    .join('; ')
    .slice(0, 2000);
}

async function resetAllPreferences(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  currentProfile: ProfileRecord,
) {
  const reset: Record<string, unknown> = { onboarding_completed: false };
  for (const key of EDITABLE_KEYS) {
    if (key === 'budget') { reset.budget_min = null; reset.budget_max = null; continue; }
    if (key === 'has_children') { reset.has_children = null; reset.children_ages = null; continue; }
    reset[key] = null;
  }
  await supabase.from('profiles').update(reset).eq('id', userId);
  return { ...currentProfile, ...reset } as ProfileRecord;
}

function indexOfKey(key: string | null | undefined): number {
  if (!key) return 0;
  const i = QUESTION_ORDER.indexOf(key);
  return i < 0 ? 0 : i;
}

function responseForQuestion(question: Question, prefix?: string) {
  return {
    assistant_message: prefix ? `${prefix} ${question.assistant_message}` : question.assistant_message,
    choices: question.choices ?? [],
    multi_select: Boolean(question.multi_select),
    allow_text: question.allow_text !== false,
    done: false,
    saved_fields: [],
  };
}

Deno.serve((req: Request) => withRequestOrigin(req, () => (async (req) => {
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

    const body = await req.json().catch(() => null) as { messages?: Array<{ role: string; content: string }> } | null;
    if (!body || !Array.isArray(body.messages)) {
      return validationError('messages array is required', undefined, req);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const currentProfile = (profile ?? {}) as ProfileRecord;
    const latestContent = latestUserMessage(body.messages);
    const priorState = decodeStateFromLastAssistant(body.messages);
    const onboardingQuestion = nextQuestion(currentProfile);
    const isComplete = !onboardingQuestion;

    // No user message yet → opening turn.
    if (!latestContent) {
      if (isComplete) {
        return jsonResponse(completionSummaryResponse(currentProfile, []), 200, req);
      }
      const isFresh = !hasValue(currentProfile, 'primary_goal');
      const prefix = isFresh
        ? "Welcome! I'll ask a few quick questions to personalize HomeLens. Tap an option, type your answer, or say things like 'skip', 'back', 'reset', or 'edit budget' anytime."
        : undefined;
      const idx = indexOfKey(onboardingQuestion.key);
      return jsonResponse(
        questionResponseWithState(onboardingQuestion, currentProfile, { editing: false, prefix, questionIndex: idx }),
        200,
        req,
      );
    }

    // Universal intent layer (back / skip / reset / edit / custom).
    const inQuestionnaire = !isComplete && priorState?.mode !== 'completed_summary' && priorState?.mode !== 'closed';
    const intent = detectIntent(latestContent, { inQuestionnaire });

    if (intent.kind === 'reset') {
      const fresh = await resetAllPreferences(supabase, user.id, currentProfile);
      const q = nextQuestion(fresh);
      if (q) {
        return jsonResponse(
          questionResponseWithState(q, fresh, {
            editing: false,
            prefix: "Starting fresh — your preferences are cleared.",
            questionIndex: 0,
          }),
          200,
          req,
        );
      }
    }

    if (intent.kind === 'ui_command') {
      // complete:change → open edit menu; complete:looks_good → final ack.
      if (latestContent.trim() === 'complete:change') {
        return jsonResponse(editMenuResponse(), 200, req);
      }
      if (latestContent.trim() === 'complete:looks_good') {
        return jsonResponse(finalAcknowledgementResponse(), 200, req);
      }
      // Unknown ui_command → re-show completion summary safely.
      return jsonResponse(completionSummaryResponse(currentProfile, []), 200, req);
    }

    if (intent.kind === 'edit') {
      const q = questionForKey(intent.key);
      if (q) {
        // If the user supplied the new value inline (e.g. "change cities to Tampa, FL"),
        // try to parse + save it immediately instead of re-asking the question.
        if (intent.valueText) {
          const parsedInline = parseAnswerForQuestion(q, intent.valueText);
          const sanitizedInline = sanitizeUpdates(parsedInline.updates);
          if (Object.keys(sanitizedInline).length > 0) {
            await supabase.from('profiles').update(sanitizedInline).eq('id', user.id);
            const updated = { ...currentProfile, ...sanitizedInline } as ProfileRecord;
            const fieldLabel = FRIENDLY_FIELD_LABEL[q.key] ?? q.key.replace(/_/g, ' ');
            const noteSuffix = parsedInline.note ? ` ${parsedInline.note}` : '';
            const resp = completionSummaryResponse(updated, Object.keys(sanitizedInline));
            resp.assistant_message = `Updated your ${fieldLabel}.${noteSuffix}\n\n${resp.assistant_message}`;
            return jsonResponse(resp, 200, req);
          }
          // Couldn't parse — show the question with a hint.
          return jsonResponse(
            questionResponseWithState(q, currentProfile, {
              editing: true,
              prefix: parsedInline.note ?? `I couldn't parse "${intent.valueText}".`,
            }),
            200,
            req,
          );
        }
        return jsonResponse(questionResponseWithState(q, currentProfile, { editing: true }), 200, req);
      }
    }

    if (intent.kind === 'back' && priorState?.mode === 'onboarding') {
      const curKey = typeof priorState.key === 'string' ? priorState.key : null;
      const curIdx = indexOfKey(curKey);
      const prevIdx = Math.max(0, curIdx - 1);
      const prevKey = QUESTION_ORDER[prevIdx];
      const prevQ = questionForKey(prevKey);
      if (prevQ) {
        return jsonResponse(
          questionResponseWithState(prevQ, currentProfile, {
            editing: false,
            prefix: 'Going back.',
            questionIndex: prevIdx,
          }),
          200,
          req,
        );
      }
    }

    if (intent.kind === 'skip' && priorState?.mode === 'onboarding') {
      const curKey = typeof priorState.key === 'string' ? priorState.key : null;
      const curIdx = indexOfKey(curKey);
      const nextIdx = Math.min(QUESTION_ORDER.length - 1, curIdx + 1);
      // Skip forward to the next *unanswered* question after this index.
      const nextQ = nextQuestion(currentProfile);
      if (nextQ && nextQ.key !== curKey) {
        return jsonResponse(
          questionResponseWithState(nextQ, currentProfile, {
            editing: false,
            prefix: 'Skipped.',
            questionIndex: indexOfKey(nextQ.key),
          }),
          200,
          req,
        );
      }
      // Fall through to next-in-order if everything else is answered
      const fallbackKey = QUESTION_ORDER[nextIdx];
      const fallbackQ = questionForKey(fallbackKey);
      if (fallbackQ && fallbackKey !== curKey) {
        return jsonResponse(
          questionResponseWithState(fallbackQ, currentProfile, {
            editing: false,
            prefix: 'Skipped.',
            questionIndex: nextIdx,
          }),
          200,
          req,
        );
      }
    }

    if (intent.kind === 'custom_pref') {
      const merged = appendAboutMe(currentProfile.about_me, intent.text);
      await supabase.from('profiles').update({ about_me: merged }).eq('id', user.id);
      const updated = { ...currentProfile, about_me: merged };
      return jsonResponse(
        {
          assistant_message:
            `Added to your preferences: "${intent.text}".\n\nYou can keep adding notes, or say "edit budget", "reset preferences", etc.` +
            encodeState({ mode: 'closed' }),
          choices: COMPLETION_CHOICES,
          nav_choices: [],
          multi_select: false,
          allow_text: true,
          done: true,
          saved_fields: ['about_me'],
        },
        200,
        req,
      );
    }

    // COMPLETION SUMMARY handling — user just saw the closing recap.
    if (priorState?.mode === 'completed_summary') {
      const trimmed = latestContent.trim();
      const exact = COMPLETION_CHOICES.find(
        (c) => c.label.toLowerCase() === trimmed.toLowerCase() || c.value === trimmed,
      );
      const choice = exact?.value;
      if (choice === 'complete:looks_good' || /^(ok(ay)?|thanks?|thank you|cool|great|sounds good|perfect|done)\b/i.test(trimmed)) {
        return jsonResponse(finalAcknowledgementResponse(), 200, req);
      }
      if (choice === 'complete:change') {
        return jsonResponse(editMenuResponse(), 200, req);
      }
      // Any other free text → treat as custom preference note (already handled above
      // via the universal intent layer when inQuestionnaire is false).
      return jsonResponse(completionSummaryResponse(currentProfile, []), 200, req);
    }

    // CLOSED state → any new message reopens the edit menu.
    if (priorState?.mode === 'closed') {
      // Reset/edit intents handled above. Anything else already routed to custom_pref.
      return jsonResponse(completionSummaryResponse(currentProfile, []), 200, req);
    }

    // EDIT MODE handling.
    if (priorState?.mode === 'edit_menu' || (isComplete && !priorState)) {
      const detected = detectEditCategory(latestContent);
      if (detected === 'restart_all') {
        const freshProfile = await resetAllPreferences(supabase, user.id, currentProfile);
        const q = nextQuestion(freshProfile);
        if (q) {
          return jsonResponse(
            questionResponseWithState(q, freshProfile, {
              editing: false,
              prefix: "Starting fresh — your preferences are cleared.",
              questionIndex: 0,
            }),
            200,
            req,
          );
        }
      }
      if (detected && detected !== 'restart_all') {
        const q = questionForKey(detected);
        if (q) return jsonResponse(questionResponseWithState(q, currentProfile, { editing: true }), 200, req);
      }
      // Could not match → show menu again.
      return jsonResponse(editMenuResponse("I didn't catch that —"), 200, req);
    }

    // Determine which question this answer belongs to.
    let currentQuestion: Question | null = null;
    let editingMode = false;
    if (priorState?.mode === 'editing' && typeof priorState.key === 'string') {
      currentQuestion = questionForKey(priorState.key);
      editingMode = true;
    } else if (priorState?.mode === 'onboarding' && typeof priorState.key === 'string') {
      currentQuestion = questionForKey(priorState.key) ?? onboardingQuestion;
    } else {
      currentQuestion = onboardingQuestion;
    }

    const parsed = parseAnswerForQuestion(currentQuestion, latestContent);
    const sanitized = sanitizeUpdates(parsed.updates);

    if (currentQuestion && Object.keys(sanitized).length === 0) {
      let prefix = parsed.note ?? "I didn't catch that.";
      // If the user typed a substantive sentence (not just one word) and we couldn't
      // map it to the current question's choices, capture it as a free-form note so
      // it isn't lost. Then re-ask the same question.
      const trimmedInput = latestContent.trim();
      const looksLikeFreeText = /\s/.test(trimmedInput) && trimmedInput.split(/\s+/).length >= 2;
      if (looksLikeFreeText && currentQuestion.key !== 'about_me' && currentQuestion.key !== 'preferred_cities') {
        const merged = appendAboutMe(currentProfile.about_me, trimmedInput);
        await supabase.from('profiles').update({ about_me: merged }).eq('id', user.id);
        (currentProfile as ProfileRecord).about_me = merged;
        prefix = `Got it — I saved "${trimmedInput}" as a note. Now back to the question:`;
      }
      return jsonResponse(
        questionResponseWithState(currentQuestion, currentProfile, {
          editing: editingMode,
          prefix,
          questionIndex: indexOfKey(currentQuestion.key),
        }),
        200,
        req,
      );
    }

    let savedFields: string[] = [];
    if (Object.keys(sanitized).length > 0) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(sanitized)
        .eq('id', user.id);
      if (updateError) {
        log.step('Profile update failed', { error: updateError.message });
      } else {
        savedFields = Object.keys(sanitized);
        log.step('Profile updated', { fields: savedFields });
      }
    }

    const updatedProfile = { ...currentProfile, ...sanitized };

    // After an EDIT answer → return to edit menu, not onboarding flow.
    if (editingMode) {
      const fieldLabel = currentQuestion ? FRIENDLY_FIELD_LABEL[currentQuestion.key] ?? currentQuestion.key.replace(/_/g, ' ') : 'that';
      const resp = editMenuResponse(`Saved your ${fieldLabel}.`);
      resp.saved_fields = savedFields;
      return jsonResponse(resp, 200, req);
    }

    const followingQuestion = nextQuestion(updatedProfile);

    if (!followingQuestion) {
      if (updatedProfile.onboarding_completed !== true) {
        const completionUpdate = { onboarding_completed: true };
        const { error: completeError } = await supabase
          .from('profiles')
          .update(completionUpdate)
          .eq('id', user.id);
        if (completeError) {
          log.step('Profile completion update failed', { error: completeError.message });
        } else {
          savedFields = [...new Set([...savedFields, 'onboarding_completed'])];
          (updatedProfile as ProfileRecord).onboarding_completed = true;
        }
      }

      return jsonResponse(completionSummaryResponse(updatedProfile, savedFields), 200, req);
    }

    const savedNote = parsed.note ? ` ${parsed.note}` : '';
    const response = questionResponseWithState(followingQuestion, updatedProfile, {
      editing: false,
      prefix: savedFields.length ? `Saved.${savedNote}` : undefined,
      questionIndex: indexOfKey(followingQuestion.key),
    });
    response.saved_fields = savedFields;
    return jsonResponse(response, 200, req);
  } catch (error) {
    log.step('ERROR', { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error), 500, req);
  }
})(req)));
