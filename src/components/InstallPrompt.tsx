import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  variant?: 'popup' | 'button';
  className?: string;
}

export function InstallPrompt({ variant = 'button', className = '' }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    // Detect iOS mobile devices
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Detect macOS Safari
    const isMacOSSafari = /Macintosh/.test(navigator.userAgent) && 
                          /Safari/.test(navigator.userAgent) && 
                          !/Chrome/.test(navigator.userAgent);
    setIsMacOS(isMacOSSafari);

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstallable(false);
      return;
    }

    // For iOS devices or macOS Safari, always show install option
    if (isIOSDevice || isMacOSSafari) {
      setIsInstallable(true);
      if (variant === 'popup' && !localStorage.getItem('pwa-install-dismissed')) {
        setTimeout(() => setShowPopup(true), 3000);
      }
    }

    // For non-iOS/macOS devices, listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      if (variant === 'popup' && !localStorage.getItem('pwa-install-dismissed')) {
        setTimeout(() => setShowPopup(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [variant]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setShowPopup(false);
    }
  };

  const handleDismiss = () => {
    setShowPopup(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!isInstallable) return null;

  if (variant === 'popup') {
    return (
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Install HomeLens
            </DialogTitle>
            <DialogDescription>
              {isIOS ? (
                <div className="space-y-2 text-sm">
                  <p>To install this app on your iPhone, tap the Share button in Safari (the square with the up arrow) and select 'Add to Home Screen'.</p>
                </div>
              ) : isMacOS ? (
                <div className="space-y-2 text-sm">
                  <p>To install this app on your Mac:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Click the Share button in Safari's toolbar (or File menu)</li>
                    <li>Select "Add to Dock"</li>
                  </ol>
                </div>
              ) : (
                "Install HomeLens on your device for quick access and full offline experience."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {!isIOS && !isMacOS && (
              <Button onClick={handleInstall} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            )}
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              {isIOS || isMacOS ? "Understood" : "Not Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Button 
      onClick={(isIOS || isMacOS) ? () => setShowPopup(true) : handleInstall} 
      variant="default"
      size="sm"
      className={`${className} ${(isIOS || isMacOS) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
    >
      <Download className="h-4 w-4 mr-2" />
      Install App
    </Button>
  );
}
