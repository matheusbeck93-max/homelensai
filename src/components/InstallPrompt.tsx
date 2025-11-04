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

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      
      // Show popup automatically if variant is popup and user hasn't dismissed it before
      if (variant === 'popup' && !localStorage.getItem('pwa-install-dismissed')) {
        setTimeout(() => setShowPopup(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      setIsInstallable(false);
    } else if (isIOSDevice) {
      // iOS devices don't fire beforeinstallprompt, so we show manual instructions
      setIsInstallable(true);
      if (variant === 'popup' && !localStorage.getItem('pwa-install-dismissed')) {
        setTimeout(() => setShowPopup(true), 3000);
      }
    }

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
              Instalar HomeLens
            </DialogTitle>
            <DialogDescription>
              {isIOS ? (
                <div className="space-y-2 text-sm">
                  <p>Para instalar no iOS:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Toque no botão <Share className="inline h-4 w-4" /> (Compartilhar)</li>
                    <li>Role para baixo e toque em "Adicionar à Tela de Início"</li>
                    <li>Toque em "Adicionar"</li>
                  </ol>
                </div>
              ) : (
                "Instale o HomeLens no seu dispositivo para acesso rápido e experiência offline completa."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {!isIOS && (
              <Button onClick={handleInstall} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Instalar Aplicativo
              </Button>
            )}
            <Button variant="outline" onClick={handleDismiss} className="w-full">
              {isIOS ? "Entendi" : "Agora Não"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Button 
      onClick={isIOS ? () => setShowPopup(true) : handleInstall} 
      variant="outline"
      size="sm"
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      Instalar App
    </Button>
  );
}
