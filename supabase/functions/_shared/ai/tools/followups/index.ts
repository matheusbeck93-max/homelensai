/**
 * Follow-up registry tools (PR B).
 *
 * Five Sonnet-callable tools backing the v1 follow-up topics:
 * - test_buying_ability  (calcEngine + Perplexity 30y rate)
 * - find_fthb_programs   (Perplexity, .gov bias, 7d cache)
 * - find_local_lenders   (Perplexity, 24h cache)
 * - compare_properties   (pure computation)
 * - research_neighborhood (Perplexity, 7d cache)
 *
 * `FOLLOWUP_TOOLS` plugs into the same `tools: [...]` array the chat
 * surfaces already pass to the LLM. `runFollowupTool` dispatches a
 * tool_call to the right executor. All executors are fail-soft and never
 * throw — they return `{ ok: false, error }` so the caller can degrade
 * gracefully.
 */

import { FIND_LOCAL_LENDERS_TOOL, runFindLocalLenders } from './findLocalLenders.ts';
import { FIND_FTHB_PROGRAMS_TOOL, runFindFTHBPrograms } from './findFTHBPrograms.ts';
import { TEST_BUYING_ABILITY_TOOL, runTestBuyingAbility } from './testBuyingAbility.ts';
import { COMPARE_PROPERTIES_TOOL, runCompareProperties } from './compareProperties.ts';
import { RESEARCH_NEIGHBORHOOD_TOOL, runResearchNeighborhood } from './researchNeighborhood.ts';

export {
  FIND_LOCAL_LENDERS_TOOL,
  FIND_FTHB_PROGRAMS_TOOL,
  TEST_BUYING_ABILITY_TOOL,
  COMPARE_PROPERTIES_TOOL,
  RESEARCH_NEIGHBORHOOD_TOOL,
  runFindLocalLenders,
  runFindFTHBPrograms,
  runTestBuyingAbility,
  runCompareProperties,
  runResearchNeighborhood,
};

export const FOLLOWUP_TOOLS = [
  TEST_BUYING_ABILITY_TOOL,
  FIND_FTHB_PROGRAMS_TOOL,
  FIND_LOCAL_LENDERS_TOOL,
  COMPARE_PROPERTIES_TOOL,
  RESEARCH_NEIGHBORHOOD_TOOL,
] as const;

export const FOLLOWUP_TOOL_NAMES = [
  'test_buying_ability',
  'find_fthb_programs',
  'find_local_lenders',
  'compare_properties',
  'research_neighborhood',
] as const;

export type FollowupToolName = (typeof FOLLOWUP_TOOL_NAMES)[number];

export function isFollowupTool(name: string): name is FollowupToolName {
  return (FOLLOWUP_TOOL_NAMES as readonly string[]).includes(name);
}

export async function runFollowupTool(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<unknown> {
  const input = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'find_local_lenders':
      return await runFindLocalLenders(input);
    case 'find_fthb_programs':
      return await runFindFTHBPrograms(input);
    case 'test_buying_ability':
      return await runTestBuyingAbility(input);
    case 'compare_properties':
      return runCompareProperties(input);
    case 'research_neighborhood':
      return await runResearchNeighborhood(input);
    default:
      return { ok: false, error: `Unknown follow-up tool: ${name}` };
  }
}