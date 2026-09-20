import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, Sparkles } from "lucide-react";

interface TrialCountdownProps {
  trialExpiresAt?: string;
  trialEndsAt?: string;
  approvedAt?: string;
  onExpire?: () => void;
  onUpgradeClick?: () => void;
  lang?: "ar" | "en" | "fr";
  showBanner?: boolean;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = React.memo(({
  trialExpiresAt,
  trialEndsAt,
  approvedAt,
  onExpire,
  onUpgradeClick,
  lang = "ar",
  showBanner = false
}) => {
  const isAr = lang === "ar";
  const targetDateStr = trialEndsAt || trialExpiresAt;

  const calculateRemaining = () => {
    if (!targetDateStr) {
      if (approvedAt) {
        const endMs = new Date(approvedAt).getTime() + 24 * 3600 * 1000;
        const diff = endMs - Date.now();
        return Math.max(0, Math.floor(diff / 1000));
      }
      return 24 * 3600;
    }
    const endMs = new Date(targetDateStr).getTime();
    const diff = endMs - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateRemaining);

  useEffect(() => {
    const update = () => {
      const remaining = calculateRemaining();
      setSecondsLeft(remaining);
      if (remaining <= 0 && onExpire) {
        onExpire();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr, approvedAt]);

  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return "00:00:00";
    const hours = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
    const seconds = (totalSec % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const isWarning = secondsLeft > 0 && secondsLeft < 2 * 3600; // < 2 hours left
  const isExpired = secondsLeft <= 0;

  if (showBanner) {
    if (isExpired) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-2 rounded-xl flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{isAr ? "انتهت الفترة التجريبية (24 ساعة). يرجى الاشتراك للمتابعة." : "Trial period expired (24h). Please subscribe to continue."}</span>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold rounded-lg text-xs hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer shrink-0"
            >
              {isAr ? "ترقية الباقة الآن" : "Upgrade Plan"}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className={`px-4 py-2 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition-all ${
        isWarning
          ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
          : "bg-slate-900/80 border-slate-800 text-slate-300"
      }`}>
        <div className="flex items-center gap-2">
          <Clock className={`w-4 h-4 ${isWarning ? "text-amber-400 animate-pulse" : "text-amber-400"}`} />
          <span>
            {isAr ? "فترة تجريبية مجانية (24 ساعة):" : "24-Hour Free Trial:"}
          </span>
          <span className="font-mono font-bold text-amber-400 text-sm">
            {formatTime(secondsLeft)}
          </span>
        </div>
        {onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? "اختيار باقة" : "Choose Plan"}</span>
          </button>
        )}
      </div>
    );
  }

  // Compact inline badge
  if (isExpired) {
    return <span className="text-red-400 font-mono font-bold text-xs bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">00:00:00 (منتهية)</span>;
  }

  return (
    <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${
      isWarning
        ? "text-amber-300 bg-amber-500/15 border-amber-500/40 animate-pulse"
        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
    }`}>
      <Clock className="w-3 h-3" />
      <span>{formatTime(secondsLeft)}</span>
    </span>
  );
});
