/**
 * Email template registry. Phase 0 ships a single `welcome-test` template
 * used to verify the pipeline. Phase 1 adds `milestone-celebration`; Phase 3
 * adds `streak-milestone` and `streak-protection-nudge`.
 *
 * Each template:
 *   - render(data, ctx) -> { subject, html, text? }
 *   - featureFlag: optional column on `email_preferences` that gates this
 *     template. When the user has the flag set to false, the send is skipped
 *     and logged with status `skipped_prefs`.
 */

import { welcomeTest, type WelcomeTestData } from './welcomeTest.ts';
import { milestoneCelebration, type MilestoneCelebrationData } from './milestoneCelebration.ts';
import { streakMilestone, type StreakMilestoneData } from './streakMilestone.ts';
import { streakProtectionNudge, type StreakProtectionNudgeData } from './streakProtectionNudge.ts';

export interface TemplateContext {
  recipientEmail: string;
  recipientName: string | null;
  unsubscribeUrl: string;
}

export interface TemplateRenderResult {
  subject: string;
  html: string;
  text?: string;
}

export interface TemplateDef<TData> {
  /** key on `email_preferences` (e.g. `milestone_celebrations_enabled`) */
  featureFlag?: string;
  render: (data: TData, ctx: TemplateContext) => Promise<TemplateRenderResult> | TemplateRenderResult;
}

export const TEMPLATES = {
  'welcome-test': welcomeTest,
  'milestone-celebration': milestoneCelebration,
  'streak-milestone': streakMilestone,
  'streak-protection-nudge': streakProtectionNudge,
} as const satisfies Record<string, TemplateDef<unknown>>;

export type TemplateName = keyof typeof TEMPLATES;
export type {
  WelcomeTestData,
  MilestoneCelebrationData,
  StreakMilestoneData,
  StreakProtectionNudgeData,
};