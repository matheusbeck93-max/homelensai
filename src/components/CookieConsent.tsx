import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "homelens_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-2xl rounded-xl border bg-background/95 backdrop-blur-md shadow-lg p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              We use cookies to enhance your experience. By continuing to use Homelens.ai, you agree to our{" "}
              <Link to="/cookies" className="underline text-primary hover:text-primary/80 font-medium">
                Cookie Policy
              </Link>
              .
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={accept}>
                Accept All
              </Button>
              <Button size="sm" variant="outline" onClick={decline}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
