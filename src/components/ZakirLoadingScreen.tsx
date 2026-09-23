import React from "react";
import { motion } from "framer-motion";
import { ZakirMotionLogo } from "./ZakirMotionLogo";

interface ZakirLoadingScreenProps {
  theme?: "light" | "dark";
  showText?: boolean;
}

/**
 * ZAKIR Signature Loading Screen & Reveal
 * 
 * Powered by the brand-new ZAKIR Causal Memory Motion System:
 * - 100% Authentic Brand Vectors from official assets
 * - Mathematical causal node convergence & vector formation
 * - No artificial delays, no cheap neon glows or generic spinners
 * - Ultra-smooth Framer Motion exit transition
 * - Fully accessible & prefers-reduced-motion compliant
 */
export const ZakirLoadingScreen: React.FC<ZakirLoadingScreenProps> = ({
  theme = "dark",
  showText = false,
}) => {
  const isDark = theme === "dark";

  return (
    <motion.div
      id="zakir-loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden ${
        isDark ? "bg-[#0B0F19]" : "bg-[#F8FAFC]"
      }`}
      role="status"
      aria-label="Loading ZAKIR"
    >
      {/* Subtle depth gradient field */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isDark
            ? "bg-[radial-gradient(ellipse_at_center,rgba(28,44,88,0.25)_0%,rgba(11,15,25,0)_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(0,117,222,0.06)_0%,rgba(248,250,252,0)_70%)]"
        }`}
      />

      {/* Signature Motion Logo */}
      <div className="relative z-10 flex items-center justify-center p-6">
        <ZakirMotionLogo
          size={84}
          theme={theme}
          withBox={true}
          showText={showText}
          loop={true}
        />
      </div>
    </motion.div>
  );
};
