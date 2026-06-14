import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface StreakProtectionNudgeData {
  dailyCurrent: number;
  skipAvailable: boolean;
}

function render(data: StreakProtectionNudgeData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const skipLine = data.skipAvailable
    ? "You still have a free skip this week — use it or open the app to keep the streak alive."
    : "No skip left this week, so today's the day to log in.";
  const body = `
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B8DB5;font-weight:600;">Don't break the streak</p>
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:#2C3E55;line-height:1.2;">${data.dailyCurrent}-day streak at risk</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#2C3E55;">Hey ${escapeHtml(name)} — you haven't checked HomeLens today. ${escapeHtml(skipLine)}</p>
    <div>${button('https://homelensais.com/console', 'Open HomeLens')}</div>
  `;
  return {
    subject: `Don't break your ${data.dailyCurrent}-day streak`,
    html: baseLayout({ preview: 'Keep your HomeLens streak alive', bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `Your ${data.dailyCurrent}-day streak is at risk. ${skipLine}`,
  };
}

export const streakProtectionNudge: TemplateDef<StreakProtectionNudgeData> = {
  featureFlag: 'streak_reminders_enabled',
  render,
};