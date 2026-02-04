import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if dismissed recently
    const dismissedTime = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      handleDismiss();
    }
  };

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) return null;

  // Show iOS instructions
  if (isIOS && !isInstallable) {
    if (!showIOSInstructions) {
      return (
        <Card className="fixed bottom-4 left-4 right-4 z-50 border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg md:left-auto md:right-4 md:w-80">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Install KPT Portal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add to your home screen for quick access
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => setShowIOSInstructions(true)}>
                    <Download className="h-4 w-4 mr-1" />
                    How to Install
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="fixed bottom-4 left-4 right-4 z-50 border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg md:left-auto md:right-4 md:w-80">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <p className="font-medium text-sm">Install on iOS</p>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ol className="text-xs text-muted-foreground space-y-2">
            <li className="flex gap-2">
              <span className="font-bold">1.</span>
              Tap the Share button (box with arrow)
            </li>
            <li className="flex gap-2">
              <span className="font-bold">2.</span>
              Scroll down and tap "Add to Home Screen"
            </li>
            <li className="flex gap-2">
              <span className="font-bold">3.</span>
              Tap "Add" to confirm
            </li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  // Show install prompt for Android/Desktop
  if (!isInstallable) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg md:left-auto md:right-4 md:w-80">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Install KPT Portal</p>
            <p className="text-xs text-muted-foreground mt-1">
              Install the app for faster access and offline support
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleInstall}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
