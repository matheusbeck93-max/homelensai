import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface WatchGoalDigestData {
  goalLabel: string;
  matchThreshold: number;
  matches: Array<{
    address: string;
    cityState: string;
    price: number;
    beds?: number;
    baths?: number;
    score: number;
    rationale: string;
    listingUrl?: string;
    photo?: string | null;
  }>;
}

function row(m: WatchGoalDigestData['matches'][number]): string {
  const photo = m.photo
    ? `<img src="${escapeHtml(m.photo)}" width="120" alt="" style="border-radius:8px;display:block;object-fit:cover;width:120px;height:90px;" />`
    : `<div style="width:120px;height:90px;background:#E8EEF6;border-radius:8px;"></div>`;
  const specs = [m.beds != null ? `${m.beds} bd` : null, m.baths != null ? `${m.baths} ba` : null]
    .filter(Boolean)
    .join(' · ');
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 16px 0;border:1px solid #E8EEF6;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:12px;vertical-align:top;width:140px;">${photo}</td>
        <td style="padding:12px 14px;vertical-align:top;">
          <p style="margin:0;font-size:12px;font-weight:700;color:#6B8DB5;letter-spacing:.04em;text-transform:uppercase;">Match ${m.score}/10</p>
          <p style="margin:4px 0 6px 0;font-size:16px;font-weight:700;color:#2C3E55;">$${m.price.toLocaleString('en-US')}</p>
          <p style="margin:0 0 4px 0;font-size:14px;color:#2C3E55;">${escapeHtml(m.address)}</p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#7A8A9A;">${escapeHtml(m.cityState)}${specs ? ` · ${escapeHtml(specs)}` : ''}</p>
          ${m.rationale ? `<p style="margin:0 0 6px 0;font-size:13px;color:#2C3E55;line-height:1.5;">${escapeHtml(m.rationale)}</p>` : ''}
          ${m.listingUrl ? `<a href="${escapeHtml(m.listingUrl)}" style="font-size:13px;color:#6B8DB5;text-decoration:none;font-weight:600;">View listing →</a>` : ''}
        </td>
      </tr>
    </table>`;
}

function render(data: WatchGoalDigestData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const count = data.matches.length;
  const subject =
    count === 1
      ? `1 new match for "${data.goalLabel}"`
      : `${count} new matches for "${data.goalLabel}"`;

  const body = `
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B8DB5;font-weight:600;">Watch goal</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:800;color:#2C3E55;line-height:1.2;">${escapeHtml(subject)}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#2C3E55;">Hi ${escapeHtml(name)} — these scored at or above your ${data.matchThreshold}/10 threshold for <strong>${escapeHtml(data.goalLabel)}</strong>. Nothing has been acted on; review and decide.</p>
    ${data.matches.slice(0, 10).map(row).join('')}
    <div style="margin-top:20px;">${button('https://homelensais.com/saved-searches', 'Manage this watch goal')}</div>
  `;

  return {
    subject,
    html: baseLayout({ preview: subject, bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `${subject}\n\n${data.matches
      .map((m) => `Match ${m.score}/10 — $${m.price.toLocaleString('en-US')} — ${m.address} (${m.cityState})${m.rationale ? `\n  ${m.rationale}` : ''}`)
      .join('\n')}\n\nManage: https://homelensais.com/saved-searches`,
  };
}

export const watchGoalDigest: TemplateDef<WatchGoalDigestData> = {
  render,
};
