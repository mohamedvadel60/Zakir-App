import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZakirLogo } from "./ZakirLogo";

interface ZakirLoadingScreenProps {
  theme?: "light" | "dark";
  isExiting?: boolean;
}

/**
 * Official ZAKIR Cinematic Loading Screen
 * 
 * Features:
 * - 100% Authentic Brand Mark from Zakir Light Mode.txt / Zakir Dark Mode.txt
 * - Subdued, high-end cinematic light sweep & ambient aura around the official logo
 * - Pure GPU-accelerated CSS/Framer motion with zero logo warping or distortion
 * - Full prefers-reduced-motion accessibility support
 * - Mobile & Desktop responsive layout
 * - Clean: No arbitrary text, no artificial delay
 */
export const ZakirLoadingScreen: React.FC<ZakirLoadingScreenProps> = ({
  theme = "dark",
}) => {
  const isDark = theme === "dark";

  return (
    <motion.div
      id="zakir-loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden ${
        isDark ? "bg-[#0B0F19]" : "bg-[#F8FAFC]"
      }`}
      role="status"
      aria-label="Loading ZAKIR"
    >
      {/* Container holding logo and surrounding ambient rays */}
      <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72 pointer-events-none">
        {/* Layer 1: Soft Atmospheric Ambient Aura (Depth) */}
        <div
          className={`zakir-motion-aura absolute inset-0 rounded-full blur-2xl pointer-events-none ${
            isDark ? "zakir-aura-dark" : "zakir-aura-light"
          }`}
          style={{ willChange: "transform, opacity" }}
        />

        {/* Layer 2: Rotating Cinematic Light Ray Sweep */}
        <div
          className="zakir-motion-ray absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full pointer-events-none"
          style={{ willChange: "transform, opacity" }}
        >
          <div
            className={`w-full h-full rounded-full blur-md ${
              isDark ? "zakir-ray-conic-dark" : "zakir-ray-conic-light"
            }`}
          />
        </div>

        {/* Layer 3: Soft Concentric Perimeter Halo */}
        <div
          className={`zakir-motion-sweep absolute w-32 h-32 sm:w-36 sm:h-36 rounded-3xl blur-lg pointer-events-none ${
            isDark ? "bg-[#0db4d7]/15" : "bg-[#0075DE]/12"
          }`}
          style={{ willChange: "transform, opacity" }}
        />

        {/* Layer 4: Orbital Specular Glint (Subtle High-Tech Accent) */}
        <div
          className="zakir-motion-glint absolute w-2 h-2 rounded-full pointer-events-none"
          style={{ willChange: "transform, opacity" }}
        >
          <div
            className={`w-full h-full rounded-full blur-[1px] ${
              isDark
                ? "bg-[#67e8f9] shadow-[0_0_8px_#0db4d7]"
                : "bg-[#0075DE] shadow-[0_0_8px_#0075DE]"
            }`}
          />
        </div>

        {/* Layer 5: Official ZAKIR Logo (Centered, Pristine, Untouched) */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 flex items-center justify-center"
        >
          <ZakirLogo
            size={80}
            withBox={true}
            iconOnly={true}
            theme={theme}
            className="drop-shadow-sm"
          />
        </motion.div>
      </div>
    </motion.div>
  );
};
