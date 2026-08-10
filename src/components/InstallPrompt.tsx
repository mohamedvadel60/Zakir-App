import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";

export function InstallPrompt({ lang }: { lang: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!isInstallable) return null;

  return (
    <div className="mt-4 p-3 bg-zakir-dark border border-zakir-accent/30 rounded-lg shadow-sm">
      <div className="flex items-center space-x-3 rtl:space-x-reverse mb-2">
        <div className="p-1.5 bg-zakir-accent/10 rounded-md">
          <Download className="w-4 h-4 text-zakir-accent" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white">
            {lang === "ar" ? "تثبيت التطبيق" : "Install App"}
          </h4>
        </div>
      </div>
      <button
        onClick={handleInstallClick}
        className="w-full mt-2 py-1.5 text-xs font-semibold text-white bg-zakir-accent hover:bg-zakir-accent/90 rounded-md transition-colors"
      >
        {lang === "ar" ? "تثبيت الآن" : "Install Now"}
      </button>
    </div>
  );
}
