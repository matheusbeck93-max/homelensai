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

const BodySchema = z.discriminatedUnion('kind', [MortgageInput, PurchasePlanInput]);

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