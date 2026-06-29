import { useEffect, useState } from "react";
import { Share2, X, Facebook, MessageCircle, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { cn } from "@/lib/utils";

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface BlogSidebarProps {
  headings: HeadingItem[];
  title: string;
  url: string;
}

export function BlogSidebar({ headings, title, url }: BlogSidebarProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      let currentId = headings[0].id;

      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el && el.offsetTop <= scrollPosition) {
          currentId = heading.id;
        }
      }
      setActiveId(currentId);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 90; // account for sticky header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveId(id);
    }
  };

  const shareOnX = () => {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, "_blank");
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
  };

  const shareOnWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} - ${url}`)}`, "_blank");
  };

  const shareOnInstagram = () => {
    navigator.clipboard.writeText(`${title} - ${url}`);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  return (
    <aside className="sticky top-28 space-y-8 p-6 bg-card/60 rounded-xl border border-border/60 backdrop-blur-sm">
      {/* Table of Contents */}
      {headings.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            In this article
          </h3>
          <nav className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
            {headings.map((h) => (
              <button
                key={h.id}
                onClick={() => scrollToHeading(h.id)}
                className={cn(
                  "block w-full text-left text-sm py-1 transition-colors leading-snug truncate",
                  h.level === 3 ? "pl-3 text-xs" : "",
                  activeId === h.id
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {h.text}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Social Sharing */}
      <div className={cn(headings.length > 0 && "pt-6 border-t border-border/60")}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5" /> Share this post
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-foreground/10 hover:text-foreground hover:border-foreground/30"
            onClick={shareOnX}
            title="Share on X"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-[#E1306C]/10 hover:text-[#E1306C] hover:border-[#E1306C]/30"
            onClick={shareOnInstagram}
            title="Copy link for Instagram"
          >
            <InstagramIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30"
            onClick={shareOnWhatsApp}
            title="Share on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]/30"
            onClick={shareOnFacebook}
            title="Share on Facebook"
          >
            <Facebook className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 px-3 gap-1.5 text-xs", copied && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30")}
            onClick={copyToClipboard}
            title="Copy link"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied!
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" /> Copy Link
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}