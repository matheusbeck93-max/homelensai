/**
 * Shared HTML email layout. No JSX — plain template literals so the edge
 * runtime doesn't need a React Email build. Brand palette matches the app:
 * steel-blue primary `#6B8DB5`, dark navy `#2C3E55`.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface BaseLayoutInput {
  preview: string;
  bodyHtml: string;
  unsubscribeUrl: string;
}

export function baseLayout({ preview, bodyHtml, unsubscribeUrl }: BaseLayoutInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>HomeLens</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C3E55;">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 0 24px 0;">
                <div style="font-size:18px;font-weight:700;color:#2C3E55;letter-spacing:-0.01em;">HomeLens</div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #E5EAF0;border-radius:14px;padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;color:#7A8A9A;font-size:12px;line-height:1.6;">
                <div>Big decisions deserve the full picture.</div>
                <div style="margin-top:8px;">
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6B8DB5;text-decoration:underline;">Unsubscribe</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://homelensais.com/account/email-preferences" style="color:#6B8DB5;text-decoration:underline;">Email preferences</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#2C3E55;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>`;
}

export { escapeHtml };