// HomeLens Chrome Extension — Background Service Worker (Manifest V3)

const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

// ─────────────────────────────────────────────────────────────
// Per-tab conversation cache (in-memory only — not persisted).
//
// Service workers can be evicted; when that happens the cache is
// dropped and the next popup open starts a fresh conversation,
// which matches the spec ("in-memory per tab only").
// ─────────────────────────────────────────────────────────────
interface ExtMessage {
  role: 'user' | 'assistant';
  content: string;
  upgradeCta?: boolean;
  budgetCap?: { resetAt?: string; tier?: string };
}

interface TabConvoState {
  url: string;
  messages: ExtMessage[];
  scrollTop: number;
  draftInput: string;
  matchScore: number | null;
  updatedAt: number;
}

const tabConvos = new Map<number, TabConvoState>();

// ─────────────────────────────────────────────────────────────
// Per-tab in-flight AI request store. Lets the AI fetch survive
// popup close: the popup hands off the request to the service
// worker, which appends the assistant message to `tabConvos`
// when it resolves. Reopening the popup pulls the fresh state.
// ─────────────────────────────────────────────────────────────
type PendingStatus = 'pending' | 'done' | 'error';

interface PendingRequest {
  id: string;
  tabId: number;
  url: string;
  endpoint: 'ai-chat' | 'perplexity-chat';
  startedAt: number;
  status: PendingStatus;
}

const pendingByTab = new Map<number, PendingRequest>();

function getOrCreateConvo(tabId: number, url: string): TabConvoState {
  const existing = tabConvos.get(tabId);
  if (existing && existing.url === url) return existing;
  const fresh: TabConvoState = {
    url,
    messages: [],
    scrollTop: 0,
    draftInput: '',
    matchScore: null,
    updatedAt: Date.now(),
  };
  tabConvos.set(tabId, fresh);
  return fresh;
}

function parseMatchScore(content: string): { score: number | null; cleanContent: string } {
  const m = content.match(/^MATCH_SCORE:\s*([\d.]+)\/10\s*\n?/i);
  if (m) {
    const score = parseFloat(m[1]);
    return {
      score: Number.isFinite(score) ? score : null,
      cleanContent: content.slice(m[0].length).trim(),
    };
  }
  return { score: null, cleanContent: content };
}

function extractMessageContent(data: any): string {
  // Mirrors popup.tsx extractMessageContent for ai-chat shape.
  const resp = data?.response;
  if (!resp) return data?.message || "Sorry, I couldn't process your request.";
  if (typeof resp === 'string') {
    try {
      const parsed = JSON.parse(resp);
      if (parsed?.message) return parsed.message;
      return resp;
    } catch {
      return resp;
    }
  }
  if (typeof resp === 'object') {
    if (resp.message) return resp.message;
    return JSON.stringify(resp);
  }
  return String(resp);
}

async function runAiRequest(
  pending: PendingRequest,
  authHeader: string,
  body: unknown,
): Promise<void> {
  const endpointUrl = `${SUPABASE_URL}/functions/v1/${pending.endpoint}`;
  let assistantMsg: ExtMessage;
  let matchScore: number | null = null;

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401) {
        assistantMsg = {
          role: 'assistant',
          content: 'Please sign in to HomeLens to use the assistant.',
        };
      } else if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        if (data?.limitReached) {
          assistantMsg = {
            role: 'assistant',
            content:
              "You've reached your daily limit for this feature. Upgrade to Premium for unlimited access.",
            upgradeCta: true,
          };
        } else {
          assistantMsg = {
            role: 'assistant',
            content: `Error: Request failed (429). Please try again.`,
          };
        }
      } else if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'budget_exceeded') {
          assistantMsg = {
            role: 'assistant',
            content:
              "You've used today's HomeLens AI credits. They reset at midnight UTC — or upgrade for more.",
            budgetCap: { resetAt: data.reset_at, tier: data.tier },
          };
        } else {
          assistantMsg = {
            role: 'assistant',
            content: `Error: Request failed (402). Please try again.`,
          };
        }
      } else {
        assistantMsg = {
          role: 'assistant',
          content: `Error: Request failed (${res.status}). Please try again.`,
        };
      }
    } else {
      const data = await res.json();
      const rawContent =
        pending.endpoint === 'ai-chat'
          ? extractMessageContent(data)
          : data?.message || 'I could not process that request.';
      const parsed = parseMatchScore(rawContent);
      matchScore = parsed.score;
      assistantMsg = { role: 'assistant', content: parsed.cleanContent };
    }
  } catch (err: any) {
    assistantMsg = {
      role: 'assistant',
      content: `Error: ${err?.message || 'Network error'}. Please try again.`,
    };
  }

  // Append assistant message to the tab's convo cache if it still
  // matches the URL the request was started on. URL drift is treated
  // as user abandonment and the result is discarded.
  const convo = tabConvos.get(pending.tabId);
  if (convo && convo.url === pending.url) {
    convo.messages = [...convo.messages, assistantMsg];
    if (matchScore !== null) convo.matchScore = matchScore;
    convo.updatedAt = Date.now();
  }

  pending.status = 'done';

  // Notify any open popup. Catch errors — popup may not be open.
  chrome.runtime
    .sendMessage({
      type: 'AI_REQUEST_COMPLETE',
      tabId: pending.tabId,
      requestId: pending.id,
    })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    homelens_meta: { version: '1.0.0', installedAt: Date.now() },
  });
  console.log('[HomeLens] Extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LISTING_DETECTED') {
    // Save detected URL and show badge
    chrome.storage.local.set({ homelens_pending_url: message.url });
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#2ECC71' });
    sendResponse({ ok: true });
  }

  if (message.type === 'OPEN_POPUP') {
    // chrome.action.openPopup() only works with user gesture in Chrome 127+
    try {
      (chrome.action as any).openPopup?.();
    } catch (_) {
      // Fallback handled by content script
    }
    sendResponse({ ok: true });
  }

  // ── Per-tab conversation cache ──
  if (message?.type === 'GET_TAB_CONVO') {
    const tabId = Number(message.tabId);
    const url = String(message.url || '');
    const cached = tabConvos.get(tabId);
    if (cached && cached.url === url) {
      sendResponse({ ok: true, state: cached });
    } else {
      // URL drift — drop stale entry and report no state
      if (cached) tabConvos.delete(tabId);
      sendResponse({ ok: true, state: null });
    }
    return true;
  }

  if (message?.type === 'SET_TAB_CONVO') {
    const tabId = Number(message.tabId);
    const state = message.state as TabConvoState;
    if (tabId && state && typeof state.url === 'string') {
      tabConvos.set(tabId, { ...state, updatedAt: Date.now() });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'CLEAR_TAB_CONVO') {
    const tabId = Number(message.tabId);
    if (tabId) {
      tabConvos.delete(tabId);
      pendingByTab.delete(tabId);
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── In-flight AI request handoff ──
  if (message?.type === 'START_AI_REQUEST') {
    const tabId = Number(message.tabId);
    const url = String(message.url || '');
    const endpoint =
      message.endpoint === 'perplexity-chat' ? 'perplexity-chat' : 'ai-chat';
    const authHeader = String(message.authHeader || '');
    const snapshot = Array.isArray(message.messagesSnapshot)
      ? (message.messagesSnapshot as ExtMessage[])
      : null;
    const body = message.body;

    if (!tabId || !url || !authHeader || !body) {
      sendResponse({ ok: false, error: 'invalid_request' });
      return true;
    }

    // Sync the conversation snapshot from the popup (it already
    // appended the user message locally) so the cache is current
    // before we kick off the fetch. This avoids a race with the
    // popup's debounced SET_TAB_CONVO when the popup closes fast.
    const convo = getOrCreateConvo(tabId, url);
    if (snapshot) {
      convo.messages = snapshot;
      convo.updatedAt = Date.now();
    }

    const requestId =
      (globalThis.crypto?.randomUUID?.() as string | undefined) ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pending: PendingRequest = {
      id: requestId,
      tabId,
      url,
      endpoint,
      startedAt: Date.now(),
      status: 'pending',
    };
    pendingByTab.set(tabId, pending);

    // Fire-and-forget. Service worker stays alive as long as
    // the fetch is in flight.
    runAiRequest(pending, authHeader, body);

    sendResponse({ ok: true, requestId });
    return true;
  }

  if (message?.type === 'GET_PENDING_REQUEST') {
    const tabId = Number(message.tabId);
    const pending = pendingByTab.get(tabId) || null;
    sendResponse({ ok: true, pending });
    return true;
  }

  if (message?.type === 'CLEAR_PENDING_REQUEST') {
    const tabId = Number(message.tabId);
    const requestId = message.requestId as string | undefined;
    const current = pendingByTab.get(tabId);
    if (current && (!requestId || current.id === requestId)) {
      pendingByTab.delete(tabId);
    }
    sendResponse({ ok: true });
    return true;
  }

  return true; // keep message channel open for async
});

// Clear conversation when the user navigates to a different URL on the
// active tab. We only react when the `url` field changes, not on every
// status update (which fires multiple times per navigation).
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    const cached = tabConvos.get(tabId);
    if (cached && cached.url !== changeInfo.url) {
      tabConvos.delete(tabId);
    }
    const pending = pendingByTab.get(tabId);
    if (pending && pending.url !== changeInfo.url) {
      pendingByTab.delete(tabId);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabConvos.delete(tabId);
  pendingByTab.delete(tabId);
});

// Clear badge when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.action.setBadgeText({ text: '' });

  // Check if this tab has a pending listing
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const { homelens_pending_url } = await chrome.storage.local.get('homelens_pending_url');
      if (homelens_pending_url && tab.url === homelens_pending_url) {
        chrome.action.setBadgeText({ text: '1' });
        chrome.action.setBadgeBackgroundColor({ color: '#2ECC71' });
      }
    }
  } catch (_) {}
});
