/**
 * Per-surface tier → model mapping for the HomeLens AI router.
 *
 * Each surface declares which model to use for free / paid / premium tiers
 * plus a fallback model the router transparently retries against on
 * retryable errors.
 *
 * Surface IDs are stable strings — edge functions and telemetry pivot on
 * them. Add a new surface here before wiring it into the router.
 */

import type { ModelId } from "./modelRegistry.ts";

export type SurfaceId =
  | "general_chat"
  | "extension_listing_analysis"
  | "investor_chat"
  | "investor_brief"
  | "preferences_assistant"
  | "my_properties_strategy"
  | "artifact_generation"
  | "alerts_engine"
  | "property_valuation_commentary";

export interface SurfaceTierConfig {
  primary: ModelId;
  fallback: ModelId;
  restrictions?: {
    maxArtifactsPerDay?: number;
    kinds?: string[];
  };
}

export interface SurfaceConfig {
  description: string;
  tiers: {
    free: SurfaceTierConfig;
    buyer: SurfaceTierConfig;
    investor: SurfaceTierConfig;
  };
  maxToolIterations: number;
}

const STD: ModelId = "gateway:standard";
const PRE: ModelId = "gateway:premium";
const FBK: ModelId = "gateway:fallback";

export const SURFACE_CONFIG: Record<SurfaceId, SurfaceConfig> = {
  general_chat: {
    description: "Main consumer chat surface — research, Q&A, light tool use.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: PRE, fallback: STD },
    },
    maxToolIterations: 5,
  },
  extension_listing_analysis: {
    description: "Short, bounded analyses of a single listing page.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: STD, fallback: FBK },
    },
    maxToolIterations: 2,
  },
  investor_chat: {
    description: "Investor deep dive — multi-tool reasoning.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: PRE, fallback: STD },
    },
    maxToolIterations: 5,
  },
  investor_brief: {
    description: "Structured brief narration over already-chosen cards.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: PRE, fallback: STD },
    },
    maxToolIterations: 0,
  },
  preferences_assistant: {
    description: "NL → JSON preference patch extraction.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: STD, fallback: FBK },
    },
    maxToolIterations: 0,
  },
  my_properties_strategy: {
    description: "Sell-vs-hold, refi analysis — consequential recommendations.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: PRE, fallback: STD },
      investor: { primary: PRE, fallback: STD },
    },
    maxToolIterations: 8,
  },
  artifact_generation: {
    description: "Slide decks, memos, models, reports.",
    tiers: {
      free: {
        primary: STD,
        fallback: FBK,
        restrictions: { maxArtifactsPerDay: 1, kinds: ["one_pager", "email_draft"] },
      },
      buyer: {
        primary: PRE,
        fallback: STD,
        restrictions: { maxArtifactsPerDay: 10 },
      },
      investor: {
        primary: PRE,
        fallback: STD,
        restrictions: { maxArtifactsPerDay: 50 },
      },
    },
    maxToolIterations: 8,
  },
  alerts_engine: {
    description: "Short narrative descriptions for active alerts.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: PRE, fallback: STD },
    },
    maxToolIterations: 0,
  },
  property_valuation_commentary: {
    description: "Short commentary on auto-valuation changes.",
    tiers: {
      free: { primary: STD, fallback: FBK },
      buyer: { primary: STD, fallback: FBK },
      investor: { primary: STD, fallback: FBK },
    },
    maxToolIterations: 0,
  },
};

export function getSurfaceConfig(id: SurfaceId): SurfaceConfig {
  const cfg = SURFACE_CONFIG[id];
  if (!cfg) throw new Error(`Unknown surface id: ${id}`);
  return cfg;
}