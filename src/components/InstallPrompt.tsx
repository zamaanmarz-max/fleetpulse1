import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

// Shows a friendly "Add to your phone" prompt for techs.
// On Android/Chrome it triggers the native install. On iOS it shows instructions.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed / running standalone? Don't show.
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (standalone) return;

    // Dismissed recently?
    const dismissed = localStorage.getItem("marz_install_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS never fires beforeinstallprompt — show manual instructions instead
    if (ios) {
      const t = setTimeout(() => setShow(true), 2500);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("marz_install_dismissed", String(Date.now()));
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] max-w-md mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Add MARZ Fleet to your phone</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline" /> then "Add to Home Screen" to use it like an app.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Install it for one-tap access — no app store needed.</p>
          )}
          {!isIOS && (
            <button onClick={install} className="mt-2 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg">
              Install app
            </button>
          )}
        </div>
        <button onClick={dismiss} className="text-muted-foreground flex-shrink-0"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
