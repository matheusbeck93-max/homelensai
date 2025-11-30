import { Home, Calculator, TrendingUp, Heart } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Calculator, label: "Calculators", path: "/calculators" },
    { icon: TrendingUp, label: "Investor", path: "/investor" },
    { icon: Heart, label: "Favorites", path: "/favorites" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t pb-safe">
      <div className="flex items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                console.log(`MobileBottomNav: ${item.label} clicked, navigating to ${item.path}`);
                if (item.path === "/") {
                  navigate("/", { replace: true });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  navigate(item.path);
                }
              }}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
