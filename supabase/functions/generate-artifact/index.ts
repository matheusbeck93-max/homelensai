/**
 * generate-artifact
 *
 * Conversational Intelligence Phase 3 — backend artifact renderer.
 * Single action-routed endpoint that generates downloadable files from
 * chat context (mortgage Excel today; PDF/chart kinds land in follow-ups).
 *
 * Flow per request:
 *   1. Auth + tier-aware daily cap (read from artifact_generation_log).
 *   2. Render bytes server-side (exceljs for xlsx).
 *   3. Upload to private `artifacts` bucket at `<user_id>/<artifact_id>.<ext>`.
 *   4. Insert `artifacts` row + increment `artifact_generation_log` for the day.
 *   5. Return signed download URL (7-day TTL) + artifact row.
 *
 * Daily caps are intentionally separate from the chat budget so a single
 * Excel render does not evaporate a Free user's $0.10 chat budget.
 */

import { z } from 'https://esm.sh/zod@3.23.8';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import ExcelJS from 'https://esm.sh/exceljs@4.4.0?target=deno';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { createLogger } from '../_shared/logging.ts';

const log = createLogger('generate-artifact');

// ── Schemas ──────────────────────────────────────────────────────────
const MortgageInput = z.object({
  kind: z.literal('mortgage_excel'),
  home_price: z.number().positive(),
  down_payment: z.number().min(0),
  interest_rate: z.number().min(0).max(30), // annual %
  term_years: z.number().int().min(1).max(50),
  property_tax_annual: z.number().min(0).optional(),
  insurance_annual: z.number().min(0).optional(),
  hoa_monthly: z.number().min(0).optional(),
  address: z.string().max(200).optional(),
  surface: z.string().max(40).optional(),
  source_thread_id: z.string().uuid().optional(),
});

const PurchasePlanInput = z.object({
  kind: z.literal('purchase_plan_pdf'),
  home_price: z.number().positive(),
  down_payment_pct: z.number().min(0).max(1).optional(), // 0.0 - 1.0 (e.g. 0.20 = 20%)
  interest_rate: z.number().min(0).max(30).optional(),   // annual %
  term_years: z.number().int().min(5).max(50).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  // PITI helpers (optional — fall back to rule-of-thumb estimates).
  property_tax_annual: z.number().min(0).optional(),
  insurance_annual: z.number().min(0).optional(),
  hoa_monthly: z.number().min(0).optional(),
  monthly_income: z.number().min(0).optional(),
  surface: z.string().max(40).optional(),
  source_thread_id: z.string().uuid().optional(),
});

const PropertyReportInput = z.object({
  kind: z.literal('property_report_pdf'),
  address: z.string().min(1).max(200),
  price: z.number().positive(),
  beds: z.number().min(0).max(50).optional(),
  baths: z.number().min(0).max(50).optional(),
  sqft: z.number().min(0).max(1_000_000).optional(),
  year_built: z.number().int().min(1700).max(2100).optional(),
  lot_sqft: z.number().min(0).max(50_000_000).optional(),
  hoa_monthly: z.number().min(0).optional(),
  property_tax_annual: z.number().min(0).optional(),
  zestimate: z.number().min(0).optional(),
  days_on_market: z.number().int().min(0).max(10_000).optional(),
  school_score: z.number().min(0).max(10).optional(),
  walk_score: z.number().min(0).max(100).optional(),
  summary_text: z.string().max(2000).optional(),
  surface: z.string().max(40).optional(),
  source_thread_id: z.string().uuid().optional(),
});

const ChartImageInput = z.object({
  kind: z.literal('chart_image'),
  chart_type: z.enum(['bar', 'line', 'donut']),
  title: z.string().min(1).max(120),
  x_label: z.string().max(60).optional(),
  y_label: z.string().max(60).optional(),
  series: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        value: z.number().finite(),
      }),
    )
    .min(1)
    .max(24),
  surface: z.string().max(40).optional(),
  source_thread_id: z.string().uuid().optional(),
});

const BodySchema = z.discriminatedUnion('kind', [
  MortgageInput,
  PurchasePlanInput,
  PropertyReportInput,
  ChartImageInput,
]);

// ── Tier caps (per kind per day) ─────────────────────────────────────
// Generous so the chip flow does not feel punitive; tightens if abused.
const DAILY_CAPS: Record<string, Record<string, number>> = {
  mortgage_excel: { free: 2, buyer: 20, investor: 100 },
  purchase_plan_pdf: { free: 1, buyer: 10, investor: 50 },
  property_report_pdf: { free: 1, buyer: 10, investor: 50 },
  chart_image: { free: 3, buyer: 30, investor: 200 },
};

function normalizeTier(raw: unknown): 'free' | 'buyer' | 'investor' {
  if (raw === 'investor' || raw === 'premium') return 'investor';
  if (raw === 'buyer' || raw === 'paid') return 'buyer';
  return 'free';
}

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUser(req: Request) {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const supabase = serviceClient();
  const { data } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
  return data.user ?? null;
}

// ── Mortgage Excel renderer ──────────────────────────────────────────
async function renderMortgageExcel(input: z.infer<typeof MortgageInput>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HomeLens';
  wb.created = new Date();

  // ── Inputs sheet ──
  const inputs = wb.addWorksheet('Inputs');
  inputs.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 18 },
  ];
  inputs.getRow(1).font = { bold: true };

  const rows: Array<[string, number | string, string?]> = [
    ['Address', input.address ?? '—'],
    ['Home price', input.home_price, '"$"#,##0'],
    ['Down payment', input.down_payment, '"$"#,##0'],
    ['Loan amount', { formula: '=B3-B4' } as any, '"$"#,##0'],
    ['Annual interest rate', input.interest_rate / 100, '0.000%'],
    ['Term (years)', input.term_years],
    ['Property tax (annual)', input.property_tax_annual ?? 0, '"$"#,##0'],
    ['Insurance (annual)', input.insurance_annual ?? 0, '"$"#,##0'],
    ['HOA (monthly)', input.hoa_monthly ?? 0, '"$"#,##0'],
  ];
  rows.forEach((r, i) => {
    const row = inputs.addRow({ field: r[0], value: r[1] as any });
    if (r[2]) row.getCell('value').numFmt = r[2];
    if (typeof r[1] === 'number') row.getCell('value').font = { color: { argb: 'FF0000FF' } };
  });

  // Loan amount formula (overrides the literal stub)
  inputs.getCell('B5').value = { formula: 'B3-B4' } as any;
  inputs.getCell('B5').numFmt = '"$"#,##0';

  // ── Summary sheet ──
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 18 },
  ];
  summary.getRow(1).font = { bold: true };

  // Monthly P&I via PMT, then add escrow
  // r = annual_rate/12, n = years*12
  summary.addRow({ metric: 'Monthly principal & interest', value: { formula: '-PMT(Inputs!B7/12, Inputs!B8*12, Inputs!B5)' } });
  summary.addRow({ metric: 'Monthly property tax', value: { formula: 'Inputs!B9/12' } });
  summary.addRow({ metric: 'Monthly insurance', value: { formula: 'Inputs!B10/12' } });
  summary.addRow({ metric: 'Monthly HOA', value: { formula: 'Inputs!B11' } });
  summary.addRow({ metric: 'Total monthly payment (PITI+HOA)', value: { formula: 'B2+B3+B4+B5' } });
  summary.addRow({ metric: 'Total interest over life of loan', value: { formula: 'B2*Inputs!B8*12 - Inputs!B5' } });
  summary.addRow({ metric: 'Total cost over life of loan', value: { formula: 'B6*Inputs!B8*12 + Inputs!B4' } });
  for (let r = 2; r <= 8; r++) summary.getCell(`B${r}`).numFmt = '"$"#,##0';
  summary.getRow(6).font = { bold: true };

  // ── Amortization sheet ──
  const amort = wb.addWorksheet('Amortization');
  amort.columns = [
    { header: 'Month', key: 'm', width: 8 },
    { header: 'Payment', key: 'pay', width: 14 },
    { header: 'Principal', key: 'prin', width: 14 },
    { header: 'Interest', key: 'int', width: 14 },
    { header: 'Balance', key: 'bal', width: 16 },
  ];
  amort.getRow(1).font = { bold: true };

  const n = input.term_years * 12;
  // Seed row 2 references loan balance + first payment.
  amort.addRow({ m: 1 });
  amort.getCell('B2').value = { formula: 'Summary!B2' };
  amort.getCell('D2').value = { formula: 'Inputs!B5 * (Inputs!B7/12)' };
  amort.getCell('C2').value = { formula: 'B2 - D2' };
  amort.getCell('E2').value = { formula: 'Inputs!B5 - C2' };

  for (let i = 2; i <= n; i++) {
    const r = i + 1;
    amort.addRow({ m: i });
    amort.getCell(`B${r}`).value = { formula: 'Summary!B2' };
    amort.getCell(`D${r}`).value = { formula: `E${r - 1} * (Inputs!B7/12)` };
    amort.getCell(`C${r}`).value = { formula: `B${r} - D${r}` };
    amort.getCell(`E${r}`).value = { formula: `E${r - 1} - C${r}` };
  }
  ['B', 'C', 'D', 'E'].forEach((col) => {
    for (let r = 2; r <= n + 1; r++) amort.getCell(`${col}${r}`).numFmt = '"$"#,##0';
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ── Purchase Plan PDF renderer ───────────────────────────────────────
// 2-page brand-styled buyer roadmap. Pure pdf-lib (built-in Helvetica),
// no external font fetching. All math defaults to safe US averages when
// the AI omits a field — the document always renders.
async function renderPurchasePlanPdf(input: z.infer<typeof PurchasePlanInput>): Promise<Uint8Array> {
  const homePrice = input.home_price;
  const dpPct = input.down_payment_pct ?? 0.20;
  const dp = Math.round(homePrice * dpPct);
  const loan = homePrice - dp;
  const rate = (input.interest_rate ?? 6.75) / 100;
  const termYears = input.term_years ?? 30;
  const n = termYears * 12;
  const r = rate / 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  const monthlyTax = (input.property_tax_annual ?? homePrice * 0.011) / 12;
  const monthlyIns = (input.insurance_annual ?? homePrice * 0.0035) / 12;
  const monthlyHoa = input.hoa_monthly ?? 0;
  const monthlyPITI = monthlyPI + monthlyTax + monthlyIns + monthlyHoa;
  const closingCosts = Math.round(homePrice * 0.03);
  const cashToClose = dp + closingCosts;
  const recommendedOfferLow = Math.round(homePrice * 0.96);
  const recommendedOfferHigh = Math.round(homePrice * 1.02);
  const dtiMonthlyCap = input.monthly_income ? Math.round(input.monthly_income * 0.36) : null;

  const pdf = await PDFDocument.create();
  pdf.setTitle('HomeLens Purchase Plan');
  pdf.setCreator('HomeLens');
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Brand palette
  const steel = rgb(0x6b / 255, 0x8d / 255, 0xb5 / 255);
  const dark = rgb(0x2c / 255, 0x3e / 255, 0x55 / 255);
  const muted = rgb(0.40, 0.46, 0.52);
  const hairline = rgb(0.85, 0.87, 0.90);

  const fmtUsd = (n: number) =>
    `$${Math.round(n).toLocaleString('en-US')}`;
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const addressLine = input.address
    ?? [input.city, input.state].filter(Boolean).join(', ')
    ?? 'Subject property';

  // ── Page 1: Purchase Summary ──
  {
    const page = pdf.addPage([612, 792]); // US Letter
    let y = 740;

    // Header band
    page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: dark });
    page.drawText('HomeLens', {
      x: 48, y: 765, size: 14, font: helvBold, color: rgb(1, 1, 1),
    });
    page.drawText('Purchase Plan', {
      x: 540 - helv.widthOfTextAtSize('Purchase Plan', 11), y: 766,
      size: 11, font: helv, color: rgb(0.9, 0.92, 0.95),
    });

    y = 712;
    page.drawText('Purchase summary', { x: 48, y, size: 20, font: helvBold, color: dark });
    y -= 8;
    page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 1, color: steel });
    y -= 24;

    page.drawText(addressLine.slice(0, 90), { x: 48, y, size: 12, font: helvBold, color: dark });
    y -= 16;
    page.drawText(`Generated ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, {
      x: 48, y, size: 9, font: helv, color: muted,
    });
    y -= 28;

    const rows: Array<[string, string]> = [
      ['List price', fmtUsd(homePrice)],
      ['Recommended offer band', `${fmtUsd(recommendedOfferLow)} – ${fmtUsd(recommendedOfferHigh)}`],
      ['Down payment', `${fmtUsd(dp)} (${fmtPct(dpPct)})`],
      ['Loan amount', fmtUsd(loan)],
      ['Estimated closing costs (~3%)', fmtUsd(closingCosts)],
      ['Cash to close', fmtUsd(cashToClose)],
    ];
    for (const [label, val] of rows) {
      page.drawText(label, { x: 48, y, size: 11, font: helv, color: dark });
      const w = helvBold.widthOfTextAtSize(val, 11);
      page.drawText(val, { x: 564 - w, y, size: 11, font: helvBold, color: dark });
      y -= 8;
      page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 0.5, color: hairline });
      y -= 14;
    }

    y -= 18;
    page.drawText('Estimated monthly cost', { x: 48, y, size: 14, font: helvBold, color: steel });
    y -= 20;
    const monthly: Array<[string, string]> = [
      ['Principal & interest', fmtUsd(monthlyPI)],
      ['Property tax (est.)', fmtUsd(monthlyTax)],
      ['Insurance (est.)', fmtUsd(monthlyIns)],
      ['HOA', monthlyHoa > 0 ? fmtUsd(monthlyHoa) : '—'],
      ['Total monthly (PITI+HOA)', fmtUsd(monthlyPITI)],
    ];
    for (const [label, val] of monthly) {
      const isTotal = label.startsWith('Total');
      const font = isTotal ? helvBold : helv;
      page.drawText(label, { x: 48, y, size: 11, font, color: dark });
      const w = (isTotal ? helvBold : helvBold).widthOfTextAtSize(val, 11);
      page.drawText(val, { x: 564 - w, y, size: 11, font: helvBold, color: isTotal ? steel : dark });
      y -= 8;
      page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 0.5, color: hairline });
      y -= 14;
    }

    y -= 20;
    page.drawText('Affordability guidance', { x: 48, y, size: 14, font: helvBold, color: steel });
    y -= 20;
    const dtiNote = dtiMonthlyCap
      ? `At a conservative 36% DTI, your housing target stays at or below ${fmtUsd(dtiMonthlyCap)}/mo.`
      : 'Lenders typically cap total housing payment at 28% of gross monthly income and total debt at 36–43%.';
    drawWrapped(page, dtiNote, 48, y, 516, 11, helv, dark);

    // Footer
    page.drawText('Page 1 of 2', { x: 48, y: 36, size: 9, font: helv, color: muted });
    page.drawText('HomeLens — Big decisions deserve the full picture.', {
      x: 564 - helv.widthOfTextAtSize('HomeLens — Big decisions deserve the full picture.', 9),
      y: 36, size: 9, font: helv, color: muted,
    });
  }

  // ── Page 2: 12-Month Action Checklist ──
  {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: dark });
    page.drawText('HomeLens', { x: 48, y: 765, size: 14, font: helvBold, color: rgb(1, 1, 1) });
    page.drawText('Purchase Plan', {
      x: 540 - helv.widthOfTextAtSize('Purchase Plan', 11), y: 766,
      size: 11, font: helv, color: rgb(0.9, 0.92, 0.95),
    });

    let y = 712;
    page.drawText('Your 12-month action plan', { x: 48, y, size: 20, font: helvBold, color: dark });
    y -= 8;
    page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 1, color: steel });
    y -= 30;

    const steps: Array<{ title: string; detail: string }> = [
      { title: 'Get pre-approved', detail: 'Compare 2-3 lenders for rate + fees; a written pre-approval letter strengthens your offer.' },
      { title: 'Lock your budget ceiling', detail: `Stay at or below ${fmtUsd(monthlyPITI)}/mo total housing — leaves room for maintenance and life events.` },
      { title: 'Build the down payment + reserves', detail: `Target ${fmtUsd(cashToClose)} for closing, plus 3-6 months of housing payments in reserves.` },
      { title: 'Tour with a defined scorecard', detail: 'Score every property on must-haves (location, beds/baths) before nice-to-haves.' },
      { title: 'Make a disciplined offer', detail: `Anchor offers in the ${fmtUsd(recommendedOfferLow)}–${fmtUsd(recommendedOfferHigh)} band, adjusting for inspection findings.` },
      { title: 'Order inspection & appraisal', detail: 'Independent inspector + lender appraisal. Use findings to renegotiate, not to abandon.' },
      { title: 'Lock the rate at the right moment', detail: 'Lock when under contract or when rates dip materially; confirm lock duration covers closing.' },
      { title: 'Walk through and close', detail: 'Final walk-through 24h before closing; wire funds only after verbal verification with your title company.' },
    ];
    for (const s of steps) {
      // Checkbox
      page.drawRectangle({
        x: 48, y: y - 2, width: 12, height: 12,
        borderColor: steel, borderWidth: 1, color: rgb(1, 1, 1),
      });
      page.drawText(s.title, { x: 68, y, size: 12, font: helvBold, color: dark });
      y -= 14;
      drawWrapped(page, s.detail, 68, y, 496, 10, helv, muted);
      y -= 20;
      if (y < 90) break;
    }

    page.drawText('Page 2 of 2', { x: 48, y: 36, size: 9, font: helv, color: muted });
    page.drawText('HomeLens — Big decisions deserve the full picture.', {
      x: 564 - helv.widthOfTextAtSize('HomeLens — Big decisions deserve the full picture.', 9),
      y: 36, size: 9, font: helv, color: muted,
    });
  }

  return await pdf.save();
}

// Wrap simple text in pdf-lib using greedy word fit. Advances y per line.
function drawWrapped(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color: ReturnType<typeof rgb>,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + 3;
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= size + 3;
  }
  return cursorY;
}

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') return errorResponse('method_not_allowed', 405, req);

  const user = await getUser(req);
  if (!user) return errorResponse('unauthorized', 401, req);

  let raw: unknown;
  try { raw = await req.json(); } catch { return validationError('invalid_json', undefined, req); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return validationError('invalid_body', parsed.error.flatten(), req);
  const body = parsed.data;

  const supabase = serviceClient();

  // Tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .maybeSingle();
  const tier = normalizeTier(profile?.subscription_status);

  // Daily cap check
  const today = new Date().toISOString().slice(0, 10);
  const cap = DAILY_CAPS[body.kind]?.[tier] ?? 0;
  const { data: logRow } = await supabase
    .from('artifact_generation_log')
    .select('count')
    .eq('user_id', user.id)
    .eq('kind', body.kind)
    .eq('day', today)
    .maybeSingle();
  const used = logRow?.count ?? 0;
  if (used >= cap) {
    return jsonResponse(
      { error: 'daily_cap_reached', kind: body.kind, used, cap, tier },
      429,
      req,
    );
  }

  // Render
  let bytes: Uint8Array;
  let mime: string;
  let ext: string;
  let baseName: string;
  try {
    if (body.kind === 'mortgage_excel') {
      bytes = await renderMortgageExcel(body);
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
      baseName = body.address ? `mortgage-${body.address.slice(0, 40)}` : 'mortgage';
    } else if (body.kind === 'purchase_plan_pdf') {
      bytes = await renderPurchasePlanPdf(body);
      mime = 'application/pdf';
      ext = 'pdf';
      const addr = body.address ?? [body.city, body.state].filter(Boolean).join('-');
      baseName = `purchase-plan-${(addr || 'home').slice(0, 40)}-${new Date()
        .toISOString().slice(0, 10).replace(/-/g, '')}`;
    } else {
      return errorResponse('unsupported_kind', 400, req);
    }
  } catch (e) {
    log.error('render_failed', { kind: body.kind, error: (e as Error).message });
    return errorResponse('render_failed', 500, req);
  }

  // Upload
  const artifactId = crypto.randomUUID();
  const safe = baseName.replace(/[^a-z0-9\-]+/gi, '-').toLowerCase();
  const filename = `${safe}-${artifactId.slice(0, 8)}.${ext}`;
  const storagePath = `${user.id}/${artifactId}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('artifacts')
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) {
    log.error('upload_failed', { error: upErr.message });
    return errorResponse('upload_failed', 500, req);
  }

  // Insert artifact row + increment log
  const { error: insErr } = await supabase.from('artifacts').insert({
    id: artifactId,
    user_id: user.id,
    kind: body.kind,
    filename,
    storage_path: storagePath,
    mime_type: mime,
    size_bytes: bytes.byteLength,
    status: 'ready',
    surface: body.surface ?? null,
    source_thread_id: body.source_thread_id ?? null,
    input: body,
  });
  if (insErr) {
    log.error('artifact_insert_failed', { error: insErr.message });
    // best-effort cleanup
    await supabase.storage.from('artifacts').remove([storagePath]);
    return errorResponse('persist_failed', 500, req);
  }

  // Upsert log row (count = count + 1). RPC would be cleaner; do a manual UPDATE/INSERT.
  const { data: existing } = await supabase
    .from('artifact_generation_log')
    .select('id, count')
    .eq('user_id', user.id).eq('kind', body.kind).eq('day', today)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from('artifact_generation_log')
      .update({ count: (existing.count ?? 0) + 1 })
      .eq('id', existing.id);
  } else {
    await supabase.from('artifact_generation_log').insert({
      user_id: user.id, kind: body.kind, day: today, count: 1,
    });
  }

  // Sign download URL — 7 days
  const { data: signed, error: signErr } = await supabase.storage
    .from('artifacts')
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60);
  if (signErr || !signed?.signedUrl) {
    log.error('sign_failed', { error: signErr?.message });
    return errorResponse('sign_failed', 500, req);
  }

  log.info('artifact_generated', { kind: body.kind, id: artifactId, surface: body.surface ?? null });

  return jsonResponse({
    artifact: {
      id: artifactId,
      kind: body.kind,
      filename,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      download_url: signed.signedUrl,
      download_url_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    cap: { used: used + 1, limit: cap, tier },
  }, 200, req);
});