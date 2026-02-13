import { Link } from "react-router-dom";
import { FileText, Shield, Cookie, Accessibility, Scale } from "lucide-react";

const footerLinks = [
  { to: "/terms", label: "Terms of Service", icon: FileText },
  { to: "/privacy", label: "Privacy Policy", icon: Shield },
  { to: "/cookies", label: "Cookie Policy", icon: Cookie },
  { to: "/accessibility", label: "Accessibility", icon: Accessibility },
  { to: "/fair-housing", label: "Fair Housing", icon: Scale },
];

export function Footer() {
  return (
    <footer className="bg-muted py-10 mt-auto border-t">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mb-6">
          {footerLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="h-9 w-9 rounded-full bg-background border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Homelens.ai LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
