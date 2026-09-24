import React from "react";
import { 
  LayoutDashboard, 
  Users, 
  ShieldCheck, 
  RotateCcw, 
  LifeBuoy, 
  CreditCard
} from "lucide-react";
import { AdminTab } from "./adminTypes.js";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
  badges: {
    totalUsers?: number;
    pendingVerifications?: number;
    pendingRecovery?: number;
    openTickets?: number;
    pendingCorrections?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  lang,
  theme,
  badges
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const renderNavIcon = (id: AdminTab, isActive: boolean) => {
    const cls = `w-4 h-4 ${isActive ? "text-blue-500" : "text-slate-400"}`;
    switch (id) {
      case "overview": return <LayoutDashboard className={cls} />;
      case "users": return <Users className={cls} />;
      case "verifications": return <ShieldCheck className={cls} />;
      case "recovery": return <RotateCcw className={cls} />;
      case "support": return <LifeBuoy className={cls} />;
      case "subscriptions": return <CreditCard className={cls} />;
      default: return <LayoutDashboard className={cls} />;
    }
  };

  const navItems: {
    id: AdminTab;
    label: string;
    badgeCount?: number;
    badgeColor?: string;
  }[] = [
    {
      id: "overview",
      label: isAr ? "نظرة عامة" : isFr ? "Vue d'ensemble" : "Overview"
    },
    {
      id: "users",
      label: isAr ? "المستخدمون والحسابات" : isFr ? "Utilisateurs & Comptes" : "Users & Accounts",
      badgeCount: badges.totalUsers,
      badgeColor: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
    },
    {
      id: "verifications",
      label: isAr ? "التوثيق والمراجعة" : isFr ? "Vérifications" : "Verifications",
      badgeCount: badges.pendingVerifications,
      badgeColor: (badges.pendingVerifications || 0) > 0 
        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
        : undefined
    },
    {
      id: "recovery",
      label: isAr ? "استعادة الحسابات" : isFr ? "Récupération Comptes" : "Account Recovery",
      badgeCount: badges.pendingRecovery,
      badgeColor: (badges.pendingRecovery || 0) > 0 
        ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30" 
        : undefined
    },
    {
      id: "support",
      label: isAr ? "تذاكر الدعم الفني" : isFr ? "Support Technique" : "Support Tickets",
      badgeCount: badges.openTickets,
      badgeColor: (badges.openTickets || 0) > 0 
        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30" 
        : undefined
    },
    {
      id: "subscriptions",
      label: isAr ? "الاشتراكات والتراخيص" : isFr ? "Abonnements" : "Subscriptions",
      badgeCount: badges.pendingCorrections,
      badgeColor: (badges.pendingCorrections || 0) > 0 
        ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30" 
        : undefined
    }
  ];

  return (
    <aside
      className={`w-64 shrink-0 h-full min-h-full border-e flex flex-col justify-between transition-colors select-none ${
        theme === "dark" 
          ? "bg-[#090D16]/95 border-slate-800/80" 
          : "bg-slate-50/70 border-slate-200"
      }`}
    >
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
          {isAr ? "مركز القيادة والتحكم" : isFr ? "CENTRE DE CONTRÔLE" : "CONTROL CENTER"}
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              type="button"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? theme === "dark"
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs"
                    : "bg-blue-50 text-blue-700 border border-blue-200 shadow-xs"
                  : theme === "dark"
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {renderNavIcon(item.id, isActive)}
                <span>{item.label}</span>
              </div>

              {typeof item.badgeCount === "number" && item.badgeCount > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.badgeColor || "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-400 dark:text-slate-500">
        <div className="flex items-center justify-between">
          <span>ZAKIR Enterprise</span>
          <span className="font-mono text-[10px] bg-slate-200/60 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">v2.5</span>
        </div>
      </div>
    </aside>
  );
};
