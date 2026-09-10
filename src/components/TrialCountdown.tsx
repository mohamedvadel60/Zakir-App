import React, { useState, useEffect } from "react";

interface TrialCountdownProps {
  trialExpiresAt?: string;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = React.memo(({ trialExpiresAt }) => {
  const [timeLeft, setTimeLeft] = useState<string>(() => {
    if (!trialExpiresAt) return "18:41:09";
    const expireTime = new Date(trialExpiresAt).getTime();
    const diff = expireTime - Date.now();
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  });

  useEffect(() => {
    if (!trialExpiresAt) return;
    const interval = setInterval(() => {
      const expireTime = new Date(trialExpiresAt).getTime();
      const diff = expireTime - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00:00");
      } else {
        const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        setTimeLeft(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trialExpiresAt]);

  return <span className="text-amber-500 font-bold font-mono">{timeLeft}</span>;
});
