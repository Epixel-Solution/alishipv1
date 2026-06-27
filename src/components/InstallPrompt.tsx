import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "aliship.pwa.install.dismissed";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running as standalone PWA)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if user already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-xl border border-primary/40 bg-zinc-950 p-4 text-zinc-50 shadow-[0_8px_32px_rgba(255,102,0,0.25)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install Aliship App</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Add to your home screen for faster access — no browser needed.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall} className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-xs text-zinc-400 hover:text-zinc-100">
              Not now
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="shrink-0 text-zinc-500 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
