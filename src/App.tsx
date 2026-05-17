import { lazy, Suspense, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonFloatingBar } from "@/components/comparison/ComparisonFloatingBar";
import { BackToTop } from "@/components/BackToTop";
import { CookieConsent } from "@/components/CookieConsent";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Eagerly loaded routes (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Wrap dynamic imports so a stale chunk reference (after a new deploy) auto-recovers
// by forcing one fresh reload instead of crashing the ErrorBoundary.
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const RELOAD_KEY = "homelens:chunk-reload";
    const isChunkError = (err: any) => {
      const msg = String(err?.message || err);
      return (
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk \d+ failed/i.test(msg) ||
        /dynamically imported module/i.test(msg)
      );
    };

    // Try up to 3 times with small backoff to absorb transient network blips
    // (mobile flakiness, brief CDN propagation gaps, etc.) BEFORE we resort
    // to a hard page reload.
    let lastErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastErr = err;
        if (!isChunkError(err)) throw err;
        // small exponential backoff: 200ms, 600ms
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt)));
        }
      }
    }

    // All in-tab retries failed → likely a stale bundle after a deploy.
    // Force exactly one full page reload to grab the new index.html + chunks.
    if (typeof window !== "undefined") {
      const already = sessionStorage.getItem(RELOAD_KEY);
      if (!already) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        // Hold Suspense until the reload kicks in.
        return new Promise(() => {}) as any;
      }
    }
    throw lastErr;
  });
}

// Lazy loaded routes (non-critical)
const PropertyDetail = lazyWithRetry(() => import("./pages/PropertyDetail"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const SavedSearches = lazyWithRetry(() => import("./pages/SavedSearches"));
const SavedAnalyses = lazyWithRetry(() => import("./pages/SavedAnalyses"));
const Calculators = lazyWithRetry(() => import("./pages/Calculators"));
const Investor = lazyWithRetry(() => import("./pages/Investor"));

const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const Portfolio = lazyWithRetry(() => import("./pages/Portfolio"));
const Console = lazyWithRetry(() => import("./pages/Console"));
const ProfileSetup = lazyWithRetry(() => import("./pages/ProfileSetup"));
const Compare = lazyWithRetry(() => import("./pages/Compare"));
const Chats = lazyWithRetry(() => import("./pages/Chats"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const ExtensionPrivacy = lazyWithRetry(() => import("./pages/ExtensionPrivacy"));
const CookiePolicy = lazyWithRetry(() => import("./pages/CookiePolicy"));
const AccessibilityPage = lazyWithRetry(() => import("./pages/Accessibility"));
const FairHousing = lazyWithRetry(() => import("./pages/FairHousing"));
const CCPANotice = lazyWithRetry(() => import("./pages/CCPANotice"));
const DMCAPolicy = lazyWithRetry(() => import("./pages/DMCAPolicy"));
const DoNotSell = lazyWithRetry(() => import("./pages/DoNotSell"));
const AdminTelemetry = lazyWithRetry(() => import("./pages/AdminTelemetry"));

const queryClient = new QueryClient();

// Loading fallback for lazy routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-primary/20" />
      <div className="h-4 w-32 rounded bg-muted" />
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ComparisonProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <main>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/property/:id" element={<PropertyDetail />} />
                  <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
                  <Route path="/chat" element={<Navigate to="/chats" replace />} />
                  <Route path="/console" element={<ProtectedRoute><Console /></ProtectedRoute>} />
                  <Route path="/saved-searches" element={<ProtectedRoute><SavedSearches /></ProtectedRoute>} />
                  <Route path="/saved-analyses" element={<ProtectedRoute><SavedAnalyses /></ProtectedRoute>} />
                  <Route path="/calculators" element={<Calculators />} />
                  <Route path="/investor" element={<Investor />} />
                  
                  <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/extension-privacy" element={<ExtensionPrivacy />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="/accessibility" element={<AccessibilityPage />} />
                  <Route path="/fair-housing" element={<FairHousing />} />
                  <Route path="/ccpa" element={<CCPANotice />} />
                  <Route path="/dmca" element={<DMCAPolicy />} />
                  <Route path="/do-not-sell" element={<DoNotSell />} />
                  <Route path="/admin/telemetry" element={<AdminTelemetry />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </main>
              </Suspense>
              <ComparisonFloatingBar />
              <BackToTop />
              
              <CookieConsent />
            </BrowserRouter>
          </TooltipProvider>
        </ComparisonProvider>
    </QueryClientProvider>
  );
}

export default App;
