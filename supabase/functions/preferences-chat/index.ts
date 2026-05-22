import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { callAiGateway, type AiMessage, type AiTool } from '../_shared/ai-gateway.ts';
import { getSupabaseEnv } from '../_shared/env.ts';

const log = createLogger('preferences-chat');

/** Columns the AI is allowed to write to on profiles. Anything else is dropped. */
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
]);

const PERSONA_VALUES = ['first_time_buyer', 'move_up_buyer', 'investor', 'downsizer', 'relocator'];
const STRATEGY_VALUES = ['primary_residence', 'buy_and_hold', 'flip', 'vacation_home', 'brrrr', 'house_hack'];
const FINANCING_VALUES = ['cash', 'conventional', 'fha', 'va', 'usda', 'hard_money'];
const FEATURE_VALUES = ['garage', 'pool', 'yard', 'basement', 'central-ac', 'updated-kitchen', 'home-office', 'open-floor-plan'];
const CHILD_AGE_VALUES = ['infant', 'toddler', 'elementary', 'middle-school', 'high-school'];
const CLIMATE_VALUES = ['warm', 'mild', 'cold', 'four_seasons', 'no_preference'];
const SAFETY_VALUES = ['very_high', 'high', 'medium', 'low'];
const PRIMARY_GOAL_VALUES = ['buy_home', 'invest', 'both'];

const RESPOND_TOOL: AiTool = {
  type: 'function',
  function: {
    name: 'respond',
    description: 'Reply to the user with the next preference question, any chip choices, and any profile updates to save.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        assistant_message: {
          type: 'string',
          description: 'Short conversational message (1-2 sentences). Acknowledge any updates, then ask the next question or offer to update anything.',
        },
        choices: {
          type: 'array',
          description: 'Optional multiple-choice chips for the user. Use only when a question has a known finite option set.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
        multi_select: {
          type: 'boolean',
          description: 'True when the user may select multiple chips (e.g. features, financing). Default false.',
        },
        allow_text: {
          type: 'boolean',
          description: 'Whether to show the free-text input row. Default true.',
        },
        updates: {
          type: 'object',
          description: 'Partial profile updates inferred from the latest user reply. Only include fields you are confident about. Use only allowed keys.',
          additionalProperties: true,
        },
        done: {
          type: 'boolean',
          description: 'True when all default questions have been covered for a brand-new profile. After done, future turns just acknowledge changes.',
        },
      },
      required: ['assistant_message'],
    },
  },
};

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

  if (key === 'has_children') return Boolean(value);

  const arrayFields: Record<string, string[] | null> = {
    preferred_cities: null, // free-form "City, ST" strings
    buyer_types: PERSONA_VALUES,
    investment_strategies: STRATEGY_VALUES,
    financing_preferences: FINANCING_VALUES,
    must_have_features: null, // allow custom features too
    children_ages: CHILD_AGE_VALUES,
  };
  if (key in arrayFields) {
    if (value === null) return null;
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
    return typeof value === 'string' ? value.trim().slice(0, 2000) : null;
  }

  return value;
}

function buildSystemPrompt(profile: Record<string, unknown> | null): string {
  const summary = profile ? summarizeProfile(profile) : '(no preferences saved yet)';
  return `You are HomeLens' preferences assistant. You help the user fill in and update their real-estate preferences through a friendly chat.

RULES
- Ask ONE question at a time. Keep messages to 1-2 sentences.
- Always call the \`respond\` tool. Never reply with plain text outside the tool.
- When a question has a known option set, include \`choices\` chips and set \`multi_select\` appropriately.
- Always allow free text (\`allow_text: true\`) unless the answer must come from a fixed list.
- After each user reply, set \`updates\` with ONLY the fields the user just answered. Use the exact field names and value formats below.
- Acknowledge updates briefly ("Got it — budget set to $500k.") then ask the next missing question.
- If the profile already has the field, do not re-ask it unless the user wants to change it.
- When all core questions are covered, set \`done: true\` and tell the user they can change anything anytime.
- For ongoing edits ("change my budget to 700k", "add Tampa"), parse the request, send \`updates\`, confirm, and wait — do NOT keep asking new questions.

ALLOWED FIELDS & VALUE FORMATS
- primary_goal: one of ${PRIMARY_GOAL_VALUES.join(' | ')}
- preferred_cities: array of "City, ST" strings (uppercase state code), e.g. ["Miami, FL", "Tampa, FL"]
- buyer_types: array of ${PERSONA_VALUES.join(' | ')}
- budget_min / budget_max: integer USD (no commas, no $)
- min_bedrooms / min_bathrooms: integer
- min_sqft / max_sqft: integer
- must_have_features: array of ${FEATURE_VALUES.join(' | ')} OR custom kebab-case strings
- investment_strategies: array of ${STRATEGY_VALUES.join(' | ')}
- hold_period_years: integer
- financing_preferences: array of ${FINANCING_VALUES.join(' | ')}
- has_children: boolean
- children_ages: array of ${CHILD_AGE_VALUES.join(' | ')}
- climate_preference: one of ${CLIMATE_VALUES.join(' | ')}
- safety_priority: one of ${SAFETY_VALUES.join(' | ')}
- about_me: free text (up to ~500 chars)

QUESTION ORDER (for new profiles)
1. primary_goal
2. preferred_cities
3. buyer_types
4. budget_min + budget_max (ask together)
5. min_bedrooms + min_bathrooms
6. min_sqft + max_sqft (optional, allow skip)
7. must_have_features
8. investment_strategies (only if primary_goal includes invest or buyer_types includes investor)
9. hold_period_years (only if investment relevant)
10. financing_preferences
11. has_children (then children_ages if yes)
12. climate_preference
13. safety_priority
14. about_me (free text)

CURRENT SAVED PREFERENCES
${summary}

START
- If no preferences saved, greet warmly and start with question 1.
- If preferences already exist, summarize them in one sentence and ask if they'd like to update anything (offer chips: "Yes, update something" / "Looks good").`;
}

function summarizeProfile(p: Record<string, unknown>): string {
  const pick = (k: string) => p[k];
  const lines: string[] = [];
  if (pick('primary_goal')) lines.push(`primary_goal: ${pick('primary_goal')}`);
  if (Array.isArray(pick('preferred_cities')) && (pick('preferred_cities') as unknown[]).length)
    lines.push(`preferred_cities: ${(pick('preferred_cities') as unknown[]).join('; ')}`);
  if (Array.isArray(pick('buyer_types')) && (pick('buyer_types') as unknown[]).length)
    lines.push(`buyer_types: ${(pick('buyer_types') as unknown[]).join(', ')}`);
  if (pick('budget_min') || pick('budget_max'))
    lines.push(`budget: $${pick('budget_min') ?? '?'} – $${pick('budget_max') ?? '?'}`);
  if (pick('min_bedrooms')) lines.push(`min_bedrooms: ${pick('min_bedrooms')}`);
  if (pick('min_bathrooms')) lines.push(`min_bathrooms: ${pick('min_bathrooms')}`);
  if (pick('min_sqft') || pick('max_sqft'))
    lines.push(`sqft: ${pick('min_sqft') ?? '?'} – ${pick('max_sqft') ?? '?'}`);
  if (Array.isArray(pick('must_have_features')) && (pick('must_have_features') as unknown[]).length)
    lines.push(`must_have_features: ${(pick('must_have_features') as unknown[]).join(', ')}`);
  if (Array.isArray(pick('investment_strategies')) && (pick('investment_strategies') as unknown[]).length)
    lines.push(`investment_strategies: ${(pick('investment_strategies') as unknown[]).join(', ')}`);
  if (pick('hold_period_years')) lines.push(`hold_period_years: ${pick('hold_period_years')}`);
  if (Array.isArray(pick('financing_preferences')) && (pick('financing_preferences') as unknown[]).length)
    lines.push(`financing_preferences: ${(pick('financing_preferences') as unknown[]).join(', ')}`);
  if (pick('has_children') !== null && pick('has_children') !== undefined)
    lines.push(`has_children: ${pick('has_children')}`);
  if (Array.isArray(pick('children_ages')) && (pick('children_ages') as unknown[]).length)
    lines.push(`children_ages: ${(pick('children_ages') as unknown[]).join(', ')}`);
  if (pick('climate_preference')) lines.push(`climate_preference: ${pick('climate_preference')}`);
  if (pick('safety_priority')) lines.push(`safety_priority: ${pick('safety_priority')}`);
  if (pick('about_me')) lines.push(`about_me: ${String(pick('about_me')).slice(0, 200)}`);
  return lines.length ? lines.join('\n') : '(no preferences saved yet)';
}

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

    const body = await req.json().catch(() => null) as { messages?: Array<{ role: string; content: string }> } | null;
    if (!body || !Array.isArray(body.messages)) {
      return validationError('messages array is required', undefined, req);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const systemPrompt = buildSystemPrompt(profile);

    const aiMessages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      ...body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-30)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // If this is the very first call (no user message yet), seed a greeting prompt.
    if (!aiMessages.some((m) => m.role === 'user')) {
      aiMessages.push({ role: 'user', content: '__start__' });
    }

    const aiResult = await callAiGateway(aiMessages, {
      model: 'google/gemini-2.5-flash',
      temperature: 0.4,
      tools: [RESPOND_TOOL],
      tool_choice: { type: 'function', function: { name: 'respond' } },
    });

    if ('error' in aiResult) return aiResult.error;

    const toolCall = aiResult.result.toolCalls?.[0];
    const args = toolCall?.arguments ?? {};
    const assistantMessage: string = typeof args.assistant_message === 'string' && args.assistant_message.trim()
      ? args.assistant_message
      : (aiResult.result.message || 'Tell me a bit more.');
    const choices = Array.isArray(args.choices) ? args.choices.filter((c: any) => c?.label && c?.value).slice(0, 12) : [];
    const multiSelect = Boolean(args.multi_select);
    const allowText = args.allow_text === undefined ? true : Boolean(args.allow_text);
    const done = Boolean(args.done);

    const sanitized = sanitizeUpdates(args.updates);
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

    return jsonResponse(
      {
        assistant_message: assistantMessage,
        choices,
        multi_select: multiSelect,
        allow_text: allowText,
        done,
        saved_fields: savedFields,
      },
      200,
      req,
    );
  } catch (error) {
    log.step('ERROR', { message: getErrorMessage(error) });
    return errorResponse(getErrorMessage(error), 500, req);
  }
});