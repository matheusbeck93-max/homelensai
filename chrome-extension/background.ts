// HomeLens Chrome Extension — Background Service Worker (Manifest V3)

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

  return true; // keep message channel open for async
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
