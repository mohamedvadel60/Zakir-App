import React from "react";
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  RotateCcw, 
  FileCheck, 
  LifeBuoy, 
  ArrowUpRight, 
  AlertCircle, 
  CheckCircle2
} from "lucide-react";
import { AdminTab, PendingApprovalRecord, RecoveryRequestRecord } from "../adminTypes.js";
import { AdminUserRecord } from "../../../lib/firebaseServices.js";
import { SupportTicket } from "../../../types.js";
import { safeFormatDate } from "../../../lib/dateUtils.js";

interface AdminOverviewTabProps {
  users: AdminUserRecord[];
  pendingApprovals: PendingApprovalRecord[];
  recoveryRequests: RecoveryRequestRecord[];
  supportTickets: SupportTicket[];
  onNavigateTab: (tab: AdminTab, filterParam?: string) => void;
  onOpenUserDetail: (user: AdminUserRecord) => void;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  users,
  pendingApprovals,
  recoveryRequests,
  supportTickets,
  onNavigateTab,
  onOpenUserDetail,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  // Calculations
  const totalUsersCount = users.length;
  
  // New users within last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newUsersCount = users.filter((u) => {
    try {
      const createdTime = u.createdAt ? new Date(u.createdAt).getTime() : 0;
      return createdTime >= sevenDaysAgo;
    } catch {
      return false;
    }
  }).length;

  // Accounts requiring review (verification required, document required, under review, not approved)
  const accountsNeedingReview = users.filter((u) => {
    const full = u.fullUser || ({} as any);
    const status = String(full.accountStatus || (u as any).accountStatus || "").toUpperCase();
    const verStatus = String(full.documentVerificationStatus || (u as any).documentVerificationStatus || "").toUpperCase();
    return (
      status === "PENDING_ADMIN_REVIEW" ||
      status === "VERIFICATION_REQUIRED" ||
      status === "PENDING_DOCUMENT_VERIFICATION" ||
      verStatus === "UNDER_REVIEW" ||
      verStatus === "ACTION_REQUIRED" ||
      String(u.verificationInfo?.status) === "pending_review" ||
      String(u.verificationInfo?.status) === "action_required"
    );
  });

  // Pending verification requests
  const pendingDocsCount = pendingApprovals.filter(
    (a) => String(a.accountStatus || "").toUpperCase() !== "APPROVED"
  ).length;

  // Pending recovery requests
  const pendingRecoveryCount = recoveryRequests.filter(
    (r) => r.status === "pending"
  ).length;

  // Open support tickets
  const openTicketsCount = supportTickets.filter(
    (t) => t.status === "Open" || t.status === "In Progress"
  ).length;

  const t = {
    title: isAr ? "نظرة عامة والعمليات الفورية" : isFr ? "Vue d'ensemble Opérationnelle" : "Operations Overview",
    subtitle: isAr ? "مؤشرات حية وإجراءات سريعة لاتخاذ القرارات الإدارية" : isFr ? "Indicateurs en direct et actions rapides" : "Live platform telemetry & quick actionable decisions",
    totalUsers: isAr ? "إجمالي المستخدمين" : isFr ? "Total Utilisateurs" : "Total Users",
    newUsers: isAr ? "المستخدمون الجدد (7 أيام)" : isFr ? "Nouveaux (7 jours)" : "New Users (7d)",
    needReview: isAr ? "حسابات تحتاج مراجعة" : isFr ? "Comptes à examiner" : "Accounts Needing Review",
    pendingVerifications: isAr ? "طلبات التوثيق المعلقة" : isFr ? "Vérifications en attente" : "Pending Verifications",
    pendingRecovery: isAr ? "طلبات الاستعادة المعلقة" : isFr ? "Récupérations en attente" : "Pending Recoveries",
    openTickets: isAr ? "تذاكر الدعم المفتوحة" : isFr ? "Tickets de support ouverts" : "Open Support Tickets",
    actionQueueTitle: isAr ? "قائمة الإجراءات التي تتطلب تدخل المشرف" : isFr ? "Actions requérant une intervention" : "Action Items Requiring Decision",
    noActions: isAr ? "لا توجد طلبات معلقة تتطلب اتخاذ إجراء حاليًا. النظام يعمل بسلاسة." : isFr ? "Aucune action en attente. Tout est à jour." : "No urgent action items. Platform is running cleanly.",
    viewAll: isAr ? "عرض الكل" : isFr ? "Voir tout" : "View All",
    directAction: isAr ? "اتخاذ إجراء" : isFr ? "Prendre action" : "Take Action"
  };

  const renderKpiIcon = (id: string, color: string) => {
    const cls = `w-5 h-5 ${color}`;
    switch (id) {
      case "users_total": return <Users className={cls} />;
      case "users_new": return <UserPlus className={cls} />;
      case "accounts_review": return <ShieldAlert className={cls} />;
      case "verifications_pending": return <FileCheck className={cls} />;
      case "recovery_pending": return <RotateCcw className={cls} />;
      case "support_open": return <LifeBuoy className={cls} />;
      default: return <Users className={cls} />;
    }
  };

  const kpis = [
    {
      id: "users_total",
      title: t.totalUsers,
      count: totalUsersCount,
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/20",
      action: () => onNavigateTab("users", "all")
    },
    {
      id: "users_new",
      title: t.newUsers,
      count: newUsersCount,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      action: () => onNavigateTab("users", "new")
    },
    {
      id: "accounts_review",
      title: t.needReview,
      count: accountsNeedingReview.length,
      color: "text-amber-500",
      bg: "bg-amber-500/10 border-amber-500/20",
      action: () => onNavigateTab("users", "pending")
    },
    {
      id: "verifications_pending",
      title: t.pendingVerifications,
      count: pendingDocsCount,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10 border-indigo-500/20",
      action: () => onNavigateTab("verifications")
    },
    {
      id: "recovery_pending",
      title: t.pendingRecovery,
      count: pendingRecoveryCount,
      color: "text-purple-500",
      bg: "bg-purple-500/10 border-purple-500/20",
      action: () => onNavigateTab("recovery")
    },
    {
      id: "support_open",
      title: t.openTickets,
      count: openTicketsCount,
      color: "text-rose-500",
      bg: "bg-rose-500/10 border-rose-500/20",
      action: () => onNavigateTab("support")
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* 6 Clickable KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {kpis.map((kpi) => {
          return (
            <button
              key={kpi.id}
              onClick={kpi.action}
              type="button"
              className={`p-4 rounded-xl border text-start transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md ${
                theme === "dark" 
                  ? "bg-[#090D16]/90 border-slate-800/80 hover:border-slate-700" 
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-2.5 rounded-lg border ${kpi.bg}`}>
                  {renderKpiIcon(kpi.id, kpi.color)}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-blue-500 transition-colors">
                  <span>{t.directAction}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {kpi.count}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  {kpi.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Immediate Attention Queue */}
      <div 
        className={`rounded-xl border overflow-hidden ${
          theme === "dark" ? "bg-[#090D16]/90 border-slate-800/80" : "bg-white border-slate-200"
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold">{t.actionQueueTitle}</h2>
          </div>
          <div className="text-xs font-semibold text-slate-400">
            {accountsNeedingReview.length + pendingRecoveryCount + openTicketsCount} {isAr ? "مهمة" : "items"}
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {/* List of accounts needing review */}
          {accountsNeedingReview.slice(0, 4).map((u) => (
            <div 
              key={u.id}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {(u.email || "U")[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{u.companyName || u.ownerName || u.email}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {isAr ? "مراجعة مطلوبة" : "Review Required"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {u.email} • {safeFormatDate(u.createdAt, isAr ? "ar" : "en")}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenUserDetail(u)}
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
              >
                {isAr ? "فحص الحساب" : "Inspect Account"}
              </button>
            </div>
          ))}

          {/* List of recovery requests */}
          {recoveryRequests.filter((r) => r.status === "pending").slice(0, 3).map((r) => (
            <div 
              key={r.id || r.requestId}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{r.email}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      {isAr ? "طلب استعادة" : "Account Recovery"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                    {r.reason || (isAr ? "استعادة حساب محذوف" : "Restore deleted account")}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab("recovery")}
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
              >
                {isAr ? "معالجة الطلب" : "Handle Request"}
              </button>
            </div>
          ))}

          {/* Open support tickets */}
          {supportTickets.filter((t) => t.status === "Open").slice(0, 3).map((ticket) => (
            <div 
              key={ticket.id}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{ticket.subject}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {isAr ? "تذكرة مفتوحة" : "Open Ticket"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {ticket.userName || ticket.userEmail} • {ticket.category}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab("support")}
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
              >
                {isAr ? "الرد على التذكرة" : "Reply to Ticket"}
              </button>
            </div>
          ))}

          {accountsNeedingReview.length === 0 && pendingRecoveryCount === 0 && openTicketsCount === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>{t.noActions}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
