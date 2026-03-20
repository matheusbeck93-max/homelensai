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
  user_id?: string;
}

interface UserProfile {
  full_name?: string;
  buyer_type?: string;
  budget_min?: number;
  budget_max?: number;
  primary_goal?: string;
  investment_strategy?: string;
  financing_preference?: string;
  has_children?: boolean;
  children_ages?: string[];
  climate_preference?: string;
  safety_priority?: string;
  risk_level?: string;
  property_types?: string[];
  must_have_features?: string[];
  onboarding_completed?: boolean;
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

// ── Enhanced markdown renderer ──
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} style={{ margin: '4px 0', paddingLeft: '16px' }}>
          {currentList.map((item, i) => <li key={i} style={{ marginBottom: '2px' }}>{item}</li>)}
        </ListTag>
      );
      currentList = [];
      listType = null;
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return <span key={i}>{part}</span>;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={`h-${i}`} style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '8px', marginBottom: '4px' }}>{renderInline(trimmed.slice(3))}</h3>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={`h-${i}`} style={{ fontWeight: 'bold', fontSize: '16px', marginTop: '8px', marginBottom: '4px' }}>{renderInline(trimmed.slice(2))}</h2>);
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      currentList.push(renderInline(trimmed.slice(2)));
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      currentList.push(renderInline(numMatch[2]));
      continue;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={`p-${i}`} style={{ margin: '2px 0' }}>{renderInline(trimmed)}</p>);
  }

  flushList();
  return <>{elements}</>;
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

// ── Match Score parser ──
function parseMatchScore(content: string): { score: number | null; cleanContent: string } {
  const match = content.match(/^MATCH_SCORE:\s*([\d.]+)\/10\s*\n?/i);
  if (match) {
    const score = parseFloat(match[1]);
    const cleanContent = content.slice(match[0].length).trim();
    return { score: Number.isFinite(score) ? score : null, cleanContent };
  }
  return { score: null, cleanContent: content };
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e';  // green
  if (score >= 5) return '#eab308';  // yellow
  return '#ef4444';  // red
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent Match';
  if (score >= 6) return 'Good Match';
  if (score >= 4) return 'Fair Match';
  return 'Poor Match';
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

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

function ShareMenu({ content, onClose }: { content: string; onClose: () => void }) {
  const shareText = `🏡 HomeLens AI Analysis:\n\n${content}\n\nAnalyzed with HomeLens — homelens.ai`;
  const encoded = encodeURIComponent(shareText);

  const options = [
    { label: '📋 Copy', action: () => { navigator.clipboard.writeText(shareText); onClose(); } },
    { label: '💬 WhatsApp', action: () => { window.open(`https://wa.me/?text=${encoded}`, '_blank'); onClose(); } },
    { label: '📱 SMS', action: () => { window.open(`sms:?body=${encoded}`, '_blank'); onClose(); } },
    { label: '𝕏 Twitter/X', action: () => { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.substring(0, 280))}`, '_blank'); onClose(); } },
    { label: '📘 Facebook', action: () => { window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, '_blank'); onClose(); } },
    { label: '✉️ Email', action: () => { window.open(`mailto:?subject=${encodeURIComponent('HomeLens AI Analysis')}&body=${encoded}`, '_blank'); onClose(); } },
  ];

  return (
    <div className="hl-share-menu">
      {options.map((opt) => (
        <button key={opt.label} className="hl-share-option" onClick={opt.action}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function detectPropertyUrl(text: string): string | null {
  const match = text.match(PROPERTY_URL_REGEX);
  return match ? match[0] : null;
}

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

function buildChatMessages(history: Message[], newText: string): { role: string; content: string }[] {
  const msgs = history.map((m) => ({ role: m.role, content: m.content }));
  msgs.push({
    role: 'user',
    content: `${newText}\n\n(Reply concisely — this is a browser extension popup with limited space. Use bullet points and short paragraphs.)`,
  });
  return msgs;
}

// ══════════════════════════════════════
// Match Score Badge Component
// ══════════════════════════════════════
function MatchScoreBadge({ score }: { score: number }) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const circumference = 2 * Math.PI * 22;
  const progress = (score / 10) * circumference;

  return (
    <div className="hl-match-score">
      <div className="hl-match-score-circle" style={{ position: 'relative', width: '56px', height: '56px' }}>
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: '14px', color,
        }}>
          {score}
        </div>
      </div>
      <div className="hl-match-score-info">
        <div style={{ fontWeight: 'bold', fontSize: '13px', color }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Match Score out of 10</div>
      </div>
    </div>
  );
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
      const session: Session = { access_token: data.access_token, email, user_id: data.user?.id };
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
// Message Bubble with Share
// ══════════════════════════════════════
function MessageBubble({ msg }: { msg: Message }) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className={`hl-msg hl-msg-${msg.role}`} style={{ position: 'relative' }}>
      <div className={`hl-bubble hl-bubble-${msg.role}`}>
        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
      </div>
      {msg.role === 'assistant' && (
        <div style={{ position: 'relative' }}>
          <button
            className="hl-share-btn"
            onClick={() => setShareOpen(!shareOpen)}
            title="Share this analysis"
          >
            <ShareIcon />
          </button>
          {shareOpen && <ShareMenu content={msg.content} onClose={() => setShareOpen(false)} />}
        </div>
      )}
    </div>
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Fetch user profile on mount
  useEffect(() => {
    fetchUserProfile();
    loadLastConversation();
  }, []);

  const fetchUserProfile = async () => {
    if (!session.user_id) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user_id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setUserProfile(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const loadLastConversation = async () => {
    if (!session.user_id) return;
    try {
      // Get the most recent conversation
      const convRes = await fetch(
        `${SUPABASE_URL}/rest/v1/conversations?user_id=eq.${session.user_id}&order=updated_at.desc&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (!convRes.ok) return;
      const conversations = await convRes.json();
      if (!conversations || conversations.length === 0) return;

      const conv = conversations[0];
      setConversationId(conv.id);

      // Load messages for this conversation
      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conv.id}&order=created_at.asc&limit=50`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      if (msgRes.ok) {
        const msgs = await msgRes.json();
        if (msgs && msgs.length > 0) {
          setMessages(msgs.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        }
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const persistMessage = async (role: string, content: string) => {
    if (!session.user_id) return;
    try {
      let convId = conversationId;
      if (!convId) {
        // Create a new conversation
        const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ user_id: session.user_id, title: 'Extension Chat' }),
        });
        if (res.ok) {
          const data = await res.json();
          convId = data[0]?.id;
          setConversationId(convId!);
        }
      }
      if (!convId) return;

      await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversation_id: convId, role, content }),
      });
    } catch (err) {
      console.error('Failed to persist message:', err);
    }
  };

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

  // Use perplexity-chat for general queries (matching main system behavior)
  const callPerplexityChat = async (query: string, history: Message[]) => {
    setLoading(true);
    setMatchScore(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/perplexity-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query,
          conversationHistory: history.map((m) => ({ role: m.role, content: m.content })),
          userGoal: userProfile?.primary_goal || null,
        }),
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
      const rawMessage = data?.message || 'I could not process that request.';
      const { score, cleanContent } = parseMatchScore(rawMessage);
      if (score !== null) setMatchScore(score);
      setMessages((prev) => [...prev, { role: 'assistant', content: cleanContent }]);
      persistMessage('assistant', cleanContent);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}. Please try again.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Use ai-chat for property URL analysis (with propertyData context)
  const callAiChat = async (
    apiMessages: { role: string; content: string }[],
    selectedProperty?: PropertyContext | null,
  ) => {
    setLoading(true);
    setMatchScore(null);

    const requestBody: Record<string, unknown> = {
      messages: apiMessages,
      conversationMode: true,
      extensionMode: true,
    };

    if (selectedProperty) {
      requestBody.propertyData = selectedProperty;
    }

    // Include user profile for personalized analysis
    if (userProfile && userProfile.onboarding_completed) {
      requestBody.userProfile = userProfile;
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
          extensionMode: true,
        };

        if (selectedProperty) {
          retryBody.propertyData = selectedProperty;
        }
        if (userProfile && userProfile.onboarding_completed) {
          retryBody.userProfile = userProfile;
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
          const rawContent = extractMessageContent(retryData);
          const { score, cleanContent } = parseMatchScore(rawContent);
          if (score !== null) setMatchScore(score);
          setMessages((prev) => [...prev, { role: 'assistant', content: cleanContent }]);
          persistMessage('assistant', cleanContent);
        } else {
          throw new Error(`Retry failed (${retryRes.status})`);
        }
        return;
      }

      const rawContent = extractMessageContent(data);
      const { score, cleanContent } = parseMatchScore(rawContent);
      if (score !== null) setMatchScore(score);
      setMessages((prev) => [...prev, { role: 'assistant', content: cleanContent }]);
      persistMessage('assistant', cleanContent);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}. Please try again.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Extract readable message content from various response formats:
   * - { response: "plain text" } (URL analysis path)
   * - { response: { message: "text" } } (regular chat path, parsed JSON)
   * - { response: "{\"message\": \"text\"}" } (regular chat path, stringified JSON)
   * - { message: "text" } (fallback)
   */
  function extractMessageContent(data: any): string {
    const resp = data.response;
    
    if (!resp) {
      return data.message || "Sorry, I couldn't process your request.";
    }

    // If response is a string
    if (typeof resp === 'string') {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(resp);
        if (parsed.message) return parsed.message;
        return resp;
      } catch {
        // It's plain text
        return resp;
      }
    }

    // If response is an object
    if (typeof resp === 'object') {
      if (resp.message) return resp.message;
      return JSON.stringify(resp);
    }

    return String(resp);
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    persistMessage('user', text);

    const detectedUrl = detectPropertyUrl(text);

    if (detectedUrl) {
      const structuredProperty = await getStoredPropertyForUrl(detectedUrl);

      if (structuredProperty) {
        setActiveProperty(structuredProperty);
        // Keep URL in message so edge function detects it AND uses propertyData
        const apiMessages = buildAnalysisMessages(detectedUrl, purpose, messages);
        await callAiChat(apiMessages, structuredProperty);
        return;
      }

      setActiveProperty(null);
      const apiMessages = buildAnalysisMessages(detectedUrl, purpose, messages);
      await callAiChat(apiMessages);
      return;
    }

    // Regular chat message - also try to get fresh property data from active tab
    let propertyForChat = activeProperty;
    if (!propertyForChat && !detectedUrl) {
      // Check if content script has property data for current tab
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_ACTIVE_PROPERTY_CONTEXT' });
          if (response?.ok && response.propertyData) {
            const normalized = normalizePropertyContext(response.propertyData);
            if (normalized) {
              propertyForChat = normalized;
              setActiveProperty(normalized);
            }
          }
        }
      } catch {
        // Content script not available, continue without property context
      }
    }

    const apiMessages = buildChatMessages(messages, text);
    await callAiChat(apiMessages, propertyForChat);
  };

  const handleAnalyzeNow = () => {
    if (!pendingUrl) return;

    chrome.storage.local.remove(['homelens_pending_url', 'homelens_pending_property']);
    setBannerDismissed(true);

    const purposeLabel = purpose === 'investment' ? 'investment' : 'primary residence';
    const userMsg: Message = { role: 'user', content: `Analyze this property for ${purposeLabel}: ${pendingUrl}` };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage('user', userMsg.content);

    if (pendingProperty) {
      setActiveProperty(pendingProperty);
      // Include the URL in the message so the edge function can detect it AND use propertyData
      const apiMessages = buildAnalysisMessages(pendingUrl, purpose, []);
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

  const handleNewChat = () => {
    setMessages([]);
    setMatchScore(null);
    setConversationId(null);
    setActiveProperty(null);
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

  const firstName = userProfile?.full_name?.split(' ')[0];

  return (
    <>
      {/* Header */}
      <div className="hl-header">
        <div className="hl-header-left">
          <HouseIcon />
          <span className="hl-header-logo">HomeLens</span>
          {firstName && <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>· {firstName}</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="hl-header-btn" onClick={handleNewChat} title="New chat">
            +
          </button>
          <button className="hl-header-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
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

      {/* Profile prompt if not completed */}
      {userProfile && !userProfile.onboarding_completed && (
        <div style={{ padding: '8px 12px', background: '#1a2332', borderBottom: '1px solid #2a3a4e', fontSize: '11px', color: '#9ca3af' }}>
          <a href="https://homelens.ai/profile" target="_blank" rel="noopener" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
            Complete your profile
          </a> on HomeLens for a personalized match score.
        </div>
      )}

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

      {/* Match Score */}
      {matchScore !== null && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a3a4e' }}>
          <MatchScoreBadge score={matchScore} />
        </div>
      )}

      {/* Messages */}
      <div className="hl-messages">
        {messages.length === 0 && (
          <div className="hl-empty">
            <div className="hl-empty-icon">🏡</div>
            <p>
              {firstName ? `Hi ${firstName}! ` : 'Hi! '}I'm your HomeLens AI advisor. Paste a property listing URL or ask me anything
              about real estate. I'll read the listing data directly and give you a concise analysis.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
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
