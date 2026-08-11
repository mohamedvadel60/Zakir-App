import React from "react";
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
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Clock,
  CreditCard,
  LogOut,
  Menu,
  Award,
  RefreshCw,
  Sun,
  Moon,
  Shield,
  UserCheck,
  Building,
  Sliders,
  Check,
  ChevronRight,
  ChevronLeft,
  Settings as SettingsIcon
} from "lucide-react";
import { ZakirLogo } from "../ZakirLogo";
import { InstallPrompt } from "../InstallPrompt";
import { User } from "../../types";

export interface AppShellProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  lang: "ar" | "en" | "fr";
  toggleLanguage: (lang: "ar" | "en" | "fr") => void;
  theme: "light" | "dark";
  toggleTheme: (theme: "light" | "dark") => void;
  isCustomThemeActive: boolean;
  handleLogout: () => void;
  timeLeftStr: string;
  statsCount: { activeRisks: number };
  isRefreshing: boolean;
  handleRefresh: () => void;
  isLoading: boolean;
  settingsActiveSubTab: string;
  setSettingsActiveSubTab: (subTab: any) => void;
  incomingInvitation: any;
  handleAcceptInvitation: (inv: any) => void;
  handleDeclineInvitation: () => void;
  t: any;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  toggleSidebarCollapse,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  lang,
  toggleLanguage,
  theme,
  toggleTheme,
  isCustomThemeActive,
  handleLogout,
  timeLeftStr,
  statsCount,
  isRefreshing,
  handleRefresh,
  isLoading,
  settingsActiveSubTab,
  setSettingsActiveSubTab,
  incomingInvitation,
  handleAcceptInvitation,
  handleDeclineInvitation,
  t,
  children
}) => {
  const isRtl = lang === "ar";
  const textDirection = isRtl ? "rtl" : "ltr";

  // Sidebar sections configuration
  const sidebarSections = [
    {
      group: isRtl ? "بيئة العمل" : "WORKSPACE",
      items: [
        { id: "dashboard", label: t.refreshPage || (isRtl ? "لوحة التحكم" : "Dashboard"), icon: Compass },
        { id: "library", label: t.allCategories || (isRtl ? "مكتبة الذاكرة" : "Memory Library"), icon: FileText },
        { id: "add", label: t.logMemoryBtn || (isRtl ? "إضافة ذاكرة" : "Add Memory"), icon: PlusCircle },
        { id: "files", label: isRtl ? "إدارة الملفات" : (lang === "fr" ? "Fichiers & Vault" : "File Vault"), icon: Folder },
      ]
    },
    {
      group: isRtl ? "الذكاء والتحليل" : "INTELLIGENCE",
      items: [
        { id: "smart", label: t.smartEvolutionTitle || (isRtl ? "التطور الذكي" : "Smart Evolution"), icon: Brain },
        { id: "market", label: t.marketIntelligenceTitle || (isRtl ? "ذكاء السوق" : "Market Intelligence"), icon: TrendingUp },
        { id: "agent", label: t.aiAgentTitle || (isRtl ? "المستشار المعرفي" : "Cognitive Advisor"), icon: Sparkles },
      ]
    },
    {
      group: isRtl ? "الإدارة والأمان" : "MANAGEMENT",
      items: [
        { id: "alerts", label: t.riskAlertsTitle || (isRtl ? "تنبيهات المخاطر" : "Risk Alerts"), icon: ShieldAlert, badge: statsCount.activeRisks },
        { id: "gmail", label: isRtl ? "البريد" : (lang === "fr" ? "Messagerie" : "Email Vault"), icon: Mail },
        { id: "settings", label: t.settingsTitle || (isRtl ? "الإعدادات" : "Settings"), icon: SettingsIcon },
        { id: "support", label: isRtl ? "الدعم الفني" : (lang === "fr" ? "Support" : "Support Center"), icon: HelpCircle },
      ]
    }
  ];

  return (
    <div id="main-app-workspace" className="flex h-screen overflow-hidden font-geist bg-primary" dir={textDirection}>
      
      {/* MOBILE OVERLAY BACKDROP */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* DESKTOP & MOBILE RESPONSIVE SIDEBAR */}
      <aside 
        className={`flex flex-col bg-[#0b0f19] dark:bg-[#0b0f19] border-slate-800/60 shadow-2xl h-full relative z-30 transition-all duration-300 ease-in-out shrink-0 overflow-y-auto custom-scrollbar ${
          isSidebarCollapsed ? "md:w-20" : "md:w-64"
        } ${
          isRtl ? "border-l" : "border-r"
        } ${
          "max-md:fixed max-md:inset-y-0 max-md:z-50 max-md:w-64 max-md:" + (isRtl ? "right-0 border-l" : "left-0 border-r") + " " + (
            isMobileSidebarOpen 
              ? "max-md:translate-x-0" 
              : (isRtl ? "max-md:translate-x-full" : "max-md:-translate-x-full")
          )
        }`} 
        id="sidebar-container"
      >
        {/* Logo & Toggle Header */}
        <div className={`p-5 border-b border-slate-800/50 flex items-center shrink-0 ${
          isSidebarCollapsed ? "justify-center" : "justify-between"
        }`}>
          {!isSidebarCollapsed ? (
            <ZakirLogo theme={isCustomThemeActive ? "custom" : theme} size="sm" />
          ) : (
            <ZakirLogo iconOnly size={32} theme={isCustomThemeActive ? "custom" : theme} />
          )}

          {/* Desktop Sidebar Collapse Toggle Button */}
          <button
            onClick={toggleSidebarCollapse}
            className="hidden md:flex p-1.5 rounded-xl bg-slate-900/60 hover:bg-[#D4AF37]/10 text-slate-400 hover:text-[#D4AF37] border border-slate-800/80 transition-all cursor-pointer items-center justify-center group/toggle"
            title={isSidebarCollapsed ? (isRtl ? "توسيع الشريط الجانبي" : "Expand Sidebar") : (isRtl ? "طي الشريط الجانبي" : "Collapse Sidebar")}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg bg-slate-900/60 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected User Account Info - Clicking turns to Settings Account tab */}
        <div 
          onClick={() => {
            setActiveTab("settings");
            setSettingsActiveSubTab("account");
            setIsMobileSidebarOpen(false);
          }}
          className={`mx-3.5 my-4 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/50 hover:border-[#D4AF37]/40 rounded-2xl transition-all shrink-0 cursor-pointer group/profileCard ${
            isSidebarCollapsed ? "p-2.5 text-center flex justify-center" : "p-3 flex items-center gap-3"
          }`}
          title={isRtl ? "انقر لإدارة الحساب والصورة الشخصية" : "Click to manage account & profile photo"}
        >
          <div className="relative group/user shrink-0">
            {currentUser.avatarUrl ? (
              <img 
                src={currentUser.avatarUrl} 
                alt={currentUser.ownerName || currentUser.email} 
                className="w-9 h-9 rounded-xl object-cover border border-[#D4AF37]/50 shadow-md group-hover/profileCard:scale-105 transition-transform"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D4AF37] to-[#F5E0A5] flex items-center justify-center text-[#0F172A] font-extrabold text-xs shadow-md group-hover/profileCard:scale-105 transition-transform">
                {(currentUser.ownerName || currentUser.email).slice(0, 2).toUpperCase()}
              </div>
            )}

            {isSidebarCollapsed && (
              <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/user:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-2 bg-slate-950 text-white text-xs border border-slate-800 font-medium ${
                isRtl ? "right-full mr-3" : "left-full ml-3"
              }`}>
                <p className="font-bold text-white text-xs">{currentUser.ownerName || currentUser.email}</p>
                <p className="text-[10px] text-slate-400">{currentUser.role} • {isRtl ? "إعدادات الملف" : "Account Settings"}</p>
              </div>
            )}
          </div>

          {!isSidebarCollapsed && (
            <div className="overflow-hidden flex-1">
              <h4 className="text-xs font-bold truncate text-white leading-snug group-hover/profileCard:text-[#D4AF37] transition-colors">
                {currentUser.ownerName || currentUser.email}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[10px] text-slate-400 font-semibold truncate">{currentUser.role}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs Menu */}
        <nav className="px-3 py-1 space-y-4 shrink-0">
          {sidebarSections.map((section, idx) => {
            const filteredItems = section.items.filter((item) => {
              if (currentUser.role === "CEO") return true;
              if (!currentUser.powers) return true;
              switch (item.id) {
                case "files": return !!currentUser.powers.fileVault;
                case "library":
                case "add": return !!currentUser.powers.memoryVault;
                case "alerts": return !!currentUser.powers.riskRadar;
                case "market": return !!currentUser.powers.marketIntel;
                case "settings": return !!currentUser.powers.settings;
                default: return true;
              }
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1.5">
                {!isSidebarCollapsed && (
                  <div className="px-3 pt-1 pb-1 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]/90">
                    {section.group}
                  </div>
                )}
                {isSidebarCollapsed && idx > 0 && (
                  <div className="my-2 border-t border-slate-800/60 mx-3" />
                )}
                {filteredItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setIsMobileSidebarOpen(false);
                        }}
                        className={`w-full h-10 rounded-xl text-xs font-semibold flex items-center transition-all cursor-pointer relative ${
                          isSidebarCollapsed ? "justify-center px-0" : "justify-between px-3"
                        } ${
                          isActive 
                            ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 font-bold shadow-sm" 
                            : "text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent"
                        }`}
                      >
                        <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                          {!isSidebarCollapsed && (
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${isActive ? "bg-[#D4AF37] shadow-sm shadow-[#D4AF37]" : "bg-slate-800"}`} />
                          )}
                          <IconComponent className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-[#D4AF37]" : "text-slate-400 group-hover:text-white"}`} />
                          
                          {!isSidebarCollapsed && (
                            <span className="truncate max-w-[140px] leading-tight text-[12.5px]">{item.label}</span>
                          )}
                        </div>

                        {/* Badge when expanded */}
                        {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                            isActive ? "bg-[#D4AF37] text-[#0F172A]" : "bg-rose-500 text-white"
                          }`}>
                            {item.badge}
                          </span>
                        )}

                        {/* Small active badge dot when collapsed */}
                        {isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#0b0f19]" />
                        )}
                      </button>

                      {/* Tooltip on Hover when Collapsed */}
                      {isSidebarCollapsed && (
                        <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-1.5 bg-slate-950 text-white text-xs border border-slate-800 font-medium flex items-center gap-2 ${
                          isRtl ? "right-full mr-3" : "left-full ml-3"
                        }`}>
                          <span>{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions Area */}
        <div className={`mt-auto pt-4 pb-6 px-3 border-t border-slate-800/60 space-y-3.5 shrink-0 ${isSidebarCollapsed ? "text-center" : ""}`}>
          
          {!isSidebarCollapsed && <InstallPrompt lang={lang} />}
          
          {/* Active Subscription Pill Button */}
          <div className="relative group/starter">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setSettingsActiveSubTab("subscription");
                  setIsMobileSidebarOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 text-slate-200 hover:text-[#D4AF37] transition-all flex items-center justify-between group/btn cursor-pointer shadow-sm"
              >
                <span className="text-xs font-bold tracking-wide">
                  {currentUser.subscriptionPlan || "Starter"}
                </span>
                <div className="flex items-center gap-1.5 text-[#D4AF37]">
                  <CreditCard className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveTab("settings");
                  setSettingsActiveSubTab("subscription");
                }}
                className="w-10 h-10 mx-auto rounded-xl bg-slate-900/60 hover:bg-[#D4AF37]/20 border border-slate-800 hover:border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/starter:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-1.5 bg-slate-950 text-white text-xs border border-slate-800 font-medium ${
                  isRtl ? "right-full mr-3" : "left-full ml-3"
                }`}>
                  {isRtl ? `اشتراك ${currentUser.subscriptionPlan || "Starter"}` : `${currentUser.subscriptionPlan || "Starter"} Subscription`}
                </div>
              </button>
            )}
          </div>

          {/* 1-day Trial Countdown Widget */}
          <div className="relative group/trial">
            {!isSidebarCollapsed ? (
              <div className="p-3 bg-slate-900/30 border border-slate-800/60 rounded-xl">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#D4AF37] mb-1">
                  <span>{t.daysLeft}</span>
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                </div>
                <div className="text-xs font-mono font-black text-center tracking-wider text-white">
                  {timeLeftStr}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 block leading-tight">
                  {t.mandatoryPayAlert}
                </span>
              </div>
            ) : (
              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-center cursor-pointer hover:border-[#D4AF37]/40 text-[#D4AF37] group-hover/trial:scale-105 transition-transform">
                <Clock className="w-4 h-4" />
                <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/trial:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-2 bg-slate-950 text-white text-xs border border-slate-800 font-medium ${
                  isRtl ? "right-full mr-3" : "left-full ml-3"
                }`}>
                  <p className="font-bold text-[#D4AF37]">{t.daysLeft}: {timeLeftStr}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.mandatoryPayAlert}</p>
                </div>
              </div>
            )}
          </div>

          {/* Theme & Language Selectors */}
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              {/* Language Controls */}
              <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-800/80">
                {(["en", "ar", "fr"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleLanguage(l)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      lang === l ? "bg-[#D4AF37] text-[#0F172A]" : "text-slate-400"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Theme Toggles */}
              <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-800/80">
                {(["light", "dark"] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => toggleTheme(th)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      theme === th ? "bg-[#D4AF37] text-[#0F172A]" : "text-slate-400"
                    }`}
                  >
                    {th === "light" ? t.light : t.dark}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              {/* Compact Language Cycling Button */}
              <div className="relative group/lang">
                <button
                  onClick={() => {
                    const nextLang = lang === "ar" ? "en" : (lang === "en" ? "fr" : "ar");
                    toggleLanguage(nextLang);
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-[#D4AF37] font-extrabold text-[11px] border border-slate-800/80 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  {lang.toUpperCase()}
                </button>
                <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/lang:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-1.5 bg-slate-950 text-white text-xs border border-slate-800 font-medium ${
                  isRtl ? "right-full mr-3" : "left-full ml-3"
                }`}>
                  {isRtl ? "العربية (انقر للتغيير)" : (lang === "fr" ? "Français (cliquer)" : "English (click to switch)")}
                </div>
              </div>

              {/* Compact Theme Toggle Button */}
              <div className="relative group/theme">
                <button
                  onClick={() => toggleTheme(theme === "dark" ? "light" : "dark")}
                  className="w-10 h-10 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800/80 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                </button>
                <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/theme:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-1.5 bg-slate-950 text-white text-xs border border-slate-800 font-medium ${
                  isRtl ? "right-full mr-3" : "left-full ml-3"
                }`}>
                  {theme === "dark" ? (isRtl ? "الوضع الفاتح" : "Light Mode") : (isRtl ? "الوضع الداكن" : "Dark Mode")}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <div className="relative group/logout">
            <button
              onClick={handleLogout}
              className={`w-full border border-slate-800/80 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                isSidebarCollapsed ? "h-10 w-10 px-0 mx-auto" : "h-10 px-3 gap-2 text-slate-400"
              }`}
            >
              <LogOut className="w-4 h-4 text-slate-400 group-hover/logout:text-rose-400 transition-colors" />
              {!isSidebarCollapsed && <span>{t.logout}</span>}
            </button>
            {isSidebarCollapsed && (
              <div className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover/logout:opacity-100 transition-all duration-200 whitespace-nowrap shadow-2xl rounded-xl px-3 py-1.5 bg-slate-950 text-rose-400 text-xs border border-slate-800 font-medium ${
                isRtl ? "right-full mr-3" : "left-full ml-3"
              }`}>
                {t.logout}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA CONTAINER */}
      <main className="flex-1 overflow-y-auto relative h-full bg-[#0b0f19] dark:bg-[#0b0f19] text-white">
        {/* Smooth Top Progress Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-transparent overflow-hidden z-[999] pointer-events-none">
            <div className="h-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 w-1/3 rounded-full animate-[loading-bar_1.2s_infinite_linear]"></div>
          </div>
        )}
        
        {/* Module Loader header */}
        <header className={`px-6 md:px-8 h-18 border-b flex items-center justify-between sticky top-0 z-20 backdrop-blur-md bg-[#0b0f19]/85 border-slate-800/60`}>
          <div className="flex items-center gap-3">
            {/* Mobile Menu Open Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Toggle Mobile Sidebar"
            >
              <Menu className="w-5 h-5 text-[#D4AF37]" />
            </button>
            
            {/* Page Title & Context indicator */}
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] text-slate-400 tracking-wider font-extrabold uppercase leading-none mb-1">
                {isRtl ? "نظام زاكير المعرفي" : "Zakir Causal Vault"}
              </span>
              <h2 className="text-sm font-bold text-slate-200 capitalize">
                {activeTab}
              </h2>
            </div>
            
            {/* Visual Accent Subscription Badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[10px] font-black uppercase tracking-wider">{currentUser.subscriptionPlan || "Starter"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`h-10 px-4 border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer text-slate-300 ${
                isRefreshing ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t.refresh}</span>
            </button>

            {/* Header User Profile Button */}
            <button
              onClick={() => {
                setActiveTab("settings");
                setSettingsActiveSubTab("account");
              }}
              className="h-10 px-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group/topAvatar"
              title={isRtl ? "إعدادات الحساب والصورة" : "Account & Profile Photo Settings"}
            >
              {currentUser.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.ownerName || currentUser.email} 
                  className="w-6 h-6 rounded-lg object-cover border border-[#D4AF37]/50"
                />
              ) : (
                <div className="w-6 h-6 rounded-lg bg-[#D4AF37] text-[#0F172A] font-black text-[10px] flex items-center justify-center">
                  {(currentUser.ownerName || currentUser.email).slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden md:inline text-xs font-bold text-slate-300 group-hover/topAvatar:text-[#D4AF37] transition-colors">
                {currentUser.ownerName || currentUser.email.split("@")[0]}
              </span>
            </button>
          </div>
        </header>

        {/* APP CONTENT VIEWS CONTROLLER */}
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">

          {/* INCOMING WORKSPACE INVITATION WARNING / ACTION BANNER */}
          {incomingInvitation && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-amber-500/5 shadow-2xl relative overflow-hidden backdrop-blur-md"
            >
              {/* Glowing ambient dots */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    <h2 className="text-lg font-black tracking-tight text-amber-400 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-400" />
                      {isRtl ? "دعوة انضمام معلقة لمؤسسة جديدة" : (lang === "fr" ? "Invitation d'Espace de Travail en Attente" : "Pending Workspace Invitation")}
                    </h2>
                  </div>
                  
                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    {isRtl 
                      ? `لقد أرسل لك المدير التنفيذي (${incomingInvitation.senderEmail}) دعوة للانضمام إلى مساحة عمل مؤسسة "${incomingInvitation.companyName}" بالصلاحيات والميزات المحددة أدناه:` 
                      : lang === "fr"
                      ? `Le PDG (${incomingInvitation.senderEmail}) vous a invité à rejoindre l'espace de travail de l'entreprise "${incomingInvitation.companyName}" avec le rôle et les autorisations de module spécifiés ci-dessous :`
                      : `The CEO (${incomingInvitation.senderEmail}) has invited you to join the company workspace of "${incomingInvitation.companyName}" with the specific role and module authorizations listed below:`}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">{isRtl ? "الدور المخصص:" : (lang === "fr" ? "Rôle Désigné :" : "Designated Role:")}</p>
                        <p className="text-xs font-bold text-white">{incomingInvitation.role}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                      <Building className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-[10px] text-slate-400">{isRtl ? "اسم المؤسسة:" : (lang === "fr" ? "Nom de l'Entreprise :" : "Company Name:")}</p>
                        <p className="text-xs font-bold text-white">{incomingInvitation.companyName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Display Designated Permissions Matrix */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      {isRtl ? "الصلاحيات والميزات التي ستمنح لك:" : (lang === "fr" ? "Pouvoirs & Accès Accordés :" : "Designated Workspace Powers:")}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                        incomingInvitation.powers?.fileVault 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                      }`}>
                        <span>📁 {isRtl ? "إدارة الملفات" : "File Vault"}</span>
                        <span className="text-[9px] opacity-80">{incomingInvitation.powers?.fileVault ? (isRtl ? "مسموح" : "Allowed") : (isRtl ? "محظور" : "Blocked")}</span>
                      </span>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                        incomingInvitation.powers?.memoryVault 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                      }`}>
                        <span>🧠 {isRtl ? "مكتبة الذكريات" : "Memory Vault"}</span>
                        <span className="text-[9px] opacity-80">{incomingInvitation.powers?.memoryVault ? (isRtl ? "مسموح" : "Allowed") : (isRtl ? "محظور" : "Blocked")}</span>
                      </span>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                        incomingInvitation.powers?.riskRadar 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                      }`}>
                        <span>⚠️ {isRtl ? "رادار المخاطر" : "Risk Radar"}</span>
                        <span className="text-[9px] opacity-80">{incomingInvitation.powers?.riskRadar ? (isRtl ? "مسموح" : "Allowed") : (isRtl ? "محظور" : "Blocked")}</span>
                      </span>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                        incomingInvitation.powers?.marketIntel 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                      }`}>
                        <span>📊 {isRtl ? "استخبارات السوق" : "Market Intel"}</span>
                        <span className="text-[9px] opacity-80">{incomingInvitation.powers?.marketIntel ? (isRtl ? "مسموح" : "Allowed") : (isRtl ? "محظور" : "Blocked")}</span>
                      </span>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${
                        incomingInvitation.powers?.settings 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-slate-800/40 border-slate-800 text-slate-500 line-through"
                      }`}>
                        <span>⚙️ {isRtl ? "إعدادات النظام" : "System Settings"}</span>
                        <span className="text-[9px] opacity-80">{incomingInvitation.powers?.settings ? (isRtl ? "مسموح" : "Allowed") : (isRtl ? "محظور" : "Blocked")}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-row flex-col items-stretch sm:items-center gap-3 shrink-0">
                  <button
                    onClick={handleDeclineInvitation}
                    className="px-5 py-2.5 rounded-xl border border-rose-500/30 hover:border-rose-500 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>{isRtl ? "رفض الدعوة" : (lang === "fr" ? "Décliner" : "Decline")}</span>
                  </button>

                  <button
                    onClick={() => handleAcceptInvitation(incomingInvitation)}
                    className="px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-slate-950 font-extrabold text-xs transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isRtl ? "الموافقة والانضمام للمؤسسة" : (lang === "fr" ? "Accepter & Rejoindre" : "Accept & Join Workspace")}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Children holds the actual module pages */}
          {children}

        </div>
      </main>
    </div>
  );
};
