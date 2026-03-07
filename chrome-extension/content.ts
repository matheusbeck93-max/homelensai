import { detectPropertyListing, getPageUrl } from './utils/detectListing';

const BUTTON_ID = 'homelens-analyze-btn';
let lastUrl = '';
let recheckCount = 0;
const MAX_RECHECKS = 10;

function createFloatingButton(pageUrl: string): void {
  // Don't inject twice
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement('div');
  btn.id = BUTTON_ID;
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');

  // Inline styles to avoid conflicts with host page CSS
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    background: '#1E2D3D',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '12px 18px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 150ms, transform 350ms ease-out, opacity 350ms ease-out',
    transform: 'translateY(20px)',
    opacity: '0',
    lineHeight: '1',
  });

  // Icon SVG (magnifier)
  const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

  // AI badge
  const badge = document.createElement('span');
  Object.assign(badge.style, {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#2ECC71',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 5px',
    borderRadius: '6px',
    lineHeight: '1',
  });
  badge.textContent = 'AI';

  btn.innerHTML = icon + '<span>Analyze with HomeLens</span>';
  btn.style.position = 'fixed'; // re-ensure after innerHTML
  btn.appendChild(badge);

  // Hover
  btn.addEventListener('mouseenter', () => { btn.style.background = '#2C5F82'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#1E2D3D'; });

  // Click handler
  btn.addEventListener('click', () => {
    chrome.storage.local.set({ homelens_pending_url: pageUrl });
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }).catch(() => {
      // Fallback: open in new tab
      window.open(`https://homelens.ai/chats?url=${encodeURIComponent(pageUrl)}`, '_blank');
    });
  });

  document.body.appendChild(btn);

  // Entrance animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      btn.style.transform = 'translateY(0)';
      btn.style.opacity = '1';
    });
  });
}

function removeFloatingButton(): void {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) btn.remove();
}

function runDetection(): void {
  const result = detectPropertyListing();
  const pageUrl = getPageUrl();

  if (result.isListing) {
    chrome.storage.local.set({ homelens_pending_url: pageUrl });
    chrome.runtime.sendMessage({ type: 'LISTING_DETECTED', url: pageUrl }).catch(() => {});
    createFloatingButton(pageUrl);
    console.log(`[HomeLens] Listing detected (confidence: ${result.confidence}, signals: ${result.signals.join(', ')})`);
  }
}

// Wait for dynamic content (React/Next.js sites) then run detection
setTimeout(() => {
  lastUrl = window.location.href;
  runDetection();

  // SPA navigation observer
  const interval = setInterval(() => {
    if (recheckCount >= MAX_RECHECKS) {
      clearInterval(interval);
      return;
    }
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      recheckCount++;
      removeFloatingButton();
      setTimeout(runDetection, 1000);
    }
  }, 2000);
}, 1500);
