/**
 * Server-side milestone share-card rendering.
 *
 * Builds a 1080×1080 branded SVG, then rasterizes it to PNG via
 * @resvg/resvg-wasm. The wasm binary is fetched and initialized lazily on
 * the first call per warm Edge instance (~150ms cold start). If
 * rasterization fails, callers can fall back to the SVG string.
 */

import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2';

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch('https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm'),
    );
  }
  return wasmReady;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export interface ShareCardInput {
  headline: string;
  context?: string | null;
  /** Optional category label shown above the headline (e.g. "Milestone"). */
  eyebrow?: string;
}

export function buildSvg({ headline, context, eyebrow }: ShareCardInput): string {
  const headlineLines = wrap(headline, 22);
  const contextLines = context ? wrap(context, 38) : [];
  const lineHeight = 92;
  const headlineStartY = 420 - ((headlineLines.length - 1) * lineHeight) / 2;
  const headlineTspans = headlineLines
    .map(
      (l, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(l)}</tspan>`,
    )
    .join('');
  const contextTspans = contextLines
    .map(
      (l, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : 38}">${escapeXml(l)}</tspan>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2C3E55"/>
        <stop offset="100%" stop-color="#6B8DB5"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <text x="540" y="200" fill="#9FB6D1" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="28" font-weight="600" letter-spacing="6" text-anchor="middle">${escapeXml((eyebrow ?? 'MILESTONE').toUpperCase())}</text>
    <text x="540" y="${headlineStartY}" fill="#FFFFFF" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="76" font-weight="800" text-anchor="middle">${headlineTspans}</text>
    ${
      contextLines.length
        ? `<text x="540" y="780" fill="#D4E0EF" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="30" font-weight="400" text-anchor="middle">${contextTspans}</text>`
        : ''
    }
    <text x="540" y="980" fill="#FFFFFF" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" text-anchor="middle">Tracking with HomeLens</text>
    <text x="540" y="1018" fill="#9FB6D1" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="22" text-anchor="middle">homelensais.com</text>
  </svg>`;
}

export async function renderPng(input: ShareCardInput): Promise<Uint8Array> {
  await ensureWasm();
  const svg = buildSvg(input);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}