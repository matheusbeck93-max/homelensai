import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubscriptionBadge } from "@/components/subscription/SubscriptionBadge";
import { useSubscription } from "@/hooks/useSubscription";
import { Home, Calculator, TrendingUp, Menu, Sparkles, LayoutDashboard, MessageSquare, UserPlus, BookOpen } from "lucide-react";
import { tierDisplayName } from "@/lib/subscriptionPlans";
import { InstallPrompt } from "@/components/InstallPrompt";
import { HeaderUsageIndicator } from "@/components/layout/HeaderUsageIndicator";
import { StreakIndicator } from "@/components/stickiness/StreakIndicator";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNav, PublicNavMobile } from "@/components/marketing/PublicNav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  // Collapse desktop nav into hamburger below `lg` (1024px) so tablets don't
  // get a cropped/overflowing toolbar.
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsCompact(window.innerWidth < 1024);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const isMobile = isCompact;
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tier, loading: subscriptionLoading, isFree } = useSubscription();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };
 
  const navItems = [
    { label: 'My HomeLens', path: '/console', icon: LayoutDashboard },
    { label: 'Chats', path: '/chats', icon: MessageSquare },
    { label: 'Calculators', path: '/calculators', icon: Calculator },
    { label: 'Investor', path: '/investor', icon: TrendingUp },
  ];

  // Show the public marketing menu (Features / Solutions / Pricing / FAQ) to
  // any logged-out visitor. Authenticated users always see the app nav.
  const showPublicNav = !user;
  const showAppNav = !showPublicNav;

  const handleGoHome = () => {
    
    if (location.pathname === '/') {
      // Already on homepage - force full page reload to reset conversation state
      window.location.href = '/';
    } else {
      navigate('/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 hover:opacity-80 hover:scale-105 transition-all duration-200 cursor-pointer group"
          aria-label="Return to homepage"
        >
          <Home className="h-6 w-6 text-primary group-hover:text-primary/80" />
          <span className="font-bold text-xl group-hover:text-primary">HomeLens</span>
        </button>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div className="flex items-center gap-6">
            {showPublicNav && <PublicNav />}
            {showAppNav && navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  onClick={() => {
                    
                    navigate(item.path);
                  }}
                  className={isActive ? "text-primary" : ""}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}

            <InstallPrompt />
            <ThemeToggle />
            {user && <HeaderUsageIndicator />}
            {user && <StreakIndicator />}

            {user && !subscriptionLoading && isFree && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/pricing')}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade
              </Button>
            )}

            {user && !subscriptionLoading && !isFree && (
              <div className="flex items-center gap-2">
                <SubscriptionBadge tier={tier} />
              </div>
            )}
            
            {user ? (
              <Button variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
                <Button onClick={() => navigate('/auth?mode=signup')} className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Button>
              </>
            )}
          </div>
        )}

          {/* Mobile Hamburger Menu */}
          {isMobile && (
            <div className="flex items-center gap-2">
              <InstallPrompt />
              <ThemeToggle />
              {user && <HeaderUsageIndicator />}
              {user && <StreakIndicator />}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 mt-6">
                    <div className="space-y-1">
                      {showPublicNav && (
                        <PublicNavMobile onNavigate={() => setMobileOpen(false)} />
                      )}
                      {showAppNav && navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Button
                            key={item.path}
                            variant="ghost"
                            className="justify-start w-full"
                            onClick={() => {
                              navigate(item.path);
                              setMobileOpen(false);
                            }}
                          >
                            <Icon className="h-4 w-4 mr-2" />
                            {item.label}
                          </Button>
                        );
                      })}
                    </div>


                    <div className="border-t pt-4">
                      {user ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            handleLogout();
                            setMobileOpen(false);
                          }}
                        >
                          Sign Out
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              navigate('/auth');
                              setMobileOpen(false);
                            }}
                          >
                            Sign In
                          </Button>
                          <Button
                            className="w-full gap-1.5"
                            onClick={() => {
                              navigate('/auth?mode=signup');
                              setMobileOpen(false);
                            }}
                          >
                            <UserPlus className="h-4 w-4" />
                            Sign Up
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
      </div>
    </nav>
  );
}
