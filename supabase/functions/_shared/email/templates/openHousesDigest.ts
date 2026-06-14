import { baseLayout, button, escapeHtml } from './base.ts';
import type { TemplateDef, TemplateContext, TemplateRenderResult } from './registry.ts';

export interface OpenHousesDigestData {
  city: string;
  state: string;
  frequency: 'daily' | 'weekly';
  listings: Array<{
    address: string;
    cityState: string;
    price: number;
    beds: number;
    baths: number;
    openHouseLabel: string;
    listingUrl: string;
    photo?: string | null;
  }>;
}

function row(l: OpenHousesDigestData['listings'][number]): string {
  const photo = l.photo
    ? `<img src="${escapeHtml(l.photo)}" width="120" alt="" style="border-radius:8px;display:block;object-fit:cover;width:120px;height:90px;" />`
    : `<div style="width:120px;height:90px;background:#E8EEF6;border-radius:8px;"></div>`;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 16px 0;border:1px solid #E8EEF6;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:12px;vertical-align:top;width:140px;">${photo}</td>
        <td style="padding:12px 14px;vertical-align:top;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#6B8DB5;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(l.openHouseLabel)}</p>
          <p style="margin:4px 0 6px 0;font-size:16px;font-weight:700;color:#2C3E55;">$${l.price.toLocaleString('en-US')}</p>
          <p style="margin:0 0 4px 0;font-size:14px;color:#2C3E55;">${escapeHtml(l.address)}</p>
          <p style="margin:0 0 6px 0;font-size:13px;color:#7A8A9A;">${escapeHtml(l.cityState)} · ${l.beds} bd · ${l.baths} ba</p>
          <a href="${escapeHtml(l.listingUrl)}" style="font-size:13px;color:#6B8DB5;text-decoration:none;font-weight:600;">View listing →</a>
        </td>
      </tr>
    </table>`;
}

function render(data: OpenHousesDigestData, ctx: TemplateContext): TemplateRenderResult {
  const name = ctx.recipientName?.split(' ')[0] ?? 'there';
  const headline = data.frequency === 'daily' ? "Today's open houses" : 'This weekend\'s open houses';
  const subject =
    data.frequency === 'daily'
      ? `Open houses today in ${data.city}`
      : `Open houses this weekend in ${data.city}`;

  const listingRows = data.listings.slice(0, 10).map(row).join('');

  const body = `
    <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B8DB5;font-weight:600;">Open house digest</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;font-weight:800;color:#2C3E55;line-height:1.2;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#2C3E55;">Hi ${escapeHtml(name)} — here ${data.listings.length === 1 ? 'is the' : `are the ${data.listings.length}`} upcoming open house${data.listings.length === 1 ? '' : 's'} matching your saved alert for <strong>${escapeHtml(data.city)}, ${escapeHtml(data.state)}</strong>.</p>
    ${listingRows || '<p style="margin:0 0 20px 0;font-size:14px;color:#7A8A9A;">No open houses scheduled right now. We\'ll keep watching.</p>'}
    <div style="margin-top:20px;">${button('https://homelensais.com/open-houses', 'See all on HomeLens')}</div>
  `;

  return {
    subject,
    html: baseLayout({ preview: headline, bodyHtml: body, unsubscribeUrl: ctx.unsubscribeUrl }),
    text: `${headline}\n\n${data.listings.map((l) => `${l.openHouseLabel} — $${l.price.toLocaleString('en-US')} — ${l.address} (${l.cityState})`).join('\n')}\n\nSee more: https://homelensais.com/open-houses`,
  };
}

export const openHousesDigest: TemplateDef<OpenHousesDigestData> = {
  featureFlag: 'open_house_digest',
  render,
};
