import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonFloatingBar } from "@/components/comparison/ComparisonFloatingBar";
import { BackToTop } from "@/components/BackToTop";
import { CookieConsent } from "@/components/CookieConsent";

// Eagerly loaded routes (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded routes (non-critical)
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const SavedSearches = lazy(() => import("./pages/SavedSearches"));
const Calculators = lazy(() => import("./pages/Calculators"));
const Investor = lazy(() => import("./pages/Investor"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Console = lazy(() => import("./pages/Console"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Compare = lazy(() => import("./pages/Compare"));
const Chats = lazy(() => import("./pages/Chats"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const AccessibilityPage = lazy(() => import("./pages/Accessibility"));
const FairHousing = lazy(() => import("./pages/FairHousing"));
const CCPANotice = lazy(() => import("./pages/CCPANotice"));
const DMCAPolicy = lazy(() => import("./pages/DMCAPolicy"));
const DoNotSell = lazy(() => import("./pages/DoNotSell"));

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
      <FavoritesProvider>
        <ComparisonProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/property/:id" element={<PropertyDetail />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/chat" element={<Navigate to="/chats" replace />} />
                  <Route path="/console" element={<Console />} />
                  <Route path="/saved-searches" element={<SavedSearches />} />
                  <Route path="/calculators" element={<Calculators />} />
                  <Route path="/investor" element={<Investor />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/profile-setup" element={<ProfileSetup />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/cookies" element={<CookiePolicy />} />
                  <Route path="/accessibility" element={<AccessibilityPage />} />
                  <Route path="/fair-housing" element={<FairHousing />} />
                  <Route path="/ccpa" element={<CCPANotice />} />
                  <Route path="/dmca" element={<DMCAPolicy />} />
                  <Route path="/do-not-sell" element={<DoNotSell />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <ComparisonFloatingBar />
              <BackToTop />
              <MobileBottomNav />
              <CookieConsent />
            </BrowserRouter>
          </TooltipProvider>
        </ComparisonProvider>
      </FavoritesProvider>
    </QueryClientProvider>
  );
}

export default App;
