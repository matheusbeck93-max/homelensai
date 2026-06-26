import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function StaffRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) { setAllowed(false); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_staff")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) {
        setAllowed(Boolean(data?.is_staff));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse h-12 w-12 rounded-full bg-primary/20" />
      </div>
    );
  }
  if (!allowed) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}
