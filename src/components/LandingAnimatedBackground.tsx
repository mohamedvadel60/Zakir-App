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

      {/* Dynamic Animated Glowing Gradient Orbs - Optimized GPU Radial Glow */}
      <motion.div 
        animate={reducedMotion ? {} : {
          opacity: [0.12, 0.22, 0.12],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ x: "-50%", y: "-10%" }}
        className={`absolute top-0 left-1/2 w-[700px] h-[350px] rounded-full blur-[60px] pointer-events-none ${
          isDark ? "bg-amber-500/15" : "bg-amber-400/10"
        }`}
      />

      <motion.div 
        animate={reducedMotion ? {} : {
          opacity: [0.05, 0.12, 0.05],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ x: "10%", y: "20%" }}
        className="absolute top-[35%] left-[20%] w-[450px] h-[450px] rounded-full blur-[70px] bg-amber-600/10 pointer-events-none"
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
