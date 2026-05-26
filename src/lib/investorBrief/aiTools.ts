/**
 * Registry of AI-callable tools surfaced inside the Investor Brief chat
 * state. This file declares tool metadata only; actual execution happens
 * either inline in the UI (read-only tools) or via the existing edge
 * functions (write tools require user confirm).
 */

export type AiToolKind = 'read' | 'write';

export interface AiToolDefinition {
  id: string;
  label: string;
  kind: AiToolKind;
  /** Short user-facing description shown in the action-tag block. */
  description: string;
}

export const aiToolRegistry: AiToolDefinition[] = [
  {
    id: 'compute_metrics',
    label: 'Compute metrics',
    kind: 'read',
    description: 'Recalculate cap rate, cash-on-cash or DSCR on the fly.',
  },
  {
    id: 'compare_properties',
    label: 'Compare properties',
    kind: 'read',
    description: 'Side-by-side ranking of two or more properties on chosen metrics.',
  },
  {
    id: 'list_affordable_listings',
    label: 'List affordable listings',
    kind: 'read',
    description: 'Pull active listings within the investor\'s buying power.',
  },
  {
    id: 'memorize_property',
    label: 'Save property',
    kind: 'write',
    description: 'Add a property to the watchlist (requires confirmation).',
  },
  {
    id: 'save_analysis',
    label: 'Save analysis',
    kind: 'write',
    description: 'Persist a deal analysis (requires confirmation).',
  },
  {
    id: 'update_preferences',
    label: 'Update preferences',
    kind: 'write',
    description: 'Adjust target markets, cap rate, or cash on hand (requires confirmation).',
  },
];

export function getAiTool(id: string): AiToolDefinition | undefined {
  return aiToolRegistry.find((t) => t.id === id);
}