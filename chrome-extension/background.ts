// HomeLens Chrome Extension — Background Service Worker (Manifest V3)

// ─────────────────────────────────────────────────────────────
// Per-tab conversation cache (in-memory only — not persisted).
//
// Service workers can be evicted; when that happens the cache is
// dropped and the next popup open starts a fresh conversation,
// which matches the spec ("in-memory per tab only").
// ─────────────────────────────────────────────────────────────
interface TabConvoState {
  url: string;
  messages: unknown[];
  scrollTop: number;
  draftInput: string;
  matchScore: number | null;
  updatedAt: number;
}

const tabConvos = new Map<number, TabConvoState>();

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
    if (tabId) tabConvos.delete(tabId);
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
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabConvos.delete(tabId);
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
