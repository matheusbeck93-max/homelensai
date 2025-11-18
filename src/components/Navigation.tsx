import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Home, Menu, Sparkles, Bookmark, User, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const allFeatureItems = [
    { label: 'HomeLens Investor', path: '/investor', icon: Sparkles },
    ...(user ? [
      { label: 'Saved Searches', path: '/saved-searches', icon: Bookmark },
      { label: 'Profile', path: '/profile', icon: User },
      { label: 'Settings', path: '/settings', icon: Settings },
    ] : []),
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

          {/* Navigation - All screens */}
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
                  {allFeatureItems.map((item) => {
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
        </div>
      </div>
    </nav>
  );
}
