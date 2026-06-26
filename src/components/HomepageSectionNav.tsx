import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export type HomepageSection = {
  id: string;
  label: string;
  path: string;
  external?: boolean; // when true, navigate to path as a separate page (no anchor scroll)
};

// Each entry maps a clean URL to a section anchor on the homepage.
// When a user clicks the icon, we navigate to the clean path and scroll to #id.
// When a user opens the URL directly, Index.tsx reads the path/hash and scrolls.
export const HOMEPAGE_SECTIONS: HomepageSection[] = [
  { id: "extension", label: "Extension", path: "/extension" },
  { id: "investors", label: "Investors", path: "/investors" },
  { id: "chat", label: "Chat", path: "/chat-preview" },
  { id: "pricing", label: "Pricing", path: "/plans" },
  { id: "faq", label: "FAQ", path: "/faq" },
  { id: "blog", label: "Blog", path: "/blog", external: true },
];

export function pathToSectionId(pathname: string): string | null {
  const match = HOMEPAGE_SECTIONS.find((s) => s.path === pathname);
  return match ? match.id : null;
}

function smoothScrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Account for the 64px sticky header plus a little breathing room.
  const headerOffset = 80;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top, behavior: "smooth" });
}

export { smoothScrollToId };

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
    if (section.external) {
      navigate(section.path);
      return;
    }
    navigate(`${section.path}#${section.id}`);
    requestAnimationFrame(() => smoothScrollToId(section.id));
  };

  if (variant === "mobile") {
    return (
      <div className="space-y-1">
        {HOMEPAGE_SECTIONS.map((s) => {
          const isActive = activeId === s.id;
          return (
            <Button
              key={s.id}
              variant="ghost"
              className={`justify-start w-full ${isActive ? "text-primary" : ""}`}
              onClick={() => handleClick(s)}
            >
              {s.label}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {HOMEPAGE_SECTIONS.map((s) => {
        const isActive = activeId === s.id;
        return (
          <Button
            key={s.id}
            variant="ghost"
            onClick={() => handleClick(s)}
            className={isActive ? "text-primary" : ""}
          >
            {s.label}
          </Button>
        );
      })}
    </div>
  );
}