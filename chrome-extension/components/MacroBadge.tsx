/**
 * MacroBadge — compact metro macro snapshot rendered above the chat when
 * a property listing is detected. Data sourced via fetchMacroBadge (BLS
 * + FRED through the extension-macro-badge edge function).
 *
 * Fails silently (returns null) when no data is available — never blocks
 * the chat UI.
 */

import React, { useEffect, useState } from 'react';
import { fetchMacroBadge, type MacroBadgeData } from '../lib/fetchMacroBadge';

interface Props {
  city: string;
  state: string;
  authHeader: string | null;
}

const card: React.CSSProperties = {
  border: '1px solid #2a3a4e',
  background: '#15202e',
  borderRadius: 8,
  padding: '10px 12px',
  margin: '8px 12px',
  fontSize: 11,
  color: '#e5e7eb',
};
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 6,
};
const title: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
const metroLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#e5e7eb' };
const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '2px 0',
};
const rowLabel: React.CSSProperties = { color: '#9ca3af' };
const rowValue: React.CSSProperties = { color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' };
const footer: React.CSSProperties = { marginTop: 6, fontSize: 10, color: '#6b7280' };
const skeletonBar: React.CSSProperties = {
  height: 8,
  background: '#1f2a3a',
  borderRadius: 4,
  margin: '4px 0',
};

function fmtPct(v: number | null | undefined, sign = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = sign && v > 0 ? '+' : '';
  return `${s}${v.toFixed(1)}%`;
}
function fmtBps(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const s = v > 0 ? '+' : '';
  return `${s}${Math.round(v)}bps`;
}
function ago(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function MacroBadge({ city, state, authHeader }: Props) {
  const [state_, setState_] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; data: MacroBadgeData; cachedAt: number }
    | { kind: 'hidden' }
  >({ kind: 'loading' });

  useEffect(() => {
    if (!authHeader || !city || !state) {
      setState_({ kind: 'hidden' });
      return;
    }
    let cancelled = false;
    setState_({ kind: 'loading' });
    fetchMacroBadge(city, state, authHeader).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState_({ kind: 'hidden' });
        return;
      }
      const d = res.data;
      // If every block is null there is nothing useful to show.
      if (!d.labor && !d.wage && !d.hpi && !d.rate) {
        setState_({ kind: 'hidden' });
        return;
      }
      setState_({ kind: 'ready', data: d, cachedAt: res.cachedAt });
    });
    return () => {
      cancelled = true;
    };
  }, [city, state, authHeader]);

  if (state_.kind === 'hidden') return null;

  if (state_.kind === 'loading') {
    return (
      <div style={card} aria-busy="true">
        <div style={header}>
          <span style={title}>Macro snapshot</span>
          <span style={metroLabel}>{city}, {state}</span>
        </div>
        <div style={skeletonBar} />
        <div style={{ ...skeletonBar, width: '75%' }} />
        <div style={{ ...skeletonBar, width: '60%' }} />
      </div>
    );
  }

  const { data, cachedAt } = state_;
  return (
    <div style={card}>
      <div style={header}>
        <span style={title}>Macro snapshot</span>
        <span style={metroLabel}>{data.metro}</span>
      </div>
      {data.labor && data.labor.unemployment_pct != null && (
        <div style={row}>
          <span style={rowLabel}>Unemployment</span>
          <span style={rowValue}>
            {fmtPct(data.labor.unemployment_pct)}{' '}
            <span style={{ color: '#6b7280' }}>per BLS</span>
          </span>
        </div>
      )}
      {data.wage && data.wage.wage_yoy_pct != null && (
        <div style={row}>
          <span style={rowLabel}>Wage YoY</span>
          <span style={rowValue}>
            {fmtPct(data.wage.wage_yoy_pct, true)}
            {data.wage.home_price_yoy_pct != null && (
              <span style={{ color: '#6b7280' }}>
                {' '}vs price {fmtPct(data.wage.home_price_yoy_pct, true)}
              </span>
            )}
          </span>
        </div>
      )}
      {data.rate && data.rate.rate_30y_pct != null && (
        <div style={row}>
          <span style={rowLabel}>Mortgage 30y</span>
          <span style={rowValue}>
            {fmtPct(data.rate.rate_30y_pct)}{' '}
            <span style={{ color: '#6b7280' }}>
              {data.rate.change_30d_bps != null ? `${fmtBps(data.rate.change_30d_bps)} 30d` : 'per FRED'}
            </span>
          </span>
        </div>
      )}
      {data.hpi && data.hpi.yoy_pct != null && (
        <div style={row}>
          <span style={rowLabel}>HPI YoY</span>
          <span style={rowValue}>
            {fmtPct(data.hpi.yoy_pct, true)}{' '}
            <span style={{ color: '#6b7280' }}>
              {data.hpi.fallback_to_national ? 'national' : 'metro'}
            </span>
          </span>
        </div>
      )}
      <div style={footer}>
        source: {data.source} · cached {ago(cachedAt)}
      </div>
    </div>
  );
}