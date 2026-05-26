import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComposedCard } from '@/lib/investorBrief/types';

export type BriefMode = 'brief' | 'chat';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional list of AI tool ids invoked while producing this turn. */
  toolCalls?: string[];
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
  enterChatModeFromCard: (card: ComposedCard, severity?: ActiveCardContext['severity']) => void;
  enterChatModeFromQuery: (query: string) => void;
  exitChatMode: () => void;
  appendUserMessage: (text: string) => void;
  appendAssistantMessage: (text: string, toolCalls?: string[]) => void;
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
  >((query) => {
    setActiveCardContext(null);
    setActiveThreadKey(FREEFORM_KEY);
    setMode('chat');
    appendTurn(FREEFORM_KEY, {
      id: nextId(),
      role: 'user',
      content: query,
      createdAt: Date.now(),
    });
  }, [appendTurn]);

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

  const value = useMemo<InvestorBriefContextValue>(
    () => ({
      mode,
      activeCardContext,
      threads,
      activeThreadKey,
      currentThread: threads[activeThreadKey] ?? [],
      enterChatModeFromCard,
      enterChatModeFromQuery,
      exitChatMode,
      appendUserMessage,
      appendAssistantMessage,
    }),
    [
      mode,
      activeCardContext,
      threads,
      activeThreadKey,
      enterChatModeFromCard,
      enterChatModeFromQuery,
      exitChatMode,
      appendUserMessage,
      appendAssistantMessage,
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