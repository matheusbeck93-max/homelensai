/**
 * Smart Preference Follow-up Card. Two variants:
 *   - Actionable (update_payload set): [Update preferences] [Save as exception] [✗]
 *   - Informational (update_payload null): [Tell me more] [Not really]
 *
 * On "Save as exception" the card expands an inline text input so the user
 * can capture *why* the listing is interesting — that note is the most
 * valuable signal for future personalization, so we surface the input here
 * (instead of leaving the column empty).
 */

import React, { useState } from 'react';
import type { MismatchFollowup } from '../lib/detectMismatches';

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; text: string }
  | { kind: 'dismissed' }
  | { kind: 'exception_form' }
  | { kind: 'error'; text: string };

export interface PreferenceFollowupCardProps {
  followup: MismatchFollowup;
  onAccept: (followup: MismatchFollowup) => Promise<{ ok: boolean; error?: string }>;
  onDismiss: (followup: MismatchFollowup) => Promise<{ ok: boolean }>;
  onSaveException: (
    followup: MismatchFollowup,
    note: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onChatPrompt?: (text: string) => void;
}

const card: React.CSSProperties = {
  border: '1px solid #2a3a4e',
  background: '#15202e',
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 6,
  fontSize: 12,
  color: '#e2e8f0',
};

const btn = (variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties => {
  const palette =
    variant === 'primary'
      ? { bg: '#6B8DB5', color: '#fff', border: '#6B8DB5' }
      : variant === 'secondary'
      ? { bg: 'transparent', color: '#cbd5e1', border: '#2a3a4e' }
      : { bg: 'transparent', color: '#94a3b8', border: 'transparent' };
  return {
    padding: '5px 9px',
    background: palette.bg,
    color: palette.color,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  };
};

export function PreferenceFollowupCard({
  followup,
  onAccept,
  onDismiss,
  onSaveException,
  onChatPrompt,
}: PreferenceFollowupCardProps) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [note, setNote] = useState('');

  if (state.kind === 'dismissed') return null;
  if (state.kind === 'saved') {
    return (
      <div style={{ ...card, borderColor: '#15803d', background: 'rgba(34,197,94,0.08)' }}>
        <span style={{ color: '#4ade80' }}>✓ {state.text}</span>
      </div>
    );
  }

  const informational = followup.update_payload === null;

  const handleAccept = async () => {
    setState({ kind: 'saving' });
    const r = await onAccept(followup);
    setState(
      r.ok
        ? { kind: 'saved', text: followup.confirmation || 'Updated' }
        : { kind: 'error', text: r.error || 'Could not save' },
    );
  };

  const handleDismiss = async () => {
    setState({ kind: 'dismissed' });
    onDismiss(followup); // fire-and-forget
  };

  const handleStartException = () => setState({ kind: 'exception_form' });

  const handleSubmitException = async () => {
    setState({ kind: 'saving' });
    const r = await onSaveException(followup, note.trim());
    setState(
      r.ok
        ? { kind: 'saved', text: 'Saved to your Exceptions list' }
        : { kind: 'error', text: r.error || 'Could not save' },
    );
  };

  const handleTellMeMore = () => {
    if (followup.chat_prompt && onChatPrompt) onChatPrompt(followup.chat_prompt);
    setState({ kind: 'dismissed' });
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{followup.prompt}</div>
      {followup.detail && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{followup.detail}</div>
      )}

      {state.kind === 'exception_form' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            placeholder="Why is this one interesting? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            autoFocus
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #2a3a4e',
              background: '#0f1722',
              color: '#e2e8f0',
              fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button style={btn('ghost')} onClick={() => setState({ kind: 'idle' })}>
              Cancel
            </button>
            <button style={btn('primary')} onClick={handleSubmitException}>
              Save
            </button>
          </div>
        </div>
      ) : state.kind === 'saving' ? (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Saving…</div>
      ) : informational ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btn('primary')} onClick={handleTellMeMore}>
            Tell me more
          </button>
          <button style={btn('ghost')} onClick={handleDismiss}>
            Not really
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={btn('primary')} onClick={handleAccept}>
            Update preferences
          </button>
          <button style={btn('secondary')} onClick={handleStartException}>
            Save as exception
          </button>
          <button style={btn('ghost')} onClick={handleDismiss} aria-label="Dismiss">
            ✗
          </button>
        </div>
      )}

      {state.kind === 'error' && (
        <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{state.text}</div>
      )}
    </div>
  );
}