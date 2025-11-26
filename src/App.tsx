import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ComparisonProvider } from "@/contexts/ComparisonContext";
import { ComparisonFloatingBar } from "@/components/comparison/ComparisonFloatingBar";
import { BackToTop } from "@/components/BackToTop";
import Index from "./pages/Index";
import PropertyDetail from "./pages/PropertyDetail";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import SavedSearches from "./pages/SavedSearches";
import Calculators from "./pages/Calculators";
import Investor from "./pages/Investor";
import Favorites from "./pages/Favorites";
import Pricing from "./pages/Pricing";
import Portfolio from "./pages/Portfolio";
import Console from "./pages/Console";
import Compare from "./pages/Compare";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FavoritesProvider>
        <ComparisonProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/property/:id" element={<PropertyDetail />} />
                <Route path="/chat" element={<Navigate to="/" replace />} />
                <Route path="/console" element={<Console />} />
                <Route path="/saved-searches" element={<SavedSearches />} />
                <Route path="/calculators" element={<Calculators />} />
                <Route path="/investor" element={<Investor />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ComparisonFloatingBar />
              <BackToTop />
              <MobileBottomNav />
            </BrowserRouter>
          </TooltipProvider>
        </ComparisonProvider>
      </FavoritesProvider>
    </QueryClientProvider>
  );
}

export default App;
