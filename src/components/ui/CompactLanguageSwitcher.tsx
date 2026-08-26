import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Check } from "lucide-react";

interface CompactLanguageSwitcherProps {
  lang: "ar" | "en" | "fr";
  onToggleLanguage: (lang: "ar" | "en" | "fr") => void;
  theme?: "light" | "dark";
  className?: string;
  align?: "left" | "right" | "center" | "start" | "end";
}

const LANGUAGES = [
  { id: "ar" as const, label: "العربية", code: "ع" },
  { id: "fr" as const, label: "Français", code: "FR" },
  { id: "en" as const, label: "English", code: "EN" },
];

export const CompactLanguageSwitcher: React.FC<CompactLanguageSwitcherProps> = ({
  lang,
  onToggleLanguage,
  theme = "dark",
  className = "",
  align = "end",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleSelectLanguage = (selectedLang: "ar" | "en" | "fr", e: React.MouseEvent) => {
    e.stopPropagation();
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    onToggleLanguage(selectedLang);
    setIsOpen(false);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const currentLangObj = LANGUAGES.find((l) => l.id === lang) || LANGUAGES[0];
  const isLight = theme === "light";
  const isRtl = lang === "ar";

  // Calculate alignment class based on RTL/LTR and align prop
  let alignClass = "right-0";
  if (align === "left") alignClass = "left-0";
  else if (align === "right") alignClass = "right-0";
  else if (align === "center") alignClass = "left-1/2 -translate-x-1/2";
  else if (align === "start") alignClass = isRtl ? "right-0" : "left-0";
  else if (align === "end") alignClass = isRtl ? "left-0" : "right-0";

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block ${className}`}
    >
      {/* Compact Trigger Button */}
      <motion.button
        type="button"
        onClick={handleToggleClick}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-bold ${
          isOpen
            ? isLight
              ? "bg-slate-200 border-slate-300 text-[#0075DE] shadow-xs"
              : "bg-slate-800 border-[#0075DE]/40 text-[#0075DE] shadow-xs"
            : isLight
              ? "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700 hover:text-slate-900"
              : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
        }`}
        aria-label="Change language"
        title={lang === "ar" ? "تغيير اللغة" : "Change Language"}
      >
        <Globe className="w-3.5 h-3.5 opacity-80 shrink-0" />
        <span className="text-[11px] font-mono tracking-tight font-extrabold">{currentLangObj.code}</span>
      </motion.button>

      {/* Floating Smooth Popover on Hover / Tap */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 z-50 min-w-[130px] p-1 rounded-xl border shadow-xl backdrop-blur-md ${alignClass} ${
              isLight
                ? "bg-white/95 border-slate-200 shadow-slate-300/40 text-slate-800"
                : "bg-[#0C101A]/95 border-slate-800 shadow-black/60 text-slate-200"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              {LANGUAGES.map((item) => {
                const isSelected = lang === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => handleSelectLanguage(item.id, e)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-start ${
                      isSelected
                        ? "bg-[#0075DE] text-white font-bold shadow-xs"
                        : isLight
                          ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                          : "hover:bg-slate-800/80 text-slate-300 hover:text-white"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ms-2" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
