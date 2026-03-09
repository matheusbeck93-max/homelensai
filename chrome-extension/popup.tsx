import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// ── Supabase config (public/anon keys — safe to include) ──
const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

// URL pattern to detect property listing links
const PROPERTY_URL_REGEX = /(https?:\/\/(?:www\.)?(zillow|realtor|redfin|trulia|homes|century21|coldwellbanker|compass|sothebysrealty|berkshirehathaway)\.com\/[^\s]+)/gi;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  access_token: string;
  email: string;
}

interface PropertyContext {
  externalUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  description?: string;
  imageUrl?: string;
  confidence?: number;
  sourceSignals?: string[];
}

// ── Simple markdown renderer ──
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />;
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!match) return undefined;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeUrlForCompare(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().replace(/\/$/, '').toLowerCase();
  }
}

function normalizePropertyContext(raw: any): PropertyContext | null {
  if (!raw || typeof raw !== 'object') return null;

  const normalized: PropertyContext = {
    externalUrl: typeof raw.externalUrl === 'string' ? raw.externalUrl : undefined,
    address: typeof raw.address === 'string' ? raw.address : undefined,
    city: typeof raw.city === 'string' ? raw.city : undefined,
    state: typeof raw.state === 'string' ? raw.state : undefined,
    zip: typeof raw.zip === 'string' ? raw.zip : undefined,
    price: toNumber(raw.price),
    beds: toNumber(raw.beds),
    baths: toNumber(raw.baths),
    sqft: toNumber(raw.sqft),
    lotSize: toNumber(raw.lotSize),
    yearBuilt: toNumber(raw.yearBuilt),
    propertyType: typeof raw.propertyType === 'string' ? raw.propertyType : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    confidence: toNumber(raw.confidence),
    sourceSignals: Array.isArray(raw.sourceSignals)
      ? raw.sourceSignals.filter((v: unknown): v is string => typeof v === 'string')
      : undefined,
  };

  const filledFields = [
    normalized.address,
    normalized.price,
    normalized.beds,
    normalized.baths,
    normalized.sqft,
    normalized.city,
    normalized.state,
  ].filter((v) => v !== undefined && v !== null).length;

  return filledFields >= 3 ? normalized : null;
}

function stripPropertyUrls(text: string): string {
  return text
    .replace(PROPERTY_URL_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── SVG Icons ──
const HouseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/**
 * Detects if text contains a property listing URL.
 */
function detectPropertyUrl(text: string): string | null {
  const match = text.match(PROPERTY_URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Fallback flow (URL parsing by backend) used when structured page data isn't available.
 */
function buildAnalysisMessages(
  url: string,
  purpose: 'investment' | 'residence',
  history: Message[],
): { role: string; content: string }[] {
  const purposeLabel = purpose === 'investment' ? 'investment' : 'primary residence';

  if (history.length >= 2) {
    return [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content: `Analyze this property for ${purposeLabel}: ${url}\n\nIMPORTANT: Keep the response SHORT and summarized — this is a browser extension with limited space. Use bullet points, no long paragraphs.`,
      },
    ];
  }

  return [
    { role: 'user', content: `I'd like to analyze a property for ${purposeLabel}.` },
    { role: 'assistant', content: `Sure! Share the listing URL and I'll analyze it for ${purposeLabel}.` },
    {
      role: 'user',
      content: `Analyze this property for ${purposeLabel}: ${url}\n\nIMPORTANT: Keep the response SHORT and summarized — this is a browser extension with limited space. Use bullet points, no long paragraphs.`,
    },
  ];
}

/**
 * Preferred flow: sends a URL-free prompt plus structured propertyData.
 */
function buildPropertyDataMessages(
  purpose: 'investment' | 'residence',
  history: Message[],
  userText?: string,
): { role: string; content: string }[] {
  const purposeLabel = purpose === 'investment' ? 'investment' : 'primary residence';
  const cleanedRequest = stripPropertyUrls(userText || '');

  const request = cleanedRequest
    ? `${cleanedRequest}`
    : `Analyze the selected property for ${purposeLabel}.`;

  return [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `${request}\n\nUse the selected property data already provided in context. Focus on ${purposeLabel}. Keep the answer SHORT, summarized, and in bullet points.`,
    },
  ];
}

/**
 * Wraps a general (non-URL) message with a concise instruction for the extension.
 */
function buildChatMessages(history: Message[], newText: string): { role: string; content: string }[] {
  const msgs = history.map((m) => ({ role: m.role, content: m.content }));
  msgs.push({
    role: 'user',
    content: `${newText}\n\n(Reply concisely — this is a browser extension popup with limited space. Use bullet points and short paragraphs.)`,
  });
  return msgs;
}

// ══════════════════════════════════════
// Login Screen
// ══════════════════════════════════════
function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error_description || data.msg || 'Invalid credentials');
      }

      const data = await res.json();
      const session: Session = { access_token: data.access_token, email };
      chrome.storage.local.set({ homelens_session: session });
      onLogin(session);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="hl-login" onSubmit={handleSubmit}>
      <HouseIcon />
      <div className="hl-login-title">HomeLens</div>
      <div className="hl-login-subtitle">
        Sign in to your HomeLens account to access AI-powered real estate analysis.
      </div>

      {error && <div className="hl-login-error">{error}</div>}

      <input
        className="hl-login-field"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <input
        className="hl-login-field"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button className="hl-login-btn" type="submit" disabled={loading || !email || !password}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="hl-login-links">
        <a className="hl-login-link" href="https://homelens.ai/auth" target="_blank" rel="noopener">
          Create account
        </a>
        <a className="hl-login-link" href="https://homelens.ai" target="_blank" rel="noopener">
          Open HomeLens
        </a>
      </div>
    </form>
  );
}

// ══════════════════════════════════════
// Chat Screen
// ══════════════════════════════════════
function ChatScreen({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingProperty, setPendingProperty] = useState<PropertyContext | null>(null);
  const [activeProperty, setActiveProperty] = useState<PropertyContext | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [purpose, setPurpose] = useState<'investment' | 'residence'>('investment');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    chrome.storage.local.get(['homelens_pending_url', 'homelens_pending_property'], (result) => {
      if (result.homelens_pending_url) {
        setPendingUrl(result.homelens_pending_url);
      }

      const normalized = normalizePropertyContext(result.homelens_pending_property);
      if (normalized) {
        setPendingProperty(normalized);
      }
    });
  }, []);

  const getStoredPropertyForUrl = async (url: string): Promise<PropertyContext | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(['homelens_pending_url', 'homelens_pending_property'], (result) => {
        const storedUrl = typeof result.homelens_pending_url === 'string' ? result.homelens_pending_url : '';
        const normalized = normalizePropertyContext(result.homelens_pending_property);

        if (
          normalized &&
          storedUrl &&
          normalizeUrlForCompare(storedUrl) === normalizeUrlForCompare(url)
        ) {
          resolve(normalized);
          return;
        }

        resolve(null);
      });
    });
  };

  const callAiChat = async (
    apiMessages: { role: string; content: string }[],
    selectedProperty?: PropertyContext | null,
  ) => {
    setLoading(true);

    const requestBody: Record<string, unknown> = {
      messages: apiMessages,
      conversationMode: true,
    };

    if (selectedProperty) {
      requestBody.propertyData = selectedProperty;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Session expired. Please sign out and sign in again.' },
          ]);
          return;
        }
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();

      if (data.needsPurpose) {
        const purposeAnswer = purpose === 'investment' ? 'Investment' : 'Primary residence';
        const retryMessages = [
          ...apiMessages,
          { role: 'assistant', content: data.response },
          { role: 'user', content: purposeAnswer },
        ];

        const retryBody: Record<string, unknown> = {
          messages: retryMessages,
          conversationMode: true,
        };

        if (selectedProperty) {
          retryBody.propertyData = selectedProperty;
        }

        const retryRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(retryBody),
        });

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const content = retryData.response || retryData.message || "Sorry, I couldn't process that.";
          setMessages((prev) => [...prev, { role: 'assistant', content }]);
        } else {
          throw new Error(`Retry failed (${retryRes.status})`);
        }
        return;
      }

      const assistantContent = data.response || data.message || "Sorry, I couldn't process your request.";
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}. Please try again.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    const detectedUrl = detectPropertyUrl(text);

    if (detectedUrl) {
      const structuredProperty = await getStoredPropertyForUrl(detectedUrl);

      if (structuredProperty) {
        setActiveProperty(structuredProperty);
        const apiMessages = buildPropertyDataMessages(purpose, messages, text);
        await callAiChat(apiMessages, structuredProperty);
        return;
      }

      setActiveProperty(null);
      const apiMessages = buildAnalysisMessages(detectedUrl, purpose, messages);
      await callAiChat(apiMessages);
      return;
    }

    const apiMessages = buildChatMessages(messages, text);
    await callAiChat(apiMessages, activeProperty);
  };

  const handleAnalyzeNow = () => {
    if (!pendingUrl) return;

    chrome.storage.local.remove(['homelens_pending_url', 'homelens_pending_property']);
    setBannerDismissed(true);

    const userMsg: Message = { role: 'user', content: `Analyze this property: ${pendingUrl}` };
    setMessages((prev) => [...prev, userMsg]);

    if (pendingProperty) {
      setActiveProperty(pendingProperty);
      const apiMessages = buildPropertyDataMessages(purpose, [], `Analyze this property for ${purpose}.`);
      setPendingUrl(null);
      setPendingProperty(null);
      callAiChat(apiMessages, pendingProperty);
      return;
    }

    const apiMessages = buildAnalysisMessages(pendingUrl, purpose, []);
    setPendingUrl(null);
    setPendingProperty(null);
    callAiChat(apiMessages);
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    chrome.storage.local.remove(['homelens_pending_url', 'homelens_pending_property']);
    setPendingUrl(null);
    setPendingProperty(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="hl-header">
        <div className="hl-header-left">
          <HouseIcon />
          <span className="hl-header-logo">HomeLens</span>
        </div>
        <button className="hl-header-btn" onClick={onLogout}>
          Sign out
        </button>
      </div>

      {/* Purpose toggle */}
      <div className="hl-purpose-bar">
        <span className="hl-purpose-label">Analysis mode:</span>
        <button
          className={`hl-purpose-btn ${purpose === 'investment' ? 'hl-purpose-active' : ''}`}
          onClick={() => setPurpose('investment')}
        >
          💰 Investment
        </button>
        <button
          className={`hl-purpose-btn ${purpose === 'residence' ? 'hl-purpose-active' : ''}`}
          onClick={() => setPurpose('residence')}
        >
          🏡 Residence
        </button>
      </div>

      {/* Detected listing banner */}
      {pendingUrl && !bannerDismissed && (
        <div className="hl-banner">
          <span style={{ fontSize: '18px' }}>🏠</span>
          <div className="hl-banner-text">
            <div className="hl-banner-title">Property detected</div>
            <div className="hl-banner-url">{getDomain(pendingUrl)}</div>
          </div>
          <button className="hl-banner-analyze" onClick={handleAnalyzeNow}>
            Analyze now
          </button>
          <button className="hl-banner-close" onClick={handleDismissBanner}>
            ✕
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="hl-messages">
        {messages.length === 0 && (
          <div className="hl-empty">
            <div className="hl-empty-icon">🏡</div>
            <p>
              Hi! I'm your HomeLens AI advisor. Paste a property listing URL or ask me anything
              about real estate. I'll read the listing data directly and give you a concise analysis.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`hl-msg hl-msg-${msg.role}`}>
            <div className={`hl-bubble hl-bubble-${msg.role}`}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="hl-loading">
            <div className="hl-dot" />
            <div className="hl-dot" />
            <div className="hl-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="hl-input-area">
        <textarea
          className="hl-input"
          placeholder="Paste a listing URL or ask anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
        />
        <button
          className="hl-send-btn"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
        >
          <SendIcon />
        </button>
      </div>
    </>
  );
}

// ══════════════════════════════════════
// App Root
// ══════════════════════════════════════
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    chrome.storage.local.get('homelens_session', (result) => {
      if (result.homelens_session?.access_token) {
        setSession(result.homelens_session);
      }
      setChecking(false);
    });
  }, []);

  const handleLogout = () => {
    chrome.storage.local.remove(['homelens_session', 'homelens_pending_url', 'homelens_pending_property']);
    setSession(null);
  };

  if (checking) return null;

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return <ChatScreen session={session} onLogout={handleLogout} />;
}

// Mount
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
