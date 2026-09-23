import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ZakirMotionLogo } from "./ZakirMotionLogo";

interface ZakirLoadingScreenProps {
  theme?: "light" | "dark";
  showText?: boolean;
}

/**
 * ZAKIR Signature Loading Screen & Reveal
 * 
 * Powered by official brand vector assets:
 * - Light Mode: `Light Mode.txt`
 * - Dark Mode: `Dark Mode.txt`
 * - Strictly NO outer card, box, border, or shadow wrapper.
 * - Smooth exit transition & zero flash of wrong theme.
 */
export const ZakirLoadingScreen: React.FC<ZakirLoadingScreenProps> = ({
  theme: propsTheme,
  showText = false,
}) => {
  // Synchronous theme resolution from localStorage to eliminate any theme flash
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">(() => {
    if (propsTheme) return propsTheme;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zakir_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    if (propsTheme) {
      setActiveTheme(propsTheme);
    }
  }, [propsTheme]);

  const isDark = activeTheme === "dark";

  return (
    <motion.div
      id="zakir-loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden ${
        isDark ? "bg-[#0B0F19]" : "bg-[#F8FAFC]"
      }`}
      role="status"
      aria-label="Loading ZAKIR"
    >
      {/* 
        Strictly NO outer box, container card, border, or shadow.
        The SVG logo renders cleanly on the theme background.
      */}
      <div className="relative z-10 flex items-center justify-center p-4 bg-transparent border-none shadow-none">
        <ZakirMotionLogo
          theme={activeTheme}
          showText={showText}
          size="lg"
        />
      </div>
    </motion.div>
  );
};
