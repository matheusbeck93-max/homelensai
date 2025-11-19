import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Home, Menu, Sparkles, Calculator, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const featureItems = [
    { label: 'HomeLens Investor', path: '/investor', icon: Sparkles },
    { label: 'Calculator', path: '/calculators', icon: Calculator },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Home className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">HomeLens</span>
          </button>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {/^(\/($|home$|index$))/.test(location.pathname) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost">
                      <Menu className="h-5 w-5" />
                      <span className="ml-2">Features</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {featureItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className="cursor-pointer"
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              <ThemeToggle />
              
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
                    
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2 px-2">Features</p>
                      {featureItems.map((item) => {
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
      </div>
    </nav>
  );
}
