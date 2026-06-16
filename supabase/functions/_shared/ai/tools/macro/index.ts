/**
 * Macro intelligence tools (FRED-backed).
 *
 * Five Sonnet-callable tools mirroring the followups registry contract:
 *  - get_current_mortgage_rates
 *  - get_rate_environment_analysis
 *  - get_national_housing_index
 *  - get_metro_housing_index
 *  - get_macro_economic_context
 *
 * `MACRO_TOOLS` / `runMacroTool` plug into the ai-chat tool-loop the
 * same way FOLLOWUP_TOOLS does. `MACRO_TOOL_DEFS` matches the
 * `{name, description, parameters, execute}` ToolDef shape consumed by
 * investor-chat and owned-property-chat.
 */

import {
  GET_CURRENT_MORTGAGE_RATES_TOOL,
  runGetCurrentMortgageRates,
} from './getCurrentMortgageRates.ts';
import {
  GET_RATE_ENVIRONMENT_ANALYSIS_TOOL,
  runGetRateEnvironmentAnalysis,
} from './getRateEnvironmentAnalysis.ts';
import {
  GET_NATIONAL_HOUSING_INDEX_TOOL,
  runGetNationalHousingIndex,
} from './getNationalHousingIndex.ts';
import {
  GET_METRO_HOUSING_INDEX_TOOL,
  runGetMetroHousingIndex,
} from './getMetroHousingIndex.ts';
import {
  GET_MACRO_ECONOMIC_CONTEXT_TOOL,
  runGetMacroEconomicContext,
} from './getMacroEconomicContext.ts';

export const MACRO_TOOLS = [
  GET_CURRENT_MORTGAGE_RATES_TOOL,
  GET_RATE_ENVIRONMENT_ANALYSIS_TOOL,
  GET_NATIONAL_HOUSING_INDEX_TOOL,
  GET_METRO_HOUSING_INDEX_TOOL,
  GET_MACRO_ECONOMIC_CONTEXT_TOOL,
] as const;

export const MACRO_TOOL_NAMES = [
  'get_current_mortgage_rates',
  'get_rate_environment_analysis',
  'get_national_housing_index',
  'get_metro_housing_index',
  'get_macro_economic_context',
] as const;

export type MacroToolName = (typeof MACRO_TOOL_NAMES)[number];

export function isMacroTool(name: string): name is MacroToolName {
  return (MACRO_TOOL_NAMES as readonly string[]).includes(name);
}

export async function runMacroTool(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<unknown> {
  const input = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'get_current_mortgage_rates':
      return await runGetCurrentMortgageRates();
    case 'get_rate_environment_analysis':
      return await runGetRateEnvironmentAnalysis();
    case 'get_national_housing_index':
      return await runGetNationalHousingIndex();
    case 'get_metro_housing_index':
      return await runGetMetroHousingIndex(input as { metro_name?: unknown });
    case 'get_macro_economic_context':
      return await runGetMacroEconomicContext();
    default:
      return { ok: false, error: `Unknown macro tool: ${name}` };
  }
}

/** Surface-agnostic ToolDef array consumed by investor-chat / owned-property-chat. */
export const MACRO_TOOL_DEFS = MACRO_TOOLS.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  parameters: t.function.parameters,
  execute: async (input: Record<string, unknown>, _ctx?: unknown) =>
    runMacroTool(t.function.name, input),
}));