import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Shield, 
  Mail, 
  Building, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  CreditCard, 
  Trash2, 
  FileText, 
  Download, 
  ExternalLink,
  RefreshCw,
  HelpCircle,
  Zap,
  Lock,
  Edit3,
  Save,
  Phone,
  Briefcase,
  MailCheck,
  MailWarning,
  FileCheck2,
  FileX,
  FileQuestion
} from "lucide-react";
import { AdminUserRecord, computeUserVerificationBreakdown } from "../../../lib/firebaseServices.js";
import { safeFormatDateTime, safeFormatDate } from "../../../lib/dateUtils.js";
import { UserFile } from "../../../types.js";
import { downloadUserFile, openUserFileInNewTab } from "../../../lib/fileViewerUtils.js";

interface UserDetailModalProps {
  user: AdminUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (userId: string, plan: string, trialHours: number, notes?: string) => Promise<void>;
  onReject: (userId: string, reason: string) => Promise<void>;
  onRequireDocs: (userId: string, reason: string) => Promise<void>;
  onExtendTrial: (userId: string, hours: number, reason?: string) => Promise<void>;
  onUpdatePlan: (userId: string, plan: string, status: string, notes?: string) => Promise<void>;
  onDeleteUser: (userId: string, email: string) => Promise<void>;
  onSaveProfile: (userId: string, profileData: Record<string, any>) => Promise<void>;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequireDocs,
  onExtendTrial,
  onUpdatePlan,
  onDeleteUser,
  onSaveProfile,
  lang,
  theme
}) => {
  if (!isOpen || !user) return null;

  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const full = user.fullUser || ({} as any);
  const breakdown = computeUserVerificationBreakdown(user);

  // Tabs inside modal
  const [modalTab, setModalTab] = useState<"profile" | "edit" | "actions" | "files">("profile");

  // Editable Profile State
  const [editName, setEditName] = useState(user.ownerName || user.companyName || "");
  const [editPhone, setEditPhone] = useState(full.phoneNumber || full.phone || "");
  const [editCompany, setEditCompany] = useState(user.companyName || full.organizationName || "");
  const [editDepartment, setEditDepartment] = useState(full.department || "");
  const [editRole, setEditRole] = useState(user.role || "Contributor");
  const [editAccountStatus, setEditAccountStatus] = useState(full.accountStatus || "VERIFICATION_REQUIRED");
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync state when user changes
  useEffect(() => {
    setEditName(user.ownerName || user.companyName || "");
    setEditPhone(full.phoneNumber || full.phone || "");
    setEditCompany(user.companyName || full.organizationName || "");
    setEditDepartment(full.department || "");
    setEditRole(user.role || "Contributor");
    setEditAccountStatus(full.accountStatus || "VERIFICATION_REQUIRED");
  }, [user]);

  // State for actions
  const [actionReason, setActionReason] = useState("");
  const [planSelect, setPlanSelect] = useState(full.subscriptionPlan || (user as any).subscriptionPlan || "Starter");
  const [trialExtensionHours, setTrialExtensionHours] = useState(48);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const t = {
    title: isAr ? "إدارة وتفاصيل الحساب" : isFr ? "Détails du Compte" : "Account Management & Details",
    tabProfile: isAr ? "نظرة عامة والتوثيق" : isFr ? "Profil & Vérif" : "Profile & Verification",
    tabEdit: isAr ? "تعديل بيانات الحساب" : isFr ? "Modifier Profil" : "Edit Profile",
    tabActions: isAr ? "الإجراءات والاشتراك" : isFr ? "Actions & Forfait" : "Actions & Subscription",
    tabFiles: isAr ? `الملفات (${user.files?.length || 0})` : isFr ? `Fichiers (${user.files?.length || 0})` : `Files (${user.files?.length || 0})`,
    email: isAr ? "البريد الإلكتروني" : isFr ? "Email" : "Email",
    uid: isAr ? "معرف المستخدم (UID)" : isFr ? "Identifiant UID" : "User UID",
    workspace: isAr ? "الشركة / المؤسسة" : isFr ? "Organisation" : "Workspace / Org",
    role: isAr ? "الدور والصلاحية" : isFr ? "Rôle" : "Role",
    status: isAr ? "حالة الحساب" : isFr ? "Statut" : "Account Status",
    plan: isAr ? "الباقة الحالية" : isFr ? "Plan" : "Current Plan",
    created: isAr ? "تاريخ التسجيل" : isFr ? "Créé le" : "Registered At",
    lastLogin: isAr ? "آخر نشاط" : isFr ? "Dernière activité" : "Last Active",
    emailVerTitle: isAr ? "حالة تأكيد البريد الإلكتروني (Email Verification)" : isFr ? "Vérification Email" : "Email Verification",
    docVerTitle: isAr ? "حالة توثيق الوثائق المؤسسية (Document Verification)" : isFr ? "Vérification Documentaire" : "Document Verification",
    approveBtn: isAr ? "اعتماد وتوثيق الحساب" : isFr ? "Approuver le compte" : "Approve Account",
    rejectBtn: isAr ? "تعليق / رفض الحساب" : isFr ? "Suspendre / Rejeter" : "Suspend / Reject",
    requireDocsBtn: isAr ? "طلب مستندات إضافية" : isFr ? "Demander des pièces" : "Require Documents",
    extendTrialBtn: isAr ? "تمديد الفترة التجريبية" : isFr ? "Prolonger l'essai" : "Extend Trial",
    updatePlanBtn: isAr ? "تحديث الباقة والترخيص" : isFr ? "Mettre à jour le plan" : "Update Plan",
    deleteAccountTitle: isAr ? "حذف الحساب نهائيًا (إجراء لا رجعة فيه)" : isFr ? "Suppression Définitive" : "Permanent Account Deletion",
    deleteInstruction: isAr ? `اكتب "${user.email}" لتأكيد الحذف النهائي:` : `Type "${user.email}" to confirm permanent deletion:`,
    deleteBtn: isAr ? "حذف الحساب نهائيًا" : isFr ? "Supprimer définitivement" : "Delete Account Permanently",
    saveChanges: isAr ? "حفظ التعديلات في النظام" : isFr ? "Enregistrer les modifications" : "Save Profile Changes",
    close: isAr ? "إغلاق" : isFr ? "Fermer" : "Close",
    noFiles: isAr ? "لا توجد ملفات مرفوعة من قبل هذا المستخدم." : isFr ? "Aucun fichier téléversé." : "No files uploaded by this user."
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setActionNotice(null);
    try {
      await onSaveProfile(user.id, {
        ownerName: editName,
        name: editName,
        phoneNumber: editPhone,
        phone: editPhone,
        companyName: editCompany,
        department: editDepartment,
        role: editRole,
        accountStatus: editAccountStatus
      });
      setActionNotice({ type: "success", text: isAr ? "تم حفظ بيانات المستخدم بنجاح ومزامنتها." : "Profile updated and synchronized successfully." });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleApproveAction = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onApprove(user.id, planSelect, 24, actionReason);
      setActionNotice({ type: "success", text: isAr ? "تم اعتماد الحساب وتوثيقه بنجاح." : "Account approved and verified successfully." });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to approve account" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAction = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onReject(user.id, actionReason || "Account suspended by administrator");
      setActionNotice({ type: "success", text: isAr ? "تم تعليق الحساب وحظر وصوله." : "Account suspended." });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to suspend account" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequireDocsAction = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onRequireDocs(user.id, actionReason || "Official verification documents required.");
      setActionNotice({ type: "success", text: isAr ? "تم إرسال طلب المستندات للمستخدم." : "Document request sent." });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to request documents" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtendTrialAction = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onExtendTrial(user.id, trialExtensionHours, actionReason || "Extended by admin");
      setActionNotice({ type: "success", text: isAr ? `تم تمديد التجربة بمقدار ${trialExtensionHours} ساعة.` : `Trial extended by ${trialExtensionHours} hours.` });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to extend trial" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePlanAction = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onUpdatePlan(user.id, planSelect, "Active", actionReason);
      setActionNotice({ type: "success", text: isAr ? "تم تحديث باقة المستخدم بنجاح." : "Plan updated successfully." });
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to update plan" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUserAction = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== user.email.toLowerCase()) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      await onDeleteUser(user.id, user.email);
      onClose();
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Failed to delete account" });
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-950/80 backdrop-blur-xs select-none">
      <div 
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          theme === "dark" 
            ? "bg-[#0B0F19] border-slate-800 text-slate-100" 
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Top Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              {(user.ownerName || user.email || "U")[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                {user.ownerName || user.companyName || user.email}
              </h2>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          {[
            { id: "profile", label: t.tabProfile },
            { id: "edit", label: t.tabEdit },
            { id: "actions", label: t.tabActions },
            { id: "files", label: t.tabFiles },
          ].map((tab) => {
            const isActive = modalTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setModalTab(tab.id as any)}
                type="button"
                className={`pb-2.5 px-2 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Feedback Alert */}
        {actionNotice && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              actionNotice.type === "success"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}
          >
            {actionNotice.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* TAB 1: OVERVIEW & VERIFICATION STATE */}
          {modalTab === "profile" && (
            <div className="space-y-4 text-xs">
              {/* Verification Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email Verification Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{t.emailVerTitle}</span>
                    {breakdown.emailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <MailCheck className="w-3 h-3" />
                        <span>مؤكد</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <MailWarning className="w-3 h-3" />
                        <span>غير مؤكد</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {breakdown.emailVerified
                      ? "تم التحقق من ملكية البريد عبر رمز OTP بنجاح."
                      : "المستخدم لم يقم بتأكيد ملكية البريد الإلكتروني بعد."}
                  </p>
                </div>

                {/* Document Verification Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{t.docVerTitle}</span>
                    {breakdown.documentStatus === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <FileCheck2 className="w-3 h-3" />
                        <span>معتمد ({breakdown.documentCount})</span>
                      </span>
                    ) : breakdown.documentStatus === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <FileX className="w-3 h-3" />
                        <span>مرفوض</span>
                      </span>
                    ) : breakdown.documentStatus === "UNDER_REVIEW" || breakdown.documentStatus === "PENDING_REVIEW" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        <span>قيد المراجعة ({breakdown.documentCount})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                        <FileQuestion className="w-3 h-3" />
                        <span>لم تُرفق وثائق (0)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {breakdown.documentCount === 0
                      ? "المستخدم لم يرسل أي مستندات توثيق. الحالة تمنع اعتباره موثقاً."
                      : breakdown.hasExplicitOverride
                        ? `تم الاعتماد بقرار إداري مباشر (${breakdown.approvedBy || "Admin"}).`
                        : `تم إرفاق ${breakdown.documentCount} مستند في انتظار أو قيد القرار الإداري.`}
                  </p>
                </div>
              </div>

              {/* Account Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.email}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.email}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.uid}</span>
                  <span className="font-mono text-[11px] text-slate-900 dark:text-slate-100 select-all">{user.id}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.workspace}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.companyName || "Default Workspace"}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.role}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{user.role || "CEO"}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.status}</span>
                  <span className="font-semibold">{full.accountStatus || "VERIFICATION_REQUIRED"}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.plan}</span>
                  <span className="font-semibold">{full.subscriptionPlan || (user as any).subscriptionPlan || "Starter"}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.created}</span>
                  <span>{safeFormatDateTime(user.createdAt, isAr ? "ar" : "en")}</span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block mb-0.5">{t.lastLogin}</span>
                  <span>{safeFormatDateTime(user.lastLoginAt || user.lastActiveAt, isAr ? "ar" : "en")}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT PROFILE */}
          {modalTab === "edit" && (
            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "الاسم الكامل:" : "Full Name:"}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "رقم الهاتف:" : "Phone:"}</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "اسم المؤسسة / الشركة:" : "Organization:"}</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "القسم / الإدارة:" : "Department:"}</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "الدور والصلاحية (Role):" : "Role:"}</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
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
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? "حالة الحساب (Account Status):" : "Account Status:"}</label>
                  <select
                    value={editAccountStatus}
                    onChange={(e) => setEditAccountStatus(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="APPROVED">APPROVED (معتمد)</option>
                    <option value="VERIFICATION_REQUIRED">VERIFICATION_REQUIRED (مطلوب توثيق)</option>
                    <option value="PENDING_ADMIN_REVIEW">PENDING_ADMIN_REVIEW (قيد المراجعة)</option>
                    <option value="PENDING_EMAIL_VERIFICATION">PENDING_EMAIL_VERIFICATION (بانتظار تأكيد البريد)</option>
                    <option value="SUSPENDED">SUSPENDED (معلق)</option>
                    <option value="REJECTED">REJECTED (مرفوض)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {savingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{t.saveChanges}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ACTIONS & SUBSCRIPTIONS */}
          {modalTab === "actions" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? "ملاحظات إدارية / توضيح للمستخدم:" : "Administrative Notes:"}
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={isAr ? "اكتب توضيحًا أو سببًا للإجراء..." : "Reason for action..."}
                  className={`w-full text-xs p-2.5 rounded-xl border outline-hidden ${
                    theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleApproveAction}
                  disabled={actionLoading}
                  type="button"
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{t.approveBtn}</span>
                </button>

                <button
                  onClick={handleRejectAction}
                  disabled={actionLoading}
                  type="button"
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t.rejectBtn}</span>
                </button>

                <button
                  onClick={handleRequireDocsAction}
                  disabled={actionLoading}
                  type="button"
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{t.requireDocsBtn}</span>
                </button>
              </div>

              {/* Subscription Controls */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 mt-4">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span>{isAr ? "الاشتراكات والتراخيص" : "Subscription & Licensing"}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">{isAr ? "الباقة المطلوبة:" : "Plan Tier:"}</label>
                    <div className="flex gap-2">
                      <select
                        value={planSelect}
                        onChange={(e) => setPlanSelect(e.target.value)}
                        className={`text-xs p-2 rounded-lg border flex-1 outline-hidden ${
                          theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                        }`}
                      >
                        <option value="Starter">Starter</option>
                        <option value="Professional">Professional</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                      <button
                        onClick={handleUpdatePlanAction}
                        disabled={actionLoading}
                        type="button"
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        {isAr ? "تطبيق" : "Apply"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">{isAr ? "تمديد التجربة (ساعات):" : "Extend Trial (hours):"}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={trialExtensionHours}
                        onChange={(e) => setTrialExtensionHours(Number(e.target.value) || 24)}
                        className={`text-xs p-2 rounded-lg border flex-1 outline-hidden ${
                          theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200"
                        }`}
                      />
                      <button
                        onClick={handleExtendTrialAction}
                        disabled={actionLoading}
                        type="button"
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
                      >
                        {isAr ? "تمديد" : "Extend"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3 mt-4">
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>{t.deleteAccountTitle}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.deleteInstruction}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={user.email}
                    className={`text-xs p-2 rounded-lg border flex-1 outline-hidden ${
                      theme === "dark" ? "bg-slate-900 border-rose-800 text-white" : "bg-white border-rose-300"
                    }`}
                  />
                  <button
                    onClick={handleDeleteUserAction}
                    disabled={deleteConfirmText.trim().toLowerCase() !== user.email.toLowerCase() || actionLoading}
                    type="button"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {t.deleteBtn}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FILES */}
          {modalTab === "files" && (
            <div className="space-y-2.5">
              {(user.files || []).map((file, idx) => (
                <div
                  key={file.id || idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate max-w-sm">{(file as any).name || file.fileName}</div>
                      <div className="text-[10px] text-slate-400">{file.category || "General"} • {safeFormatDate(file.uploadDate, isAr ? "ar" : "en")}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openUserFileInNewTab(file)}
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadUserFile(file)}
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {(!user.files || user.files.length === 0) && (
                <div className="p-8 text-center text-xs text-slate-400">
                  {t.noFiles}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
