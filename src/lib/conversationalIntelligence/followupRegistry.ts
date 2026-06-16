/**
 * Follow-up registry — v1 ships with 5 high-value topics.
 *
 * Each topic exposes a trigger (0..1), persona affinity, optional cooldown,
 * and an `on_accept` action: cascade (AI asks follow-up Qs), tool_call
 * (invoke a backend tool), or composite (tool first, then cascade).
 *
 * The chip surface (`rankFollowups` + `ConversationalIntelligence`) reads
 * this registry and the trigger detection helpers — nothing here makes UI
 * decisions directly.
 */

import type { ConversationalContext, FollowupTopic } from "./types";
import {
  isExploringPrices,
  mentionsAffordability,
  mentionsAssistance,
  mentionsBudget,
  mentionsCommute,
  mentionsCrime,
  mentionsDecisionBetween,
  mentionsDownPayment,
  mentionsFirstHome,
  mentionsFirstTimeBuyer,
  mentionsLender,
  mentionsLocation,
  mentionsMortgage,
  mentionsMultipleProperties,
  mentionsPreApproval,
  mentionsRates,
  mentionsRefinance,
  mentionsSchools,
  userBrowsingListings,
  userHasSavedProperties,
  userViewingProperty,
  weighted,
} from "./triggerDetection";

/* ----------------------------------------------------------------------- */
/* 1. Test buying ability                                                  */
/* ----------------------------------------------------------------------- */
const testBuyingAbility: FollowupTopic = {
  id: "test_buying_ability",
  label: "Want me to test your buying ability?",
  category: "financing",
  persona_affinity: { first_time_buyer: 1.0, rental_investor: 0.4, flipper: 0.3, existing_owner: 0.3, mixed: 0.7 },
  cooldown_minutes: 60,
  trigger: (ctx) =>
    weighted([
      mentionsBudget(ctx),
      mentionsAffordability(ctx),
      mentionsDownPayment(ctx),
      mentionsMortgage(ctx),
      isExploringPrices(ctx),
    ]),
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'Test buying ability'. Ask the user, in one short message, for three things at once: gross annual income, total monthly debts (car, student loans, credit card minimums), and how much they have for a down payment. Confirm the state they're buying in if not already known. Once they answer, call `test_buying_ability` with those inputs.",
    },
  },
};

/* ----------------------------------------------------------------------- */
/* 2. First-time home buyer programs                                       */
/* ----------------------------------------------------------------------- */
const fthbPrograms: FollowupTopic = {
  id: "fthb_programs",
  label: "Want info on First-Time Home Buyer programs in your area?",
  category: "financing",
  persona_affinity: { first_time_buyer: 1.0, mixed: 0.5 },
  // Programs rarely change quarter-to-quarter; longer cooldown.
  cooldown_minutes: 7 * 24 * 60,
  trigger: (ctx) => {
    // Strict gate: persona must be FTHB OR conversation explicitly mentions it.
    const ftb = mentionsFirstTimeBuyer(ctx);
    const personaFTHB = ctx.persona === "first_time_buyer" ? 0.5 : 0;
    if (!ftb && !personaFTHB) return 0;
    return weighted([
      ftb,
      personaFTHB,
      mentionsFirstHome(ctx),
      mentionsDownPayment(ctx) * 0.7,
      mentionsAffordability(ctx) * 0.6,
      mentionsAssistance(ctx),
    ]);
  },
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'First-Time Buyer programs'. Confirm their state and county/metro in one short message (use any value they've already shared). Then call `find_fthb_programs` with those inputs.",
    },
  },
};

/* ----------------------------------------------------------------------- */
/* 3. Lender information                                                   */
/* ----------------------------------------------------------------------- */
const lenderInfo: FollowupTopic = {
  id: "lender_info",
  label: "Do you need info on lenders in your area?",
  category: "financing",
  persona_affinity: { first_time_buyer: 1.0, rental_investor: 0.6, flipper: 0.4, existing_owner: 0.7, mixed: 0.7 },
  cooldown_minutes: 24 * 60,
  trigger: (ctx) =>
    weighted([
      mentionsMortgage(ctx),
      mentionsLender(ctx),
      mentionsRates(ctx),
      mentionsPreApproval(ctx),
      mentionsRefinance(ctx),
    ]),
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'Lender info'. In one short message, confirm the state and whether they want purchase pre-approval, rate comparison, or refinance. Then call `find_local_lenders` with state and intent.",
    },
  },
};

/* ----------------------------------------------------------------------- */
/* 4. Compare properties                                                   */
/* ----------------------------------------------------------------------- */
const compareProperties: FollowupTopic = {
  id: "compare_properties",
  label: "Want to compare properties side-by-side?",
  category: "analysis",
  persona_affinity: { rental_investor: 1.0, first_time_buyer: 0.8, flipper: 0.8, institutional: 0.6, existing_owner: 0.5, mixed: 0.7 },
  cooldown_minutes: 30,
  trigger: (ctx) =>
    weighted([
      mentionsMultipleProperties(ctx),
      userHasSavedProperties(ctx, 2),
      mentionsDecisionBetween(ctx),
      userBrowsingListings(ctx),
    ]),
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'Compare properties'. Ask which properties to compare — saved properties, or specific ones they want to paste in. Once you have at least two, call `compare_properties_ai` with the addresses or IDs.",
    },
  },
};

/* ----------------------------------------------------------------------- */
/* 5. Neighborhood research                                                */
/* ----------------------------------------------------------------------- */
const neighborhoodResearch: FollowupTopic = {
  id: "neighborhood_research",
  label: "Want me to research the neighborhood?",
  category: "research",
  persona_affinity: { first_time_buyer: 1.0, rental_investor: 0.7, flipper: 0.5, institutional: 0.4, existing_owner: 0.4, mixed: 0.7 },
  cooldown_minutes: 7 * 24 * 60,
  trigger: (ctx) =>
    weighted([
      mentionsLocation(ctx),
      mentionsSchools(ctx),
      mentionsCrime(ctx),
      mentionsCommute(ctx),
      userViewingProperty(ctx),
    ]),
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'Research the neighborhood'. Ask which dimensions matter most — schools, crime, commute, future development, walkability, or all of these. Then call `research_neighborhood` with the ZIP/city and selected topics.",
    },
  },
};

/* ----------------------------------------------------------------------- */
/* 6. Local wage affordability (BLS + FRED)                                */
/* ----------------------------------------------------------------------- */
const localAffordability: FollowupTopic = {
  id: "local_wage_affordability",
  label: "Who can afford this locally?",
  category: "market",
  persona_affinity: {
    first_time_buyer: 0.9,
    rental_investor: 0.7,
    flipper: 0.5,
    existing_owner: 0.5,
    mixed: 0.8,
  },
  cooldown_minutes: 240,
  trigger: (ctx) =>
    weighted([
      mentionsAffordability(ctx),
      mentionsBudget(ctx),
      mentionsLocation(ctx),
      userBrowsingListings(ctx),
      userViewingProperty(ctx),
    ]),
  on_accept: {
    type: "cascade",
    cascade: {
      prompt_to_ai:
        "The user clicked 'Who can afford this locally?'. Call `get_wage_affordability` with the metro (use the property's city or the user's target market) and explain in 2-3 sentences: median wage, max affordable home at today's rate for single vs dual earner, and how the property price compares. Always cite BLS + FRED.",
    },
  },
};

export const FOLLOWUP_REGISTRY: FollowupTopic[] = [
  testBuyingAbility,
  fthbPrograms,
  lenderInfo,
  compareProperties,
  neighborhoodResearch,
  localAffordability,
];

export function getTopic(id: string): FollowupTopic | undefined {
  return FOLLOWUP_REGISTRY.find((t) => t.id === id);
}

/** Persona affinity multiplier with a 0.4 floor so non-affinity personas
 * still see a topic when conversation signals are very strong. */
export function personaWeight(topic: FollowupTopic, ctx: ConversationalContext): number {
  if (!ctx.persona) return 0.7;
  const w = topic.persona_affinity[ctx.persona];
  if (w == null) return 0.5;
  return Math.max(0.4, w);
}