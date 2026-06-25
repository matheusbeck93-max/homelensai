import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Chrome, TrendingUp, MessageSquare, Tag, HelpCircle, LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type HomepageSection = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

// Each entry maps a clean URL to a section anchor on the homepage.
// When a user clicks the icon, we navigate to the clean path and scroll to #id.
// When a user opens the URL directly, Index.tsx reads the path/hash and scrolls.
export const HOMEPAGE_SECTIONS: HomepageSection[] = [
  { id: "extension", label: "Extension", path: "/extension", icon: Chrome },
  { id: "investors", label: "Investors", path: "/investors", icon: TrendingUp },
  { id: "chat", label: "Chat", path: "/chat-preview", icon: MessageSquare },
  { id: "pricing", label: "Pricing", path: "/plans", icon: Tag },
  { id: "faq", label: "FAQ", path: "/faq", icon: HelpCircle },
];

export function pathToSectionId(pathname: string): string | null {
  const match = HOMEPAGE_SECTIONS.find((s) => s.path === pathname);
  return match ? match.id : null;
}

type Props = { variant?: "desktop" | "mobile"; onNavigate?: () => void };

export function HomepageSectionNav({ variant = "desktop", onNavigate }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState<string | null>(
    pathToSectionId(location.pathname)
  );

  // Highlight the section currently scrolled into view.
  useEffect(() => {
    const targets = HOMEPAGE_SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [location.pathname]);

  const handleClick = (section: HomepageSection) => {
    onNavigate?.();
    // Update URL to clean path + hash without re-triggering full Index remount.
    navigate(`${section.path}#${section.id}`);
    const el = document.getElementById(section.id);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  if (variant === "mobile") {
    return (
      <div className="space-y-1">
        {HOMEPAGE_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = activeId === s.id;
          return (
            <Button
              key={s.id}
              variant="ghost"
              className={`justify-start w-full ${isActive ? "text-primary" : ""}`}
              onClick={() => handleClick(s)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {s.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        {HOMEPAGE_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = activeId === s.id;
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={s.label}
                  onClick={() => handleClick(s)}
                  className={isActive ? "text-primary bg-primary/10" : ""}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{s.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}