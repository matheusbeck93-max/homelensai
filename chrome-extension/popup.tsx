import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// ── Supabase config (public/anon keys — safe to include) ──
const SUPABASE_URL = 'https://yckcdxtatwolzilboahx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  access_token: string;
  email: string;
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

// ── House icon SVG ──
const HouseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

// ── Send icon SVG ──
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

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
          'apikey': SUPABASE_ANON_KEY,
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
      <div className="hl-login-subtitle">Sign in to your HomeLens account to access AI-powered real estate analysis.</div>

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
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Check for pending listing URL
  useEffect(() => {
    chrome.storage.local.get('homelens_pending_url', (result) => {
      if (result.homelens_pending_url) {
        setPendingUrl(result.homelens_pending_url);
      }
    });
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationMode: true,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setMessages((prev) => [...prev, { role: 'assistant', content: 'Session expired. Please sign out and sign in again.' }]);
          setLoading(false);
          return;
        }
        throw new Error(`Request failed (${res.status})`);
      }

      const data = await res.json();
      const assistantContent = data.response || data.message || 'Sorry, I couldn\'t process your request.';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}. Please try again.` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeNow = () => {
    if (!pendingUrl) return;
    chrome.storage.local.remove('homelens_pending_url');
    setBannerDismissed(true);
    sendMessage(`Please analyze this property: ${pendingUrl}`);
    setPendingUrl(null);
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    chrome.storage.local.remove('homelens_pending_url');
    setPendingUrl(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const getDomain = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  return (
    <>
      {/* Header */}
      <div className="hl-header">
        <div className="hl-header-left">
          <HouseIcon />
          <span className="hl-header-logo">HomeLens</span>
        </div>
        <button className="hl-header-btn" onClick={onLogout}>Sign out</button>
      </div>

      {/* Detected listing banner */}
      {pendingUrl && !bannerDismissed && (
        <div className="hl-banner">
          <span style={{ fontSize: '18px' }}>🏠</span>
          <div className="hl-banner-text">
            <div className="hl-banner-title">Property detected</div>
            <div className="hl-banner-url">{getDomain(pendingUrl)}</div>
          </div>
          <button className="hl-banner-analyze" onClick={handleAnalyzeNow}>Analyze now</button>
          <button className="hl-banner-close" onClick={handleDismissBanner}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="hl-messages">
        {messages.length === 0 && (
          <div className="hl-empty">
            <div className="hl-empty-icon">🏡</div>
            <p>
              Hi! I'm your HomeLens AI advisor. I can help you analyze any property,
              estimate costs, check market trends, and answer any real estate question.
              Paste a listing URL or ask me anything.
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
          placeholder="Ask anything about real estate..."
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
    chrome.storage.local.remove(['homelens_session', 'homelens_pending_url']);
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
