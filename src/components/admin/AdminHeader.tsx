import React from "react";
import { 
  ShieldCheck, 
  Sun, 
  Moon, 
  LogOut, 
  Globe, 
  RefreshCw, 
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { ZakirSymbol } from "../ZakirLogo.js";

interface AdminHeaderProps {
  currentUser: any;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
  toggleLanguage?: (newLang: "ar" | "fr" | "en") => void;
  toggleTheme: (newTheme: "dark" | "light") => void;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onSwitchToWorkspace?: () => void;
  isRealtimeConnected: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentUser,
  lang,
  theme,
  toggleLanguage,
  toggleTheme,
  onLogout,
  onRefresh,
  refreshing,
  onSwitchToWorkspace,
  isRealtimeConnected
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const t = {
    title: isAr ? "مركز تحكم الإدارة" : isFr ? "Centre de Contrôle Admin" : "Admin Control Center",
    platformSubtitle: isAr ? "نظام إدارة منصة ZAKIR" : isFr ? "Système de Gestion ZAKIR" : "ZAKIR Operations Hub",
    live: isAr ? "متصل بالنظام" : isFr ? "Connecté en Direct" : "Live Connected",
    syncing: isAr ? "جاري المزامنة..." : isFr ? "Synchronisation..." : "Syncing...",
    switchToWorkspace: isAr ? "الانتقال لبيئة العمل" : isFr ? "Aller à l'espace de travail" : "Switch to Workspace",
    refresh: isAr ? "تحديث البيانات" : isFr ? "Actualiser" : "Refresh Data",
    logout: isAr ? "تسجيل الخروج" : isFr ? "Déconnexion" : "Logout",
    adminBadge: isAr ? "مشرف النظام" : isFr ? "Administrateur" : "Super Admin"
  };

  return (
    <header 
      className={`h-16 px-4 md:px-6 flex items-center justify-between border-b transition-colors select-none ${
        theme === "dark" 
          ? "bg-[#090D16] border-slate-800/80 text-white" 
          : "bg-white border-slate-200 text-slate-900 shadow-xs"
      }`}
    >
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-3">
        {/* Navy/White box badge matching brand specification */}
        <div 
          className={`w-10 h-10 rounded-xl flex items-center justify-center p-2 shadow-xs shrink-0 ${
            theme === "dark" ? "bg-white text-[#1C2C58]" : "bg-[#1C2C58] text-white"
          }`}
        >
          <ZakirSymbol className="w-6 h-6" color={theme === "dark" ? "#1C2C58" : "#FFFFFF"} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base md:text-lg">ZAKIR</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {t.title}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight hidden sm:block">
            {t.platformSubtitle}
          </p>
        </div>

        {/* Live status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 ms-3 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
          <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span>{isRealtimeConnected ? t.live : t.syncing}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Switch to Platform Workspace Button */}
        {onSwitchToWorkspace && (
          <button
            onClick={onSwitchToWorkspace}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors"
            title={t.switchToWorkspace}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.switchToWorkspace}</span>
          </button>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          type="button"
          aria-label={t.refresh}
          title={t.refresh}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
        </button>

        {/* Language selector */}
        {toggleLanguage && (
          <div className="relative flex items-center">
            <button
              onClick={() => {
                const nextLang = lang === "ar" ? "en" : lang === "en" ? "fr" : "ar";
                toggleLanguage(nextLang);
              }}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="uppercase font-bold">{lang}</span>
            </button>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => toggleTheme(theme === "dark" ? "light" : "dark")}
          type="button"
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Admin Profile & Logout */}
        <div className="flex items-center gap-2 border-s ps-2 md:ps-3 border-slate-200 dark:border-slate-800">
          <div className="hidden sm:flex flex-col text-end">
            <span className="text-xs font-semibold truncate max-w-[130px]">
              {currentUser?.name || currentUser?.displayName || currentUser?.email || "Admin"}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {t.adminBadge}
            </span>
          </div>
          <button
            onClick={onLogout}
            type="button"
            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            title={t.logout}
            aria-label={t.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
