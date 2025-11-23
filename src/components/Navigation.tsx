import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubscriptionBadge } from "@/components/subscription/SubscriptionBadge";
import { useSubscription } from "@/hooks/useSubscription";
import { Home, Calculator, TrendingUp, Menu, Heart, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { tier, loading: subscriptionLoading } = useSubscription();

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
    { label: 'Home', path: '/', icon: Home },
    { label: 'Calculators', path: '/calculators', icon: Calculator },
    { label: 'Investor', path: '/investor', icon: TrendingUp },
    { label: 'Favorites', path: '/favorites', icon: Heart },
  ];
 
  const handleGoHome = () => {
    console.log('Navigating to homepage');
    navigate('/', { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Home className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">HomeLens</span>
        </button>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isHome = item.path === '/';
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  onClick={() => {
                    console.log(`Navigation: ${item.label} clicked, navigating to ${item.path}`);
                    if (isHome) {
                      handleGoHome();
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className={isActive ? "text-primary" : ""}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
            
            <ThemeToggle />
            
            <ThemeToggle />
            
            {user && !subscriptionLoading && tier === 'free' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/pricing')}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Button>
            )}

            {user && !subscriptionLoading && (tier === 'pro' || tier === 'premium') && (
              <div className="flex items-center gap-2">
                <SubscriptionBadge tier={tier} />
              </div>
            )}
            
            {user ? (
              <Button variant="outline" onClick={handleLogout}>
                Sign Out
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
          </div>
        )}

          {/* Mobile Hamburger Menu */}
          {isMobile && (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 mt-6">
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        navigate('/');
                        setMobileOpen(false);
                      }}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Home
                    </Button>
                    
                    <div className="space-y-1">
                      {navItems.slice(1).map((item) => {
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

                    {user && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium mb-2 px-2">Account</p>
                        <Button
                          variant="ghost"
                          className="justify-start w-full"
                          onClick={() => {
                            navigate('/profile');
                            setMobileOpen(false);
                          }}
                        >
                          Profile
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start w-full"
                          onClick={() => {
                            navigate('/settings');
                            setMobileOpen(false);
                          }}
                        >
                          Settings
                        </Button>
                      </div>
                    )}

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
                        <Button
                          className="w-full"
                          onClick={() => {
                            navigate('/auth');
                            setMobileOpen(false);
                          }}
                        >
                          Sign In
                        </Button>
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
