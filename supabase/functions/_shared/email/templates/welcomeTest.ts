import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface WelcomeTestData {
  note?: string;
}

function render(data: WelcomeTestData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const body = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#2C3E55;">Hi ${escapeHtml(name)} 👋</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#2C3E55;">
      This is a test email from HomeLens to confirm transactional email delivery is working.
    </p>
    ${data.note ? `<p style="margin:0 0 16px 0;font-size:14px;color:#7A8A9A;">${escapeHtml(data.note)}</p>` : ''}
    <div style="margin-top:24px;">${button('https://homelensais.com/', 'Open HomeLens')}</div>
  `;
  return {
    subject: 'HomeLens — email delivery test',
    html: baseLayout({ preview: 'Test email from HomeLens', bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `Hi ${name}, this is a test email from HomeLens.`,
  };
}

export const welcomeTest: TemplateDef<WelcomeTestData> = { render };