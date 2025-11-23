import { useState } from "react";
import { Share2, Copy, Mail, MessageSquare, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { HomeLensListing } from "@/types/ui-blocks";

interface ShareMenuProps {
  property: HomeLensListing;
  children?: React.ReactNode;
}

export function ShareMenu({ property, children }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const url = property.listingUrl || window.location.href;
  const text = `Check out this property in ${property.city || ""}, ${property.state || ""}: ${property.address || ""}`;
  const title = "HomeLens Property";

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setOpen(false);
      } catch (err) {
        // User cancelled or share failed - ignore
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Property link copied to clipboard",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleSMS = () => {
    const smsUrl = `sms:?body=${encodeURIComponent(text + " " + url)}`;
    window.open(smsUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleEmail = () => {
    const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + " " + url)}`;
    window.open(emailUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur-sm hover:bg-background"
            aria-label="Share this property"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          <p className="text-sm font-semibold mb-2">Share property</p>
          
          {navigator.share && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleNativeShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share...
            </Button>
          )}
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleWhatsApp}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleSMS}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS / Messages
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleEmail}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleFacebook}
          >
            <Facebook className="h-4 w-4 mr-2" />
            Facebook
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleTwitter}
          >
            <Twitter className="h-4 w-4 mr-2" />
            X (Twitter)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
