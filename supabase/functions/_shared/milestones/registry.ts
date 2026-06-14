import type { MilestoneRule } from './types.ts';
import { propertyRules } from './rules/property.ts';
import { savedRules } from './rules/saved.ts';
import { accountRules } from './rules/account.ts';
import { marketRules } from './rules/market.ts';

export const ALL_RULES: MilestoneRule[] = [
  ...propertyRules,
  ...savedRules,
  ...accountRules,
  ...marketRules,
];