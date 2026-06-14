import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComposedCard } from '@/lib/investorBrief/types';
import { streamInvestorChat, BudgetExceededError } from '@/lib/investorChat/streamClient';
import { anchorFor, type CurrentTurn, type ToolEvent } from '@/lib/investorChat/turnTypes';

export type BriefMode = 'brief' | 'chat';

export interface SessionFilters {
  marketsAdd?: string[];
  marketsReplace?: string[];
  budgetOverride?: { min?: number; max?: number };
  capRateOverride?: number;
  beds?: number;
  baths?: number;
  note?: string;
  setAt?: string;
}

function hasAnyFilter(f: SessionFilters | null | undefined): boolean {
  if (!f) return false;
  return Boolean(
    f.marketsAdd?.length ||
      f.marketsReplace?.length ||
      f.budgetOverride?.min != null ||
      f.budgetOverride?.max != null ||
      f.capRateOverride != null ||
      f.beds != null ||
      f.baths != null ||
      f.note,
  );
}

function mergeFilters(prev: SessionFilters | null, patch: SessionFilters): SessionFilters {
  const base: SessionFilters = prev ?? {};
  const next: SessionFilters = { ...base };
  if (patch.marketsReplace) next.marketsReplace = patch.marketsReplace;
  if (patch.marketsAdd) {
    const merged = Array.from(new Set([...(base.marketsAdd ?? []), ...patch.marketsAdd]));
    next.marketsAdd = merged;
  }
  if (patch.budgetOverride)
    next.budgetOverride = { ...(base.budgetOverride ?? {}), ...patch.budgetOverride };
  if (patch.capRateOverride != null) next.capRateOverride = patch.capRateOverride;
  if (patch.beds != null) next.beds = patch.beds;
  if (patch.baths != null) next.baths = patch.baths;
  if (patch.note != null) next.note = patch.note;
  next.setAt = new Date().toISOString();
  return next;
}

const SESSION_FILTERS_STORAGE_PREFIX = 'homelens.investorChat.sessionFilters.v1.';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional list of AI tool ids invoked while producing this turn. */
  toolCalls?: string[];
  /** Tool events captured for this turn (assistant only). */
  toolEvents?: ToolEvent[];
  /** Conversational Intelligence signals emitted by the AI on this turn. */
  signals?: {
    mismatch_signals?: Array<Record<string, unknown>>;
    suggested_followups?: Array<{ label: string; action: Record<string, unknown> }>;
  };
  createdAt: number;
}

export interface ActiveCardContext {
  card: ComposedCard;
  /** Synthesized one-line context summary used by the ContextCard chip. */
  summary: string;
  severity: 'info' | 'opportunity' | 'warning';
}

interface InvestorBriefContextValue {
  mode: BriefMode;
  activeCardContext: ActiveCardContext | null;
  threads: Record<string, ChatTurn[]>;
  /** Active thread key — card id when investigating, "__freeform__" otherwise. */
  activeThreadKey: string;
  currentThread: ChatTurn[];
  currentTurn: CurrentTurn;
  threadIdByKey: Record<string, string | undefined>;
  sessionFilters: SessionFilters | null;
  clearSessionFilters: () => void;
  enterChatModeFromCard: (card: ComposedCard, severity?: ActiveCardContext['severity']) => void;
  enterChatModeFromQuery: (query: string) => void;
  exitChatMode: () => void;
  appendUserMessage: (text: string) => void;
  appendAssistantMessage: (text: string, toolCalls?: string[]) => void;
  sendTurn: (text: string) => Promise<void>;
}

const FREEFORM_KEY = '__freeform__';

const Ctx = createContext<InvestorBriefContextValue | null>(null);

function nextId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `m_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function InvestorBriefProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<BriefMode>('brief');
  const [activeCardContext, setActiveCardContext] = useState<ActiveCardContext | null>(null);
  const [threads, setThreads] = useState<Record<string, ChatTurn[]>>({});
  const [activeThreadKey, setActiveThreadKey] = useState<string>(FREEFORM_KEY);
  const seededRef = useRef<Set<string>>(new Set());
  const [threadIdByKey, setThreadIdByKey] = useState<Record<string, string | undefined>>({});
  const [sessionFiltersByKey, setSessionFiltersByKey] = useState<
    Record<string, SessionFilters | null>
  >({});
  const [currentTurn, setCurrentTurn] = useState<CurrentTurn>({
    status: 'idle',
    text: '',
    toolEvents: [],
  });
  const pendingSignalsRef = useRef<ChatTurn['signals'] | null>(null);
  const activeKeyRef = useRef(activeThreadKey);
  activeKeyRef.current = activeThreadKey;
  const activeCtxRef = useRef(activeCardContext);
  activeCtxRef.current = activeCardContext;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const threadIdRef = useRef(threadIdByKey);
  threadIdRef.current = threadIdByKey;
  const sessionFiltersRef = useRef(sessionFiltersByKey);
  sessionFiltersRef.current = sessionFiltersByKey;

  // Hydrate persisted session filters for the active thread key.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionFiltersByKey[activeThreadKey] !== undefined) return;
    try {
      const raw = localStorage.getItem(SESSION_FILTERS_STORAGE_PREFIX + activeThreadKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SessionFilters;
        setSessionFiltersByKey((prev) => ({ ...prev, [activeThreadKey]: parsed }));
      }
    } catch {
      /* ignore */
    }
  }, [activeThreadKey, sessionFiltersByKey]);

  const persistSessionFilters = useCallback(
    (key: string, next: SessionFilters | null) => {
      if (typeof window === 'undefined') return;
      try {
        if (next && hasAnyFilter(next)) {
          localStorage.setItem(SESSION_FILTERS_STORAGE_PREFIX + key, JSON.stringify(next));
        } else {
          localStorage.removeItem(SESSION_FILTERS_STORAGE_PREFIX + key);
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const clearSessionFilters = useCallback(() => {
    const key = activeKeyRef.current;
    setSessionFiltersByKey((prev) => ({ ...prev, [key]: null }));
    persistSessionFilters(key, null);
  }, [persistSessionFilters]);

  const appendTurn = useCallback((key: string, turn: ChatTurn) => {
    setThreads((prev) => {
      const existing = prev[key] ?? [];
      return { ...prev, [key]: [...existing, turn] };
    });
  }, []);

  const enterChatModeFromCard = useCallback<
    InvestorBriefContextValue['enterChatModeFromCard']
  >((card, severity = 'info') => {
    const summary = card.summary || card.subtitle || card.title;
    setActiveCardContext({ card, summary, severity });
    setActiveThreadKey(card.id);
    setMode('chat');

    if (!seededRef.current.has(card.id)) {
      seededRef.current.add(card.id);
      const now = Date.now();
      const seed: ChatTurn[] = [
        {
          id: nextId(),
          role: 'system',
          content: `Context · ${card.title}: ${summary}`,
          createdAt: now,
        },
        {
          id: nextId(),
          role: 'assistant',
          content: card.investigatePrompt,
          createdAt: now + 1,
        },
      ];
      setThreads((prev) => ({ ...prev, [card.id]: seed }));
    }
  }, []);

  const enterChatModeFromQuery = useCallback<
    InvestorBriefContextValue['enterChatModeFromQuery']
  >((_query) => {
    setActiveCardContext(null);
    setActiveThreadKey(FREEFORM_KEY);
    setMode('chat');
  }, []);

  const exitChatMode = useCallback(() => {
    setMode('brief');
    setActiveCardContext(null);
    setActiveThreadKey(FREEFORM_KEY);
  }, []);

  const appendUserMessage = useCallback(
    (text: string) =>
      appendTurn(activeThreadKey, {
        id: nextId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      }),
    [appendTurn, activeThreadKey],
  );

  const appendAssistantMessage = useCallback(
    (text: string, toolCalls?: string[]) =>
      appendTurn(activeThreadKey, {
        id: nextId(),
        role: 'assistant',
        content: text,
        toolCalls,
        createdAt: Date.now(),
      }),
    [appendTurn, activeThreadKey],
  );

  const sendTurn = useCallback(async (text: string) => {
    const key = activeKeyRef.current;
    // optimistic user turn
    const userTurn: ChatTurn = {
      id: nextId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    setThreads((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), userTurn] }));

    setCurrentTurn({ status: 'streaming', text: '', toolEvents: [] });

    // build outgoing messages from history (exclude system seeds)
    const history = (threadsRef.current[key] ?? [])
      .filter((t) => t.role !== 'system')
      .map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content }));
    const messages = [...history, { role: 'user' as const, content: text }];

    try {
      await streamInvestorChat({
        threadId: threadIdRef.current[key],
        messages,
        sessionFilters: sessionFiltersRef.current[key] ?? null,
        activeCardContext: activeCtxRef.current
          ? {
              card: { id: activeCtxRef.current.card.id, title: activeCtxRef.current.card.title },
              summary: activeCtxRef.current.summary,
              severity: activeCtxRef.current.severity,
            }
          : null,
        onEvent: (ev) => {
          if (ev.type === 'thread') {
            setThreadIdByKey((prev) => ({ ...prev, [key]: ev.threadId }));
          } else if (ev.type === 'text_delta') {
            setCurrentTurn((prev) => ({ ...prev, text: prev.text + ev.delta }));
          } else if (ev.type === 'tool_use_start') {
            setCurrentTurn((prev) => ({
              ...prev,
              toolEvents: [
                ...prev.toolEvents,
                {
                  id: ev.id,
                  name: ev.name,
                  input: ev.input,
                  status: 'running',
                  anchor: anchorFor(ev.name),
                },
              ],
            }));
          } else if (ev.type === 'tool_use_result') {
            setCurrentTurn((prev) => ({
              ...prev,
              toolEvents: prev.toolEvents.map((t) =>
                t.id === ev.id ? { ...t, output: ev.output, status: 'done' } : t,
              ),
            }));
            // Side-effect: apply_session_filter mutates session-filter state.
            if (ev.name === 'apply_session_filter' && ev.output && !ev.output.error) {
              const patch = ev.output as SessionFilters;
              setSessionFiltersByKey((prev) => {
                const next = mergeFilters(prev[key] ?? null, patch);
                persistSessionFilters(key, next);
                return { ...prev, [key]: next };
              });
            }
          } else if (ev.type === 'tool_use_error') {
            setCurrentTurn((prev) => ({
              ...prev,
              toolEvents: prev.toolEvents.map((t) =>
                t.id === ev.id ? { ...t, error: ev.error, status: 'error' } : t,
              ),
            }));
          } else if (ev.type === 'signals') {
            pendingSignalsRef.current = {
              mismatch_signals: ev.mismatch_signals,
              suggested_followups: ev.suggested_followups,
            };
          } else if (ev.type === 'turn_done') {
            setCurrentTurn((prev) => {
              const assistantTurn: ChatTurn = {
                id: ev.messageId ?? nextId(),
                role: 'assistant',
                content: prev.text,
                toolCalls: prev.toolEvents.map((t) => t.name),
                toolEvents: prev.toolEvents,
                signals: pendingSignalsRef.current ?? undefined,
                createdAt: Date.now(),
              };
              pendingSignalsRef.current = null;
              setThreads((p) => ({
                ...p,
                [key]: [...(p[key] ?? []), assistantTurn],
              }));
              return { status: 'done', text: '', toolEvents: [], threadId: ev.threadId };
            });
          } else if (ev.type === 'error') {
            setCurrentTurn((prev) => ({ ...prev, status: 'error', error: ev.message }));
          }
        },
      });
    } catch (e) {
      if (e instanceof BudgetExceededError) {
        // Cap state is already updated; suppress the generic error toast
        // so the BudgetCapBlocker is the only signal.
        setCurrentTurn({ status: 'done', text: '', toolEvents: [] });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      setCurrentTurn({ status: 'error', text: '', toolEvents: [], error: msg });
    }
  }, [persistSessionFilters]);

  const value = useMemo<InvestorBriefContextValue>(
    () => ({
      mode,
      activeCardContext,
      threads,
      activeThreadKey,
      currentThread: threads[activeThreadKey] ?? [],
      currentTurn,
      threadIdByKey,
      sessionFilters: sessionFiltersByKey[activeThreadKey] ?? null,
      clearSessionFilters,
      enterChatModeFromCard,
      enterChatModeFromQuery,
      exitChatMode,
      appendUserMessage,
      appendAssistantMessage,
      sendTurn,
    }),
    [
      mode,
      activeCardContext,
      threads,
      activeThreadKey,
      currentTurn,
      threadIdByKey,
      sessionFiltersByKey,
      clearSessionFilters,
      enterChatModeFromCard,
      enterChatModeFromQuery,
      exitChatMode,
      appendUserMessage,
      appendAssistantMessage,
      sendTurn,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInvestorBriefSurface(): InvestorBriefContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useInvestorBriefSurface must be used inside <InvestorBriefProvider>');
  }
  return v;
}