import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass,
  FileText,
  PlusCircle,
  Folder,
  Brain,
  TrendingUp,
  Sparkles,
  ShieldAlert,
  Mail,
  Settings as SettingsIcon,
  Check,
  ChevronDown,
  LayoutGrid
} from "lucide-react";

export interface CompactAppSwitcherProps {
  activeTab: string;
  onSelectTab: (tabId: any) => void;
  lang: "ar" | "en" | "fr";
  theme?: "light" | "dark";
  className?: string;
  align?: "left" | "right" | "center";
}

export const CompactAppSwitcher: React.FC<CompactAppSwitcherProps> = ({
  activeTab,
  onSelectTab,
  lang = "ar",
  theme = "dark",
  className = "",
  align = "left",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const APPS = [
    {
      id: "dashboard",
      label: lang === "ar" ? "لوحة التحكم" : lang === "fr" ? "Tableau de Bord" : "Dashboard",
      icon: Compass,
      category: lang === "ar" ? "بيئة العمل" : "WORKSPACE",
    },
    {
      id: "library",
      label: lang === "ar" ? "مكتبة الذاكرة" : lang === "fr" ? "Registre Mémoire" : "Memory Library",
      icon: FileText,
      category: lang === "ar" ? "بيئة العمل" : "WORKSPACE",
    },
    {
      id: "add",
      label: lang === "ar" ? "إضافة ذاكرة" : lang === "fr" ? "Ajouter Mémoire" : "Add Memory",
      icon: PlusCircle,
      category: lang === "ar" ? "بيئة العمل" : "WORKSPACE",
    },
    {
      id: "files",
      label: lang === "ar" ? "إدارة الملفات" : lang === "fr" ? "Fichiers" : "File Vault",
      icon: Folder,
      category: lang === "ar" ? "بيئة العمل" : "WORKSPACE",
    },
    {
      id: "smart",
      label: lang === "ar" ? "التطور الذكي" : lang === "fr" ? "Évolution Intelligente" : "Smart Evolution",
      icon: Brain,
      category: lang === "ar" ? "الذكاء والتحليل" : "INTELLIGENCE",
    },
    {
      id: "market",
      label: lang === "ar" ? "ذكاء السوق" : lang === "fr" ? "Intelligence Marché" : "Market Intel",
      icon: TrendingUp,
      category: lang === "ar" ? "الذكاء والتحليل" : "INTELLIGENCE",
    },
    {
      id: "agent",
      label: lang === "ar" ? "المستشار المعرفي" : lang === "fr" ? "Conseiller Cognitif" : "Cognitive Advisor",
      icon: Sparkles,
      category: lang === "ar" ? "الذكاء والتحليل" : "INTELLIGENCE",
    },
    {
      id: "alerts",
      label: lang === "ar" ? "تنبيهات المخاطر" : lang === "fr" ? "Alertes Risques" : "Risk Alerts",
      icon: ShieldAlert,
      category: lang === "ar" ? "الإدارة والأمان" : "MANAGEMENT",
    },
    {
      id: "gmail",
      label: lang === "ar" ? "البريد" : lang === "fr" ? "Messagerie" : "Email Vault",
      icon: Mail,
      category: lang === "ar" ? "الإدارة والأمان" : "MANAGEMENT",
    },
    {
      id: "settings",
      label: lang === "ar" ? "الإعدادات" : lang === "fr" ? "Paramètres" : "Settings",
      icon: SettingsIcon,
      category: lang === "ar" ? "الإدارة والأمان" : "MANAGEMENT",
    },
  ];

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

  const handleSelectApp = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    onSelectTab(tabId);
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

  const currentAppObj = APPS.find((a) => a.id === activeTab) || APPS[0];
  const CurrentIcon = currentAppObj.icon;
  const isLight = theme === "light";

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
        className={`relative flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none text-xs font-bold ${
          isOpen
            ? isLight
              ? "bg-slate-200 border-slate-300 text-[#0075DE] shadow-xs"
              : "bg-slate-800 border-[#0075DE]/40 text-[#0075DE] shadow-xs"
            : isLight
              ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-xs"
              : "bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-200"
        }`}
        aria-label="Switch App / Module"
        title={lang === "ar" ? "تبديل التطبيق / الوحدة" : "Switch App / Module"}
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className="w-4 h-4 text-[#0075DE] shrink-0" />
          <span className="truncate max-w-[110px] hidden sm:inline-block font-semibold">
            {currentAppObj.label}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </motion.button>

      {/* Floating Smooth Dropdown Popover on Hover / Tap */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 z-50 w-64 max-h-96 overflow-y-auto p-1.5 rounded-2xl border shadow-2xl backdrop-blur-md custom-scrollbar ${
              align === "left"
                ? "left-0"
                : align === "center"
                  ? "left-1/2 -translate-x-1/2"
                  : "right-0"
            } ${
              isLight
                ? "bg-white/98 border-slate-200 shadow-slate-300/50 text-slate-900"
                : "bg-[#0C101A]/98 border-slate-800 shadow-black/80 text-slate-100"
            }`}
          >
            <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
              <span>{lang === "ar" ? "تطبيقات ووحدات ذاكر" : "Zakir Modules"}</span>
              <LayoutGrid className="w-3 h-3 text-[#0075DE]" />
            </div>

            <div className="space-y-0.5">
              {APPS.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => handleSelectApp(item.id, e)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-[#0075DE] text-white font-bold shadow-xs"
                        : isLight
                          ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                          : "hover:bg-slate-800/80 text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ItemIcon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-[#0075DE]"}`} />
                      <span className="truncate font-semibold">{item.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
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
