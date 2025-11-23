import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  property: {
    address: string;
    city: string;
    state: string;
    price: number;
    id: string;
  };
}

export function ShareButton({ property }: ShareButtonProps) {
  const { toast } = useToast();
  
  const propertyUrl = `${window.location.origin}/property/${property.id}`;
  const shareText = `Check out this property: ${property.address}, ${property.city}, ${property.state} - $${property.price.toLocaleString()}`;

  const handleShare = (platform: string) => {
    let shareUrl = "";
    
    switch (platform) {
      case "sms":
        shareUrl = `sms:?body=${encodeURIComponent(`${shareText} ${propertyUrl}`)}`;
        break;
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${propertyUrl}`)}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(propertyUrl)}`;
        break;
      case "instagram":
        // Instagram doesn't support direct sharing via URL, so we copy to clipboard
        navigator.clipboard.writeText(`${shareText} ${propertyUrl}`);
        toast({
          title: "Copied to clipboard",
          description: "Share this on Instagram by pasting it in your post or story",
        });
        return;
      case "copy":
        navigator.clipboard.writeText(propertyUrl);
        toast({
          title: "Link copied",
          description: "Property link copied to clipboard",
        });
        return;
    }
    
    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleShare("sms")}>
          Message
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("whatsapp")}>
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("facebook")}>
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("instagram")}>
          Instagram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("copy")}>
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
