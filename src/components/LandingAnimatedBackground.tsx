import React, { useState, useEffect } from "react";
import { motion } from "motion/react";

export const LandingAnimatedBackground: React.FC<{ theme?: "dark" | "light" | "custom" }> = ({ theme = "dark" }) => {
  const isDark = theme !== "light";
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Soft Radial Ambient Depth */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.08),rgba(2,6,23,0))]" 
      />

      {/* Dynamic Animated Glowing Gradient Orbs (Zakir Amber/Gold Warm Ambient Glow) */}
      {/* Using transform/opacity only for GPU acceleration. */}
      <motion.div 
        animate={reducedMotion ? {} : {
          scale: [1, 1.1, 1],
          opacity: [0.12, 0.20, 0.12],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ x: "-50%", y: "-10%" }}
        className={`absolute top-0 left-1/2 w-[800px] h-[400px] rounded-full blur-[120px] pointer-events-none will-change-transform ${
          isDark ? "bg-amber-500/20" : "bg-amber-400/15"
        }`}
      />

      <motion.div 
        animate={reducedMotion ? {} : {
          opacity: [0.06, 0.10, 0.06],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{ x: "10%", y: "20%" }}
        className="absolute top-[35%] left-[20%] w-[500px] h-[500px] rounded-full blur-[140px] bg-amber-600/10 pointer-events-none will-change-opacity"
      />

      {/* Precision Micro Technical Grid Overlay */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.025] stroke-current"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-pattern-subtle" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke={isDark ? "#FFFFFF" : "#000000"} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-subtle)" />
      </svg>
    </div>
  );
};
