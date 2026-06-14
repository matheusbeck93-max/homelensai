import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface StreakMilestoneData {
  tier: number;
  headline: string;
  context: string;
  rewardLabel: string | null;
}

function render(data: StreakMilestoneData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const reward = data.rewardLabel
    ? `<p style="margin:0 0 24px 0;padding:12px 16px;background:#F2F6FB;border-radius:8px;font-size:14px;color:#2C3E55;"><strong>Reward unlocked:</strong> ${escapeHtml(data.rewardLabel)}</p>`
    : '';
  const body = `
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B8DB5;font-weight:600;">Streak milestone</p>
    <h1 style="margin:0 0 16px 0;font-size:28px;font-weight:800;color:#2C3E55;line-height:1.2;">${escapeHtml(data.headline)}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#2C3E55;">Nice work, ${escapeHtml(name)}. ${escapeHtml(data.context)}</p>
    ${reward}
    <div>${button('https://homelensais.com/console', 'Open HomeLens')}</div>
  `;
  return {
    subject: `${data.tier}-day streak on HomeLens`,
    html: baseLayout({ preview: data.headline, bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `${data.headline}\n${data.context}${data.rewardLabel ? `\nReward: ${data.rewardLabel}` : ''}`,
  };
}

export const streakMilestone: TemplateDef<StreakMilestoneData> = {
  featureFlag: 'streak_reminders_enabled',
  render,
};