import React, { useState } from "react";
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  Users, 
  RefreshCw, 
  ShieldCheck, 
  Sliders, 
  Sparkles,
  ExternalLink,
  Edit3,
  Calendar,
  Layers,
  HelpCircle,
  Search
} from "lucide-react";
import { SubscriptionStats, SubscriptionCorrectionRecord } from "../adminTypes.js";
import { AdminUserRecord } from "../../../lib/firebaseServices.js";
import { safeFormatDate } from "../../../lib/dateUtils.js";

interface AdminSubscriptionsTabProps {
  stats: SubscriptionStats;
  corrections: SubscriptionCorrectionRecord[];
  users: AdminUserRecord[];
  onResolveCorrection: (requestId: string, userId: string, action: "APPROVE" | "REJECT", targetPlan?: string, notes?: string) => Promise<void>;
  onAssignUserPlan: (userId: string, plan: string, status: string, notes?: string) => Promise<void>;
  onOpenUserDetail: (user: AdminUserRecord) => void;
  loading: boolean;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminSubscriptionsTab: React.FC<AdminSubscriptionsTabProps> = ({
  stats,
  corrections,
  users,
  onResolveCorrection,
  onAssignUserPlan,
  onOpenUserDetail,
  loading,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  // Fast Allocator state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<string>("Professional");
  const [selectedStatus, setSelectedStatus] = useState<string>("Active");
  const [notesInput, setNotesInput] = useState<string>("");
  const [allocating, setAllocating] = useState<boolean>(false);
  const [allocFeedback, setAllocFeedback] = useState<string | null>(null);

  // Correction handling state
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Subscriptions Table Search & Filter
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const t = {
    title: isAr ? "إدارة الاشتراكات والتراخيص" : isFr ? "Gestion des Abonnements" : "Subscriptions & Licensing Hub",
    subtitle: isAr ? "بيانات حقيقية للاشتراكات والتراخيص المؤسسية عبر المنصة" : isFr ? "Données réelles des licences et abonnements" : "Live platform subscription records & licensing oversight",
    totalPaid: isAr ? "الاشتراكات المدفوعة" : isFr ? "Abonnements payants" : "Active Paid Licenses",
    trials: isAr ? "فترات تجريبية نشطة" : isFr ? "Essais en cours" : "Active Trials",
    correctionsTitle: isAr ? "طلبات تصحيح الاشتراكات المعلقة" : isFr ? "Demandes de correction" : "Subscription Correction Requests",
    noCorrections: isAr ? "لا توجد طلبات تصحيح اشتراكات معلقة." : isFr ? "Aucune demande de correction." : "No pending correction requests.",
    allocatorTitle: isAr ? "تخصيص رخصة أو ترقية باقة" : isFr ? "Attribution rapide de licence" : "Fast License Allocation",
    selectUser: isAr ? "اختر المستخدم" : isFr ? "Choisir l'utilisateur" : "Select User",
    choosePlan: isAr ? "الباقة" : isFr ? "Forfait" : "Subscription Tier",
    chooseStatus: isAr ? "حالة الاشتراك" : isFr ? "Statut" : "Status",
    assignBtn: isAr ? "تطبيق التعديل وحفظ التراخيص" : isFr ? "Appliquer la licence" : "Apply License",
    approveCorrection: isAr ? "الموافقة والترقية" : isFr ? "Approuver" : "Approve & Upgrade",
    rejectCorrection: isAr ? "رفض الطلب" : isFr ? "Rejeter" : "Reject",
    tableTitle: isAr ? "سجل الاشتراكات والتراخيص لجميع الحسابات" : isFr ? "Registre des Licences Utilisateurs" : "User Licensing Registry",
    colUser: isAr ? "المستخدم" : isFr ? "Utilisateur" : "User",
    colPlan: isAr ? "الباقة" : isFr ? "Forfait" : "Tier",
    colStatus: isAr ? "الحالة" : isFr ? "Statut" : "Status",
    colStripe: isAr ? "بيانات Stripe" : isFr ? "Identifiants Stripe" : "Stripe Info",
    colDates: isAr ? "فترة الاشتراك / التجربة" : isFr ? "Période" : "Subscription Dates",
    colActions: isAr ? "إجراء" : isFr ? "Action" : "Action",
    editPlan: isAr ? "تعديل" : isFr ? "Modifier" : "Edit",
    notAvailable: isAr ? "غير متوفر" : isFr ? "Non disponible" : "Not available"
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setAllocating(true);
    setAllocFeedback(null);
    try {
      await onAssignUserPlan(selectedUserId, selectedPlan, selectedStatus, notesInput);
      setAllocFeedback(isAr ? "تم تحديث ترخيص المستخدم بنجاح." : "User license updated successfully.");
      setNotesInput("");
    } finally {
      setAllocating(false);
    }
  };

  const handleCorrectionDecision = async (
    corr: SubscriptionCorrectionRecord,
    action: "APPROVE" | "REJECT"
  ) => {
    setResolvingId(corr.id);
    try {
      await onResolveCorrection(
        corr.id,
        corr.userId,
        action,
        corr.requestedPlan,
        `Resolved by admin as ${action}`
      );
    } finally {
      setResolvingId(null);
    }
  };

  const filteredSubUsers = users.filter((u) => {
    const full = u.fullUser || ({} as any);
    const plan = (full.subscriptionPlan || (u as any).subscriptionPlan || "Starter").toLowerCase();
    if (planFilter !== "all" && !plan.includes(planFilter.toLowerCase())) return false;
    if (subSearchQuery) {
      const q = subSearchQuery.toLowerCase();
      const email = (u.email || "").toLowerCase();
      const name = (u.ownerName || u.companyName || "").toLowerCase();
      if (!email.includes(q) && !name.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t.subtitle}
        </p>
      </div>

      {/* Subscription Breakdown Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          {
            name: "Enterprise",
            count: stats.plans.Enterprise,
            color: "text-purple-500",
            bg: "bg-purple-500/10 border-purple-500/20"
          },
          {
            name: "Professional",
            count: stats.plans.Professional,
            color: "text-blue-500",
            bg: "bg-blue-500/10 border-blue-500/20"
          },
          {
            name: "Starter",
            count: stats.plans.Starter,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10 border-emerald-500/20"
          },
          {
            name: "Free / Trial",
            count: stats.plans.Free,
            color: "text-amber-500",
            bg: "bg-amber-500/10 border-amber-500/20"
          }
        ].map((plan) => (
          <div
            key={plan.name}
            className={`p-4 rounded-xl border transition-colors ${
              theme === "dark" 
                ? "bg-[#090D16] border-slate-800 text-slate-100" 
                : "bg-white border-slate-200 text-slate-900 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">{plan.name}</span>
              <div className={`p-1.5 rounded-lg border ${plan.bg}`}>
                <CreditCard className={`w-3.5 h-3.5 ${plan.color}`} />
              </div>
            </div>
            <div className="text-2xl font-extrabold mt-3">{plan.count}</div>
          </div>
        ))}
      </div>

      {/* User Licensing Registry Table (Real Subscriptions) */}
      <div 
        className={`rounded-xl border overflow-hidden transition-colors ${
          theme === "dark" ? "bg-[#090D16] border-slate-800" : "bg-white border-slate-200 shadow-xs"
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.tableTitle}</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                placeholder={isAr ? "بحث بالبريد..." : "Search user..."}
                className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-hidden"
              />
            </div>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="all">{isAr ? "جميع الخطط" : "All Plans"}</option>
              <option value="enterprise">Enterprise</option>
              <option value="professional">Professional</option>
              <option value="starter">Starter</option>
              <option value="free">Free / Trial</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead 
              className={`text-[11px] uppercase font-semibold border-b ${
                theme === "dark" 
                  ? "bg-slate-900/80 border-slate-800 text-slate-300" 
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <tr>
                <th className="py-3 px-4 text-start">{t.colUser}</th>
                <th className="py-3 px-4 text-start">{t.colPlan}</th>
                <th className="py-3 px-4 text-start">{t.colStatus}</th>
                <th className="py-3 px-4 text-start">{t.colStripe}</th>
                <th className="py-3 px-4 text-start">{t.colDates}</th>
                <th className="py-3 px-4 text-end">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSubUsers.map((u) => {
                const full = u.fullUser || ({} as any);
                const plan = full.subscriptionPlan || (u as any).subscriptionPlan || "Starter";
                const status = full.subscriptionStatus || (u as any).subscriptionStatus || "Trial";
                const stripeSub = full.stripeSubscriptionId || (u as any).stripeSubscriptionId || null;
                const stripeCust = full.stripeCustomerId || (u as any).stripeCustomerId || null;
                const trialEnd = full.trialEndsAt || (u as any).trialEndsAt || null;

                return (
                  <tr 
                    key={u.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                        {u.ownerName || u.companyName || u.email?.split("@")[0]}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {u.email}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {plan}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          status === "Active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : status === "Trial"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>

                    {/* Stripe Information */}
                    <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                      {stripeSub || stripeCust ? (
                        <div className="font-mono text-[10px]">
                          <div>Sub: {stripeSub || t.notAvailable}</div>
                          <div>Cust: {stripeCust || t.notAvailable}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">{t.notAvailable}</span>
                      )}
                    </td>

                    {/* Subscription / Trial Dates */}
                    <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                      {trialEnd ? (
                        <div>
                          <span>Trial Ends: </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {safeFormatDate(trialEnd, isAr ? "ar" : "en")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">{t.notAvailable}</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-end">
                      <button
                        onClick={() => onOpenUserDetail(u)}
                        type="button"
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                      >
                        {t.editPlan}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocator and Corrections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Fast Allocator */}
        <div 
          className={`lg:col-span-5 p-5 rounded-2xl border transition-colors ${
            theme === "dark" ? "bg-[#090D16] border-slate-800 text-slate-100" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold">{t.allocatorTitle}</h2>
          </div>

          <form onSubmit={handleAllocate} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">{t.selectUser}</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className={`w-full text-xs p-2.5 rounded-xl border outline-hidden ${
                  theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="">{isAr ? "-- اختر مستخدمًا من النظام --" : "-- Select User --"}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ownerName || u.companyName || u.email} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.choosePlan}</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className={`w-full text-xs p-2.5 rounded-xl border outline-hidden ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="Starter">Starter</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.chooseStatus}</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`w-full text-xs p-2.5 rounded-xl border outline-hidden ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="Active">Active</option>
                  <option value="Trial">Trial</option>
                  <option value="Free Tier">Free Tier</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {isAr ? "ملاحظات إدارية" : "Admin Notes"}
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder={isAr ? "سبب التخصيص أو رقم المعاملة..." : "Reason..."}
                className={`w-full text-xs p-2.5 rounded-xl border outline-hidden ${
                  theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              />
            </div>

            {allocFeedback && (
              <div className="p-2.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {allocFeedback}
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedUserId || allocating}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {allocating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{t.assignBtn}</span>
            </button>
          </form>
        </div>

        {/* Pending Subscription Corrections */}
        <div 
          className={`lg:col-span-7 p-5 rounded-2xl border transition-colors ${
            theme === "dark" ? "bg-[#090D16] border-slate-800 text-slate-100" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold">{t.correctionsTitle}</h2>
            <span className="text-xs text-slate-400">
              {corrections.filter((c) => c.status === "PENDING").length} {isAr ? "معلقة" : "pending"}
            </span>
          </div>

          <div className="space-y-3">
            {corrections.filter((c) => c.status === "PENDING").map((corr) => (
              <div
                key={corr.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {corr.userName || corr.userEmail}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">{corr.currentPlan}</span>
                    <span>→</span>
                    <span className="font-bold text-blue-500">{corr.requestedPlan}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {corr.reason}
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-slate-400">{safeFormatDate(corr.createdAt, isAr ? "ar" : "en")}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCorrectionDecision(corr, "APPROVE")}
                      disabled={resolvingId === corr.id}
                      type="button"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                    >
                      {t.approveCorrection}
                    </button>
                    <button
                      onClick={() => handleCorrectionDecision(corr, "REJECT")}
                      disabled={resolvingId === corr.id}
                      type="button"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
                    >
                      {t.rejectCorrection}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {corrections.filter((c) => c.status === "PENDING").length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <span>{t.noCorrections}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
