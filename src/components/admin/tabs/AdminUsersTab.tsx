import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Shield, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX,
  CreditCard,
  FileText,
  Calendar,
  Building,
  RefreshCw,
  MoreVertical,
  CheckSquare,
  Square,
  MinusSquare,
  Users,
  ShieldAlert,
  ArrowUpDown,
  MailCheck,
  MailWarning,
  FileCheck2,
  FileQuestion,
  FileX,
  Edit,
  Sliders,
  Check,
  X
} from "lucide-react";
import { AdminUserRecord, computeUserVerificationBreakdown } from "../../../lib/firebaseServices.js";
import { safeFormatDate } from "../../../lib/dateUtils.js";

interface AdminUsersTabProps {
  users: AdminUserRecord[];
  onOpenUserDetail: (user: AdminUserRecord) => void;
  onQuickApprove: (userId: string) => Promise<void>;
  onQuickReject: (userId: string) => void;
  onBulkAction: (
    userIds: string[], 
    action: "APPROVE" | "SUSPEND" | "CHANGE_ROLE" | "DELETE" | "UPDATE" | "BULK_EDIT", 
    payload?: any
  ) => Promise<void>;
  initialFilter?: string;
  loading: boolean;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  onOpenUserDetail,
  onQuickApprove,
  onQuickReject,
  onBulkAction,
  initialFilter = "all",
  loading,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "rejected" | "admins" | "new">(
    (initialFilter as any) || "all"
  );
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // Multi-Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Modals state
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  
  // Bulk Edit Form State
  const [editRoleEnabled, setEditRoleEnabled] = useState(false);
  const [editRoleValue, setEditRoleValue] = useState("Contributor");
  
  const [editStatusEnabled, setEditStatusEnabled] = useState(false);
  const [editStatusValue, setEditStatusValue] = useState("APPROVED");
  
  const [editPlanEnabled, setEditPlanEnabled] = useState(false);
  const [editPlanValue, setEditPlanValue] = useState("Professional");
  
  const [editCompanyEnabled, setEditCompanyEnabled] = useState(false);
  const [editCompanyValue, setEditCompanyValue] = useState("");

  const t = {
    title: isAr ? "إدارة المستخدمين والحسابات" : isFr ? "Gestion des Utilisateurs" : "Users & Accounts Management",
    searchPlaceholder: isAr ? "بحث بالاسم، البريد، المؤسسة، أو المعرف..." : isFr ? "Rechercher par nom, email, entreprise..." : "Search by name, email, workspace or UID...",
    filterAll: isAr ? "جميع الحسابات" : isFr ? "Tous les comptes" : "All Accounts",
    filterApproved: isAr ? "المعتمدة" : isFr ? "Approuvés" : "Approved",
    filterPending: isAr ? "تحتاج مراجعة" : isFr ? "À vérifier" : "Pending Review",
    filterRejected: isAr ? "المعلقة / المرفوضة" : isFr ? "Suspendus / Rejetés" : "Suspended / Rejected",
    filterAdmins: isAr ? "المشرفون" : isFr ? "Administrateurs" : "Admins",
    filterNew: isAr ? "الجدد (7 أيام)" : isFr ? "Nouveaux (7j)" : "New (7d)",
    colUser: isAr ? "المستخدم" : isFr ? "Utilisateur" : "User",
    colWorkspace: isAr ? "المؤسسة / الدور" : isFr ? "Entreprise / Rôle" : "Workspace / Role",
    colEmailVer: isAr ? "البريد" : isFr ? "Email" : "Email",
    colDocVer: isAr ? "توثيق الوثائق" : isFr ? "Vérif. Docs" : "Document Verification",
    colSubscription: isAr ? "الاشتراك" : isFr ? "Abonnement" : "Subscription",
    colCreated: isAr ? "تاريخ التسجيل" : isFr ? "Date Inscription" : "Created",
    colActions: isAr ? "الإجراءات" : isFr ? "Actions" : "Actions",
    inspect: isAr ? "إدارة الحساب" : isFr ? "Gérer" : "Manage",
    approve: isAr ? "اعتماد" : isFr ? "Approuver" : "Approve",
    reject: isAr ? "تعليق" : isFr ? "Suspendre" : "Suspend",
    noResults: isAr ? "لم يتم العثور على مستخدمين يطابقون معايير البحث." : isFr ? "Aucun utilisateur trouvé." : "No users matched the criteria.",
    selectedCount: isAr ? "تم تحديد" : isFr ? "Sélectionnés" : "Selected",
    selectAll: isAr ? "تحديد الكل" : isFr ? "Tout sélectionner" : "Select All",
    deselectAll: isAr ? "إلغاء التحديد" : isFr ? "Désélectionner" : "Deselect",
    bulkApproveBtn: isAr ? "اعتماد وتوثيق المحددين" : isFr ? "Approuver la sélection" : "Approve Selected",
    bulkSuspendBtn: isAr ? "تعليق المحددين" : isFr ? "Suspendre la sélection" : "Suspend Selected",
    bulkEditBtn: isAr ? "تعديل جماعي" : isFr ? "Modification groupée" : "Bulk Edit",
    bulkDeleteBtn: isAr ? "حذف المحدد" : isFr ? "Supprimer la sélection" : "Delete Selected",
    cancel: isAr ? "إلغاء" : isFr ? "Annuler" : "Cancel",
    confirm: isAr ? "تأكيد التنفيذ" : isFr ? "Confirmer" : "Confirm",
    emailVerifiedLabel: isAr ? "مؤكد" : isFr ? "Vérifié" : "Verified",
    emailUnverifiedLabel: isAr ? "غير مؤكد" : isFr ? "Non vérifié" : "Unverified",
    docNotSubmittedLabel: isAr ? "لم تُرفق وثائق" : isFr ? "Non soumise" : "Not Submitted",
    docPendingLabel: isAr ? "قيد المراجعة" : isFr ? "En attente" : "Pending Review",
    docApprovedLabel: isAr ? "وثائق معتمدة" : isFr ? "Documents validés" : "Docs Approved",
    docRejectedLabel: isAr ? "وثائق مرفوضة" : isFr ? "Documents rejetés" : "Docs Rejected",
    bulkDeleteWarningTitle: isAr ? "تحذير أمني: حذف جماعي نهائي" : "Security Warning: Permanent Bulk Deletion",
    bulkDeleteWarningDesc: isAr 
      ? "هذا الإجراء سيقوم بحذف جميع الحسابات المحددة نهائيًا من قاعدة البيانات وFirebase Authentication وسجلات التوثيق والملفات. لا يمكن التراجع عن هذا الإجراء." 
      : "This action will permanently delete all selected accounts from Firestore, Firebase Authentication, files, and workspace records. This cannot be undone.",
    typeDeleteToConfirm: isAr ? "اكتب كلمة DELETE لتأكيد الحذف:" : "Type DELETE to confirm deletion:",
    bulkEditTitle: isAr ? "تعديل جماعي للحسابات المحددة" : "Bulk Edit Selected Accounts",
    bulkEditDesc: isAr ? "حدد الحقول التي ترغب بتطبيق التعديل عليها للمستخدمين المحددين:" : "Select the fields you want to update for the selected users:",
    selectFieldsNotice: isAr ? "لن يتم تعديل أي حقل لم يتم تفعيل علامة الصح بجانبه." : "Only fields with a checked box will be modified.",
    applyChanges: isAr ? "تطبيق التعديلات" : "Apply Changes",
    deletePermanently: isAr ? "حذف الحسابات نهائيًا" : "Delete Accounts Permanently"
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const name = (u.ownerName || u.companyName || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const id = (u.id || "").toLowerCase();
        const role = (u.role || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !id.includes(q) && !role.includes(q)) {
          return false;
        }
      }

      // 2. Strict status filter
      const breakdown = computeUserVerificationBreakdown(u);
      const full = u.fullUser || ({} as any);
      const accStatus = String(full.accountStatus || (u as any).accountStatus || "").toUpperCase();
      const isApproved = breakdown.isFullyApproved || accStatus === "APPROVED";
      const isRejected = accStatus === "REJECTED" || accStatus === "SUSPENDED" || breakdown.documentStatus === "REJECTED";
      const isAdmin = u.role?.toLowerCase() === "admin" || (u as any).isAdmin === true;
      const isPending = !isApproved && !isRejected;

      if (statusFilter === "approved") return isApproved;
      if (statusFilter === "pending") return isPending;
      if (statusFilter === "rejected") return isRejected;
      if (statusFilter === "admins") return isAdmin;
      if (statusFilter === "new") {
        const createdMs = u.createdAt ? new Date(u.createdAt).getTime() : 0;
        return Date.now() - createdMs <= 7 * 24 * 60 * 60 * 1000;
      }

      return true;
    });
  }, [users, searchQuery, statusFilter]);

  // Bulk Selection Handlers
  const isAllSelected = filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length;
  const isSomeSelected = selectedUserIds.length > 0 && selectedUserIds.length < filteredUsers.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const toggleSelectRow = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleQuickApproveClick = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    try {
      setApprovingUserId(userId);
      await onQuickApprove(userId);
    } finally {
      setApprovingUserId(null);
    }
  };

  // Execute Quick Bulk Actions (Approve / Suspend)
  const handleDirectBulkAction = async (action: "APPROVE" | "SUSPEND") => {
    if (selectedUserIds.length === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      const payload = action === "SUSPEND" ? { reason: "Suspended via bulk admin action" } : { plan: "Starter" };
      await onBulkAction(selectedUserIds, action, payload);
      setSelectedUserIds([]);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Execute Bulk Edit Submission
  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0 || bulkActionLoading) return;

    const payload: Record<string, any> = {};
    if (editRoleEnabled) payload.role = editRoleValue;
    if (editStatusEnabled) payload.accountStatus = editStatusValue;
    if (editPlanEnabled) payload.subscriptionPlan = editPlanValue;
    if (editCompanyEnabled && editCompanyValue.trim()) payload.companyName = editCompanyValue.trim();

    if (Object.keys(payload).length === 0) {
      alert(isAr ? "يرجى تحديد حقل واحد على الأقل لتعديله." : "Please select at least one field to update.");
      return;
    }

    setBulkActionLoading(true);
    try {
      await onBulkAction(selectedUserIds, "BULK_EDIT", payload);
      setIsBulkEditOpen(false);
      setSelectedUserIds([]);
      // Reset form
      setEditRoleEnabled(false);
      setEditStatusEnabled(false);
      setEditPlanEnabled(false);
      setEditCompanyEnabled(false);
      setEditCompanyValue("");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Execute Bulk Delete Submission
  const handleBulkDeleteSubmit = async () => {
    if (selectedUserIds.length === 0 || bulkActionLoading) return;
    if (deleteConfirmationInput.trim().toUpperCase() !== "DELETE") {
      alert(isAr ? "يرجى كتابة كلمة DELETE للتأكيد." : "Please type DELETE to confirm.");
      return;
    }

    setBulkActionLoading(true);
    try {
      await onBulkAction(selectedUserIds, "DELETE", { reason: "Bulk deletion via admin control center" });
      setIsBulkDeleteOpen(false);
      setDeleteConfirmationInput("");
      setSelectedUserIds([]);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Selected user objects for preview in modals
  const selectedUsersList = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  return (
    <div className="space-y-4">
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredUsers.length} / {users.length} {isAr ? "مستخدم مسجل" : "registered users"}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full ps-9 pe-4 py-2 text-xs rounded-xl border transition-colors outline-hidden ${
              theme === "dark" 
                ? "bg-[#090D16] border-slate-700/80 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            }`}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
        {[
          { id: "all", label: t.filterAll },
          { id: "approved", label: t.filterApproved },
          { id: "pending", label: t.filterPending },
          { id: "rejected", label: t.filterRejected },
          { id: "admins", label: t.filterAdmins },
          { id: "new", label: t.filterNew },
        ].map((f) => {
          const isActive = statusFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setStatusFilter(f.id as any);
                setSelectedUserIds([]);
              }}
              type="button"
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : theme === "dark"
                    ? "bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Floating / Inline Bulk Action Toolbar when items are selected */}
      {selectedUserIds.length > 0 && (
        <div 
          className={`p-3 px-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-md transition-all ${
            theme === "dark" 
              ? "bg-[#0B0F19] border-blue-500/50 text-slate-100" 
              : "bg-blue-50/95 border-blue-200 text-blue-950 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span>
              {t.selectedCount} <strong className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedUserIds.length}</strong> {isAr ? "مستخدم محدد" : "users selected"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Approve Selected */}
            <button
              onClick={() => handleDirectBulkAction("APPROVE")}
              disabled={bulkActionLoading}
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.bulkApproveBtn}</span>
            </button>

            {/* Quick Suspend Selected */}
            <button
              onClick={() => handleDirectBulkAction("SUSPEND")}
              disabled={bulkActionLoading}
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.bulkSuspendBtn}</span>
            </button>

            {/* Bulk Edit Modal Trigger */}
            <button
              onClick={() => setIsBulkEditOpen(true)}
              disabled={bulkActionLoading}
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{t.bulkEditBtn}</span>
            </button>

            {/* Bulk Delete Modal Trigger */}
            <button
              onClick={() => {
                setDeleteConfirmationInput("");
                setIsBulkDeleteOpen(true);
              }}
              disabled={bulkActionLoading}
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.bulkDeleteBtn}</span>
            </button>

            {/* Deselect All */}
            <button
              onClick={() => setSelectedUserIds([])}
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.deselectAll}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div 
        className={`rounded-xl border overflow-hidden transition-colors ${
          theme === "dark" 
            ? "bg-[#090D16] border-slate-800/90 text-slate-100" 
            : "bg-white border-slate-200 shadow-xs text-slate-900"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead 
              className={`text-[11px] uppercase font-semibold border-b select-none ${
                theme === "dark" 
                  ? "bg-slate-900/90 border-slate-800 text-slate-300" 
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <tr>
                <th className="py-3 px-3 text-start w-10">
                  <button
                    onClick={toggleSelectAll}
                    type="button"
                    className="p-1 rounded text-slate-400 hover:text-blue-500 cursor-pointer flex items-center justify-center"
                    title={isAllSelected ? t.deselectAll : t.selectAll}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-500" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3 text-start">{t.colUser}</th>
                <th className="py-3 px-3 text-start">{t.colWorkspace}</th>
                <th className="py-3 px-3 text-start">{t.colEmailVer}</th>
                <th className="py-3 px-3 text-start">{t.colDocVer}</th>
                <th className="py-3 px-3 text-start">{t.colSubscription}</th>
                <th className="py-3 px-3 text-start">{t.colCreated}</th>
                <th className="py-3 px-3 text-end">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredUsers.map((u) => {
                const breakdown = computeUserVerificationBreakdown(u);
                const full = u.fullUser || ({} as any);
                const planName = full.subscriptionPlan || (u as any).subscriptionPlan || "Starter";
                const isSelected = selectedUserIds.includes(u.id);

                return (
                  <tr 
                    key={u.id}
                    onClick={() => onOpenUserDetail(u)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? theme === "dark" ? "bg-blue-950/40" : "bg-blue-50/70"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-start" onClick={(e) => toggleSelectRow(u.id, e)}>
                      <button
                        type="button"
                        className="p-1 rounded text-slate-400 hover:text-blue-500 cursor-pointer flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* User Identity */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {(u.ownerName || u.email || "U")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[170px]">
                            {u.ownerName || u.companyName || u.email?.split("@")[0]}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[190px]">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Workspace & Role */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                        {u.companyName || (isAr ? "منظمة فردية" : "Individual Org")}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        {u.role || "Contributor"}
                      </div>
                    </td>

                    {/* Email Verification Badge */}
                    <td className="py-3 px-3">
                      {breakdown.emailVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <MailCheck className="w-3 h-3" />
                          <span>{t.emailVerifiedLabel}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <MailWarning className="w-3 h-3" />
                          <span>{t.emailUnverifiedLabel}</span>
                        </span>
                      )}
                    </td>

                    {/* Document / KYC Verification Badge */}
                    <td className="py-3 px-3">
                      {breakdown.documentStatus === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <FileCheck2 className="w-3 h-3" />
                          <span>{t.docApprovedLabel} ({breakdown.documentCount})</span>
                        </span>
                      ) : breakdown.documentStatus === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <FileX className="w-3 h-3" />
                          <span>{t.docRejectedLabel}</span>
                        </span>
                      ) : breakdown.documentStatus === "UNDER_REVIEW" || breakdown.documentStatus === "PENDING_REVIEW" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          <span>{t.docPendingLabel} ({breakdown.documentCount})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <FileQuestion className="w-3 h-3" />
                          <span>{t.docNotSubmittedLabel}</span>
                        </span>
                      )}
                    </td>

                    {/* Subscription */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {planName}
                      </span>
                    </td>

                    {/* Created At */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                      {safeFormatDate(u.createdAt, isAr ? "ar" : "en")}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!breakdown.isFullyApproved && (
                          <button
                            onClick={(e) => handleQuickApproveClick(e, u.id)}
                            disabled={approvingUserId === u.id}
                            type="button"
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
                            title={t.approve}
                          >
                            {approvingUserId === u.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              t.approve
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => onOpenUserDetail(u)}
                          type="button"
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                        >
                          {t.inspect}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                    {t.noResults}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. COMPREHENSIVE BULK EDIT MODAL */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div 
            className={`w-full max-w-lg p-5 rounded-2xl border shadow-2xl transition-all ${
              theme === "dark" 
                ? "bg-[#0B0F19] border-slate-800 text-slate-100" 
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{t.bulkEditTitle}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedUserIds.length} {isAr ? "حسابات محددة" : "selected accounts"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                type="button"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkEditSubmit} className="mt-4 space-y-4 text-xs">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                {t.selectFieldsNotice}
              </p>

              {/* Field 1: Role */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRoleEnabled}
                    onChange={(e) => setEditRoleEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {isAr ? "تغيير الدور (Role):" : "Update Role:"}
                  </span>
                </label>
                {editRoleEnabled && (
                  <select
                    value={editRoleValue}
                    onChange={(e) => setEditRoleValue(e.target.value)}
                    className={`w-full p-2 rounded-lg border outline-hidden mt-1 ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="CEO">CEO</option>
                    <option value="Admin">Admin</option>
                    <option value="Compliance Officer">Compliance Officer</option>
                    <option value="Analyst">Analyst</option>
                    <option value="Risk Auditor">Risk Auditor</option>
                    <option value="Contributor">Contributor</option>
                    <option value="View Only">View Only</option>
                  </select>
                )}
              </div>

              {/* Field 2: Account Status */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStatusEnabled}
                    onChange={(e) => setEditStatusEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {isAr ? "تغيير حالة الحساب (Account Status):" : "Update Account Status:"}
                  </span>
                </label>
                {editStatusEnabled && (
                  <select
                    value={editStatusValue}
                    onChange={(e) => setEditStatusValue(e.target.value)}
                    className={`w-full p-2 rounded-lg border outline-hidden mt-1 ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="APPROVED">APPROVED (معتمد وموثق)</option>
                    <option value="PENDING_ADMIN_REVIEW">PENDING_ADMIN_REVIEW (قيد مراجعة الإدارة)</option>
                    <option value="PENDING_DOCUMENT_VERIFICATION">PENDING_DOCUMENT_VERIFICATION (بانتظار الوثائق)</option>
                    <option value="SUSPENDED">SUSPENDED (معلق)</option>
                    <option value="REJECTED">REJECTED (مرفوض)</option>
                  </select>
                )}
              </div>

              {/* Field 3: Subscription Plan */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPlanEnabled}
                    onChange={(e) => setEditPlanEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {isAr ? "تغيير باقة الاشتراك (Subscription Plan):" : "Update Subscription Plan:"}
                  </span>
                </label>
                {editPlanEnabled && (
                  <select
                    value={editPlanValue}
                    onChange={(e) => setEditPlanValue(e.target.value)}
                    className={`w-full p-2 rounded-lg border outline-hidden mt-1 ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Professional">Professional</option>
                    <option value="Starter">Starter</option>
                    <option value="Free">Free</option>
                  </select>
                )}
              </div>

              {/* Field 4: Company Name */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCompanyEnabled}
                    onChange={(e) => setEditCompanyEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {isAr ? "تعيين اسم المؤسسة / المنظمة:" : "Assign Organization Name:"}
                  </span>
                </label>
                {editCompanyEnabled && (
                  <input
                    type="text"
                    value={editCompanyValue}
                    onChange={(e) => setEditCompanyValue(e.target.value)}
                    placeholder={isAr ? "اسم المنظمة أو الشركة الجديدة..." : "New company name..."}
                    className={`w-full p-2 rounded-lg border outline-hidden mt-1 ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  />
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(false)}
                  disabled={bulkActionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  disabled={bulkActionLoading || (!editRoleEnabled && !editStatusEnabled && !editPlanEnabled && !editCompanyEnabled)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {bulkActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t.applyChanges}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. SECURE BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div 
            className={`w-full max-w-lg p-5 rounded-2xl border shadow-2xl transition-all ${
              theme === "dark" 
                ? "bg-[#0B0F19] border-rose-900/60 text-slate-100" 
                : "bg-white border-rose-200 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-rose-100 dark:border-rose-900/40">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  {t.bulkDeleteWarningTitle}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedUserIds.length} {isAr ? "حسابات سيتم حذفها نهائيًا" : "accounts to be deleted"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {t.bulkDeleteWarningDesc}
              </p>

              {/* List of targeted emails for transparency */}
              <div className="max-h-32 overflow-y-auto p-2.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 custom-scrollbar space-y-1">
                {selectedUsersList.slice(0, 8).map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300">
                    <span className="font-semibold truncate max-w-[200px]">{u.email || u.id}</span>
                    <span className="text-slate-400 text-[10px]">{u.companyName || u.role}</span>
                  </div>
                ))}
                {selectedUsersList.length > 8 && (
                  <div className="text-[10px] text-slate-400 text-center pt-1 italic">
                    +{selectedUsersList.length - 8} {isAr ? "حسابات أخرى" : "more accounts"}
                  </div>
                )}
              </div>

              {/* Typed Confirmation */}
              <div className="pt-2 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {t.typeDeleteToConfirm}
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder="DELETE"
                  className={`w-full p-2.5 rounded-xl border text-xs font-mono font-bold tracking-widest outline-hidden ${
                    theme === "dark"
                      ? "bg-slate-900 border-rose-900/80 text-white placeholder-slate-600 focus:border-rose-500"
                      : "bg-white border-rose-300 text-slate-900 placeholder-slate-400 focus:border-rose-500"
                  }`}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setDeleteConfirmationInput("");
                }}
                disabled={bulkActionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={handleBulkDeleteSubmit}
                disabled={bulkActionLoading || deleteConfirmationInput.trim().toUpperCase() !== "DELETE"}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {bulkActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.deletePermanently}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
