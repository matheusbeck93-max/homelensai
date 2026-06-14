import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface MilestoneCelebrationData {
  headline: string;
  context?: string | null;
  category: 'property' | 'saved' | 'account' | 'market' | 'streak';
  ctaUrl?: string;
}

function categoryLabel(c: MilestoneCelebrationData['category']): string {
  switch (c) {
    case 'property': return 'Portfolio milestone';
    case 'saved': return 'Saved property update';
    case 'account': return 'HomeLens milestone';
    case 'market': return 'Market milestone';
    case 'streak': return 'Streak milestone';
  }
}

function render(data: MilestoneCelebrationData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const cta = data.ctaUrl ?? 'https://homelensais.com/';
  const body = `
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B8DB5;font-weight:600;">${escapeHtml(categoryLabel(data.category))}</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:800;color:#2C3E55;line-height:1.2;">${escapeHtml(data.headline)}</h1>
    ${data.context ? `<p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#2C3E55;">${escapeHtml(data.context)}</p>` : ''}
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#2C3E55;">Nice work, ${escapeHtml(name)}. Open HomeLens to see the full picture or share the moment.</p>
    <div>${button(cta, 'View in HomeLens')}</div>
  `;
  return {
    subject: data.headline,
    html: baseLayout({ preview: data.headline, bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `${data.headline}\n${data.context ?? ''}\n\nOpen HomeLens: ${cta}`,
  };
}

export const milestoneCelebration: TemplateDef<MilestoneCelebrationData> = {
  featureFlag: 'milestone_celebrations_enabled',
  render,
};