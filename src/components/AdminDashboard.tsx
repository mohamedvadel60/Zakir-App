import React, { useState, useEffect } from "react";
import { safeFormatDate, safeFormatDateTime, safeFormatTime } from "../lib/dateUtils";
import { 
  ShieldCheck, 
  Users, 
  FileText, 
  Search, 
  RefreshCw, 
  X, 
  ExternalLink, 
  Download, 
  Calendar, 
  UserCheck, 
  LogOut, 
  FolderOpen, 
  Building2, 
  Info,
  Clock,
  HardDrive,
  Eye,
  CheckCircle2,
  FileCode,
  Shield,
  Sun,
  Moon,
  Lock,
  ArrowRight,
  AlertCircle,
  Save,
  CheckCircle,
  AlertTriangle,
  Trash2,
  LifeBuoy,
  MessageSquare,
  Send,
  Filter,
  Tag,
  Bot,
  ShieldAlert,
  RotateCcw
} from "lucide-react";
import { User, UserFile, VerificationStatus, VerificationInfo, SupportTicket, SupportStatus, SupportPriority } from "../types.js";
import { 
  fetchAllUsersForAdmin, 
  AdminUserRecord, 
  formatBytes, 
  logoutFirebaseUser, 
  saveFirebaseUserProfile, 
  deleteFirebaseUserFile, 
  deleteFirebaseUserAccount, 
  ADMIN_USER_ID,
  fetchSupportTicketsApi,
  addSupportTicketMessageApi,
  updateSupportTicketStatusApi,
  subscribeToSupportTickets
} from "../lib/firebaseServices.js";
import { openOrDownloadUserFile, openUserFileInNewTab, downloadUserFile } from "../lib/fileViewerUtils.js";

interface AdminDashboardProps {
  currentUser: User;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
  toggleLanguage?: (newLang: "ar" | "fr" | "en") => void;
  toggleTheme: (newTheme: "dark" | "light") => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  lang,
  theme,
  toggleTheme,
  onLogout
}) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Selected user for file inspection modal
  const [selectedUserRecord, setSelectedUserRecord] = useState<AdminUserRecord | null>(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<UserFile | null>(null);
  
  // Main Admin Tab state
  const [activeAdminTab, setActiveAdminTab] = useState<"users" | "reactivations" | "support">("users");

  // Account Reactivations State
  const [reactivationRequests, setReactivationRequests] = useState<any[]>([]);
  const [loadingReactivations, setLoadingReactivations] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [reactivationFilter, setReactivationFilter] = useState<string>("all");

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketSearchQuery, setTicketSearchQuery] = useState<string>("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("All");
  const [adminReplyMessage, setAdminReplyMessage] = useState<string>("");
  const [isSendingAdminReply, setIsSendingAdminReply] = useState<boolean>(false);
  const [adminNotesInput, setAdminNotesInput] = useState<string>("");
  const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState<boolean>(false);
  const [supportFetchError, setSupportFetchError] = useState<string>("");

  // Verification management state
  const [adminNoteInput, setAdminNoteInput] = useState<string>("");
  const [savingVerification, setSavingVerification] = useState<boolean>(false);
  const [verificationSuccessMsg, setVerificationSuccessMsg] = useState<string>("");

  useEffect(() => {
    if (selectedTicket) {
      setAdminNotesInput(selectedTicket.adminNotes || "");
    }
  }, [selectedTicket]);

  // Load and subscribe to support tickets
  useEffect(() => {
    setSupportFetchError("");
    fetchSupportTicketsApi(undefined, undefined, true).then((data) => {
      setSupportTickets(data);
      if (data.length > 0 && !selectedTicket) {
        setSelectedTicket(data[0]);
      }
    }).catch(err => {
      if (err.message === "UNAUTHORIZED" || err.message?.includes("Unauthorized")) {
        setSupportFetchError(lang === "ar" ? "انتهت صلاحية الجلسة. يرجى تسجيل الدخول كمسؤول مرة أخرى." : "Your session has expired. Please sign in as admin again.");
      } else {
        setSupportFetchError(lang === "ar" ? "تعذر تحميل طلبات الدعم." : "We couldn't load support requests.");
      }
    });

    const unsubscribe = subscribeToSupportTickets("", true, (updated) => {
      setSupportTickets(updated);
      if (selectedTicket) {
        const fresh = updated.find((t) => t.id === selectedTicket.id);
        if (fresh) setSelectedTicket(fresh);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReplyMessage.trim()) return;

    setIsSendingAdminReply(true);
    try {
      await addSupportTicketMessageApi(selectedTicket.id, {
        senderType: "admin",
        senderName: "Zakir Enterprise Support",
        senderEmail: currentUser.email || "support@zakir.ai",
        message: adminReplyMessage.trim()
      });

      setAdminReplyMessage("");
      const updatedList = await fetchSupportTicketsApi(undefined, undefined, true);
      setSupportTickets(updatedList);
      const updatedSel = updatedList.find((t) => t.id === selectedTicket.id);
      if (updatedSel) setSelectedTicket(updatedSel);
    } catch (err) {
      console.error("Error sending admin reply:", err);
    } finally {
      setIsSendingAdminReply(false);
    }
  };

  const handleUpdateTicketStatus = async (newStatus: SupportStatus) => {
    if (!selectedTicket) return;
    setIsUpdatingTicketStatus(true);
    try {
      await updateSupportTicketStatusApi(selectedTicket.id, {
        status: newStatus
      });
      const updatedList = await fetchSupportTicketsApi(undefined, undefined, true);
      setSupportTickets(updatedList);
      const updatedSel = updatedList.find((t) => t.id === selectedTicket.id);
      if (updatedSel) setSelectedTicket(updatedSel);
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setIsUpdatingTicketStatus(false);
    }
  };

  const handleUpdateTicketPriority = async (newPriority: SupportPriority) => {
    if (!selectedTicket) return;
    setIsUpdatingTicketStatus(true);
    try {
      await updateSupportTicketStatusApi(selectedTicket.id, {
        priority: newPriority
      });
      const updatedList = await fetchSupportTicketsApi(undefined, undefined, true);
      setSupportTickets(updatedList);
      const updatedSel = updatedList.find((t) => t.id === selectedTicket.id);
      if (updatedSel) setSelectedTicket(updatedSel);
    } catch (err) {
      console.error("Error updating priority:", err);
    } finally {
      setIsUpdatingTicketStatus(false);
    }
  };

  const handleSaveAdminNotes = async () => {
    if (!selectedTicket) return;
    setIsUpdatingTicketStatus(true);
    try {
      await updateSupportTicketStatusApi(selectedTicket.id, {
        adminNotes: adminNotesInput.trim()
      });
      const updatedList = await fetchSupportTicketsApi(undefined, undefined, true);
      setSupportTickets(updatedList);
      const updatedSel = updatedList.find((t) => t.id === selectedTicket.id);
      if (updatedSel) setSelectedTicket(updatedSel);
    } catch (err) {
      console.error("Error updating admin notes:", err);
    } finally {
      setIsUpdatingTicketStatus(false);
    }
  };

  const handleUpdateUserVerification = async (newStatus: VerificationStatus, customNote?: string) => {
    if (!selectedUserRecord) return;
    setSavingVerification(true);
    setVerificationSuccessMsg("");

    try {
      const existingVer = selectedUserRecord.verificationInfo || { status: "unverified" };
      const noteToSave = customNote !== undefined ? customNote : adminNoteInput;
      const updatedVerInfo: VerificationInfo = {
        ...existingVer,
        status: newStatus,
        adminNote: noteToSave,
        verifiedAt: newStatus === "verified" ? new Date().toISOString() : existingVer.verifiedAt
      };

      const baseUser: User = selectedUserRecord.fullUser || {
        id: selectedUserRecord.id,
        email: selectedUserRecord.email,
        companyName: selectedUserRecord.companyName || "",
        ownerName: selectedUserRecord.ownerName || "",
        role: (selectedUserRecord.role as any) || "CEO",
        createdAt: selectedUserRecord.createdAt,
        trialExpiresAt: new Date().toISOString()
      };

      const updatedUser: User = {
        ...baseUser,
        verificationInfo: updatedVerInfo
      };

      await saveFirebaseUserProfile(updatedUser);

      setVerificationSuccessMsg(
        lang === "ar" 
          ? "تم تحديث حالة التحقق من الحساب وإرسال الملاحظات بنجاح!" 
          : "Verification status and admin notes updated successfully!"
      );

      // Refresh admin list
      await loadAdminData();
    } catch (err: any) {
      console.error("Error updating user verification:", err);
      alert(lang === "ar" ? "حدث خطأ أثناء تحديث حالة الحساب" : "Error updating verification status");
    } finally {
      setSavingVerification(false);
    }
  };

  const fetchReactivationRequests = async () => {
    setLoadingReactivations(true);
    try {
      const { auth } = await import("../firebase");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      const res = await fetch("/api/admin/reactivation-requests", {
        headers: { "Authorization": `Bearer ${idToken}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setReactivationRequests(data.requests);
      }
    } catch (err) {
      console.warn("fetchReactivationRequests error:", err);
    } finally {
      setLoadingReactivations(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === "reactivations") {
      fetchReactivationRequests();
    }
  }, [activeAdminTab]);

  // Load initial reactivation count on mount
  useEffect(() => {
    fetchReactivationRequests();
  }, []);

  const handleReactivationDecision = async (email: string, action: "approve" | "reject") => {
    const confirmMsg = action === "approve"
      ? (lang === "ar" ? `هل أنت متأكد من الموافقة على إعادة تفعيل الحساب (${email}) والسماح له بالتسجيل؟` : `Approve reactivation for (${email})? User will be allowed to register.`)
      : (lang === "ar" ? `هل أنت متأكد من رفض طلب إعادة التفعيل (${email})؟ سيبقى الحساب محظوراً.` : `Reject reactivation for (${email})? Account will remain blocked.`);
    if (!window.confirm(confirmMsg)) return;

    setActionInProgress(email);
    try {
      const { auth } = await import("../firebase");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required");

      const res = await fetch("/api/admin/handle-reactivation-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ email, action })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed");
      }
      alert(data.message || (lang === "ar" ? "تم تنفيذ الإجراء بنجاح!" : "Action completed successfully!"));
      await fetchReactivationRequests();
    } catch (err: any) {
      alert(err.message || (lang === "ar" ? "حدث خطأ" : "Error"));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteUserVerDoc = async (docId: string, fileName?: string) => {
    if (!selectedUserRecord) return;
    const confirmMsg = lang === "ar"
      ? `هل أنت تأكد من حذف هذا المستند للمستخدم (${selectedUserRecord.ownerName || selectedUserRecord.email})؟`
      : `Are you sure you want to delete this document for user (${selectedUserRecord.ownerName || selectedUserRecord.email})?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const targetId = docId || fileName;
      if (targetId) {
        await deleteFirebaseUserFile(selectedUserRecord.id, targetId);
      }

      const currentVerDocs = selectedUserRecord.verificationInfo?.documents || [];
      const updatedDocs = currentVerDocs.filter((d) => d.id !== docId && d.fileName !== docId && d.fileName !== fileName);
      const existingVerInfo = selectedUserRecord.verificationInfo || { status: "action_required", documents: [] };
      const updatedVerInfo: VerificationInfo = {
        ...existingVerInfo,
        documents: updatedDocs,
        status: updatedDocs.length === 0 ? "action_required" : existingVerInfo.status
      };

      const updatedUser: User = {
        id: selectedUserRecord.id,
        email: selectedUserRecord.email,
        companyName: selectedUserRecord.companyName || "",
        ownerName: selectedUserRecord.ownerName || "",
        role: (selectedUserRecord.role as any) || "CEO",
        createdAt: selectedUserRecord.createdAt,
        trialExpiresAt: selectedUserRecord.createdAt || new Date().toISOString(),
        verificationInfo: updatedVerInfo
      };

      await saveFirebaseUserProfile(updatedUser);

      const updatedFiles = (selectedUserRecord.files || []).filter((f) => f.id !== docId && f.fileName !== docId && f.fileName !== fileName);
      const updatedRecord: AdminUserRecord = {
        ...selectedUserRecord,
        files: updatedFiles,
        fileCount: updatedFiles.length,
        verificationInfo: updatedVerInfo
      };

      setSelectedUserRecord(updatedRecord);
      setUsers((prev) => prev.map((u) => (u.id === selectedUserRecord.id ? updatedRecord : u)));
    } catch (err: any) {
      console.error("Error deleting user verification doc:", err);
      alert(lang === "ar" ? "فشل حذف المستند للمستخدم، يرجى إعادة المحاولة." : "Failed to delete document for user, please try again.");
    }
  };

  const handleDeleteUserAccount = async (userId: string, userEmail: string) => {
    if (userId === currentUser.id) {
      alert(lang === "ar" ? "لا يمكنك حذف حساب المسؤول الحالي الذي تستخدمه الآن." : "You cannot delete your own Admin account.");
      return;
    }
    if (userId === ADMIN_USER_ID) {
      alert(lang === "ar" ? "لا يمكنك حذف الحساب الرئيسي للمسؤول." : "You cannot delete the primary Admin account.");
      return;
    }
    const confirmMsg = lang === "ar"
      ? `هل أنت متاكد من حذف حساب المستخدم (${userEmail}) نهائياً؟ سيتم مسح كافة ملفاته وسجلاته ورصيده من قاعدة البيانات.`
      : `Are you sure you want to permanently delete user account (${userEmail})? All user files and records will be deleted.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Call backend server to delete from Firebase Authentication & record deletedUsers marker
      const { auth } = await import("../firebase");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Authentication token unavailable. Please sign in again.");
      }

      const response = await fetch(`/api/admin/delete-user/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server deletion failed with status ${response.status}`);
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUserRecord?.id === userId) {
        setSelectedUserRecord(null);
      }
      alert(lang === "ar" ? "تم حذف حساب المستخدم وجميع ملفاته وسجلاته من قاعدة البيانات والمصادقة بنجاح!" : "User account, files, and auth credentials deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting user account:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(
        lang === "ar" 
          ? `حدث خطأ أثناء حذف حساب المستخدم: ${errMsg}` 
          : `Error deleting user account: ${errMsg}`
      );
      // Refresh the admin user list on failure
      await loadAdminData();
    }
  };

  const getUserActivityStatus = (lastActiveAt?: string, createdAt?: string) => {
    const ts = lastActiveAt || createdAt;
    if (!ts) return { key: "offline", labelAr: "غير نشط", labelEn: "Offline" };
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMins / 60;

    if (diffMins <= 15) {
      return { key: "online", labelAr: "نشط الآن", labelEn: "Active Now" };
    } else if (diffHours <= 24) {
      return { key: "recent", labelAr: "نشاط حديث", labelEn: "Recently Active" };
    } else {
      return { key: "offline", labelAr: "غير نشط", labelEn: "Offline" };
    }
  };

  const loadAdminData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const records = await fetchAllUsersForAdmin();
      setUsers(records);
      // If a user was selected, update their record in state too
      if (selectedUserRecord) {
        const updated = records.find(r => r.id === selectedUserRecord.id);
        if (updated) setSelectedUserRecord(updated);
      }
    } catch (err: any) {
      console.error("Error loading admin data:", err);
      setError(err?.message || "Failed to load users list from Firestore");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutFirebaseUser();
      onLogout();
    } catch (err) {
      console.error("Logout error:", err);
      onLogout();
    }
  };

  // Filtered users list
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.companyName && u.companyName.toLowerCase().includes(q)) ||
      (u.ownerName && u.ownerName.toLowerCase().includes(q))
    );
  });

  // Calculate high-level stats
  const totalUsers = users.length;
  const totalFiles = users.reduce((acc, u) => acc + u.fileCount, 0);
  const totalStorageBytes = users.reduce((acc, u) => {
    const userFilesSize = u.files.reduce((fAcc, f) => fAcc + (f.fileSize || 0), 0);
    return acc + userFilesSize;
  }, 0);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(lang === "ar" ? "ar-SA" : (lang === "fr" ? "fr-FR" : "en-US"), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* TOP SYSTEM ADMIN NAVBAR */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors bg-[var(--bg-secondary)] border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* BRAND & ADMIN BADGE */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight">ZAKIR</span>
                
                {/* PROMINENT ADMIN BADGE */}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 border border-rose-500/40 text-rose-500 shadow-sm animate-pulse">
                  <Shield className="w-3 h-3" />
                  {lang === "ar" ? "لوحة الأدمن" : (lang === "fr" ? "Abonné Admin" : "Admin Dashboard")}
                </span>
              </div>
              <span className="block text-[11px] text-slate-400 font-mono">
                {lang === "ar" ? "إدارة نظام قاعدة البيانات والملفات المؤسسية" : "System Administration & Multi-Tenant Data Vault"}
              </span>
            </div>
          </div>

          {/* ADMIN ACTION CONTROLS */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme switch */}
            <button
              onClick={() => toggleTheme(theme === "dark" ? "light" : "dark")}
              className={`p-2 rounded-lg border transition-all ${
                theme === "dark" ? "bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-amber-400" : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
              }`}
              title={lang === "ar" ? "تغيير المظهر" : "Toggle Theme"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Refresh button */}
            <button
              onClick={() => loadAdminData(true)}
              disabled={refreshing || loading}
              className={`p-2 rounded-lg border transition-all ${
                theme === "dark" ? "bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300" : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700"
              }`}
              title={lang === "ar" ? "تحديث البيانات" : "Refresh Firestore Data"}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-amber-500" : ""}`} />
            </button>

            {/* Admin Profile Chip */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-rose-400 font-semibold">{currentUser.email || "admin@system"}</span>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "خروج" : "Logout"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN ADMIN BODY */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* BANNER NOTIFICATION */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0075DE]/10 via-rose-500/10 to-purple-500/10 border border-[#0075DE]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#0075DE]/20 text-blue-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {lang === "ar" ? "وضع مسؤول النظام الرئيسي (Super Administrator)" : "System Super Administrator Control Panel"}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-rose-500 text-white uppercase tracking-wider">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {lang === "ar" 
                  ? "تمنحك هذه الواجهة الوصول الشامل إلى جميع الحسابات والملفات المرفوعة في قاعدة بيانات Firestore المستضافة. يمكنك الاستعراض والتحقق من ملفات المستخدمين مباشرة."
                  : "This panel grants root-level oversight across all Firestore user accounts and uploaded files. Click on any user row below to inspect their uploaded documents."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700/60 font-mono text-xs text-slate-300 shrink-0">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>ID: <strong className="text-blue-400">{currentUser.id}</strong></span>
          </div>
        </div>

        {/* ADMIN VIEW TABS */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveAdminTab("users")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeAdminTab === "users"
                ? "bg-[#0075DE] text-white shadow-lg shadow-[#0075DE]/20"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{lang === "ar" ? "إدارة المستخدمين والوثائق" : "Users Directory & Document Vaults"}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950/40 text-xs font-mono">
              {totalUsers}
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab("support")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeAdminTab === "support"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            <span>{lang === "ar" ? "مركز خدمة ودعم العملاء" : "Customer Support Center"}</span>
            {supportTickets.filter(t => t.status === "Open" || t.status === "In Progress").length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-mono font-black animate-pulse">
                {supportTickets.filter(t => t.status === "Open" || t.status === "In Progress").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab("reactivations")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeAdminTab === "reactivations"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
                : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{lang === "ar" ? "طلبات إعادة التفعيل" : "Reactivation Requests"}</span>
            {reactivationRequests.filter(r => r.status === "pending").length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-mono font-black animate-pulse">
                {reactivationRequests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>

        {activeAdminTab === "users" && (
          <div className="space-y-8">
            {/* METRICS STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className={`p-5 rounded-2xl border transition-all ${
                theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {lang === "ar" ? "إجمالي المستخدمين" : "Total Users"}
                  </span>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black mt-2 font-mono text-blue-400">{totalUsers}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {lang === "ar" ? "حسابات مسجلة في Firestore" : "Registered Firestore accounts"}
                </span>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${
                theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {lang === "ar" ? "إجمالي الملفات المرفوعة" : "Total Files Uploaded"}
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black mt-2 font-mono text-emerald-400">{totalFiles}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {lang === "ar" ? "ملفات مرفوعة عبر كل الحسابات" : "Documents stored across all accounts"}
                </span>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${
                theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {lang === "ar" ? "حجم التخزين المستهلك" : "Storage Consumed"}
                  </span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <HardDrive className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-black mt-2 font-mono text-amber-400">{formatBytes(totalStorageBytes)}</p>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {lang === "ar" ? "سعة Firebase Storage الإجمالية" : "Total Firebase Storage payload"}
                </span>
              </div>
            </div>
            {/* SEARCH AND USERS TABLE CONTAINER */}
            <div className={`p-6 rounded-2xl border ${
              theme === "dark" ? "bg-slate-900/70 border-slate-800 shadow-2xl" : "bg-white border-slate-200 shadow-md"
            }`}>
          {/* TABLE HEADER & SEARCH INPUT */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                {lang === "ar" ? "قائمة جميع المستخدمين في قاعدة البيانات" : "All Users Directory (Firestore)"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === "ar" ? "انقر على أي مستخدم لعرض ملفاته وتفاصيل حسابه" : "Click on any user row to inspect their uploaded files and account profile"}
              </p>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute top-3 left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "ar" ? "بحث عن البريد أو الشركة..." : "Search email, company, owner..."}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border transition-all ${
                  theme === "dark" 
                    ? "bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none" 
                    : "bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute top-2.5 right-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-400 animate-pulse">
                {lang === "ar" ? "جاري تحميل بيانات المستخدمين والملفات من Firestore..." : "Fetching users directory & files from Firestore..."}
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium my-6 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm font-medium">
                {searchQuery ? (lang === "ar" ? "لم يتم العثور على مستخدمين يطابقون البحث" : "No users match your search query.") : (lang === "ar" ? "لا يوجد مستخدمون في قاعدة البيانات حالياً" : "No user documents found in Firestore.")}
              </p>
            </div>
          ) : (
            /* USERS TABLE */
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-xs font-bold uppercase tracking-wider ${
                    theme === "dark" ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="py-3 px-4">{lang === "ar" ? "المستخدم والبريد" : "User & Email"}</th>
                    <th className="py-3 px-4">{lang === "ar" ? "حالة النشاط" : "Activity Status"}</th>
                    <th className="py-3 px-4">{lang === "ar" ? "حالة التحقق" : "Verification Status"}</th>
                    <th className="py-3 px-4">{lang === "ar" ? "تاريخ الإنشاء" : "Account Creation Date"}</th>
                    <th className="py-3 px-4 text-center">{lang === "ar" ? "عدد الملفات" : "Uploaded Files"}</th>
                    <th className="py-3 px-4">{lang === "ar" ? "المؤسسة / الدور" : "Company & Role"}</th>
                    <th className="py-3 px-4 text-right">{lang === "ar" ? "الإجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {filteredUsers.map((record) => {
                    const isAdminUser = record.id === currentUser.id;
                    const isPrimaryAdmin = record.id === ADMIN_USER_ID;
                    const isDeletable = !isAdminUser && !isPrimaryAdmin;
                    const verStatus = record.verificationInfo?.status || "unverified";
                    return (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedUserRecord(record)}
                        className={`group cursor-pointer transition-colors ${
                          theme === "dark" 
                            ? "hover:bg-amber-500/10" 
                            : "hover:bg-slate-100"
                        } ${selectedUserRecord?.id === record.id ? (theme === "dark" ? "bg-amber-500/15" : "bg-amber-50") : ""}`}
                      >
                        {/* EMAIL & USER ID */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              isAdminUser 
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" 
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}>
                              {record.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 dark:text-white text-sm group-hover:text-amber-400 transition-colors">
                                  {record.email}
                                </span>
                                {isAdminUser && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white uppercase">
                                    CURRENT ADMIN
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono block">
                                ID: {record.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ACTIVITY STATUS */}
                        <td className="py-4 px-4">
                          {(() => {
                            const act = getUserActivityStatus(record.lastActiveAt, record.createdAt);
                            if (act.key === "online") {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                  {lang === "ar" ? act.labelAr : act.labelEn}
                                </span>
                              );
                            }
                            if (act.key === "recent") {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                  {lang === "ar" ? act.labelAr : act.labelEn}
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                {lang === "ar" ? act.labelAr : act.labelEn}
                              </span>
                            );
                          })()}
                        </td>

                        {/* VERIFICATION BADGE */}
                        <td className="py-4 px-4 space-y-1">
                          {(() => {
                            const isEmailVer = !!((record as any).fullUser?.emailVerified || (record as any).emailVerified || (record as any).isEmailVerified || (record as any).email_verified || (record as any).isVerified);
                            const docSt = record.verificationInfo?.status || "unverified";
                            const isFullyVer = isEmailVer && docSt === "verified";
                            return (
                              <div className="flex flex-col gap-1 text-[11px]">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <span className="text-slate-400">Email:</span>
                                  {isEmailVer ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3"/> {lang === "ar" ? "موثق" : "Verified"}</span>
                                  ) : (
                                    <span className="text-rose-400 font-bold flex items-center gap-0.5"><AlertCircle className="w-3 h-3"/> {lang === "ar" ? "غير موثق" : "Not Verified"}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 font-medium">
                                  <span className="text-slate-400">Docs:</span>
                                  {docSt === "verified" ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3"/> {lang === "ar" ? "معتمدة" : "Verified"}</span>
                                  ) : docSt === "under_review" ? (
                                    <span className="text-amber-400 font-bold flex items-center gap-0.5"><Clock className="w-3 h-3"/> {lang === "ar" ? "قيد الدراسة" : "Review"}</span>
                                  ) : docSt === "action_required" ? (
                                    <span className="text-rose-400 font-bold flex items-center gap-0.5"><AlertCircle className="w-3 h-3"/> {lang === "ar" ? "ناقصة" : "Missing"}</span>
                                  ) : (
                                    <span className="text-slate-400 font-bold flex items-center gap-0.5"><Info className="w-3 h-3"/> {lang === "ar" ? "غير مقدمة" : "Pending"}</span>
                                  )}
                                </div>
                                <div className="pt-0.5">
                                  {isFullyVer ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {lang === "ar" ? "مكتمل التحقق" : "Fully Verified"}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                      <AlertCircle className="w-3 h-3" />
                                      {lang === "ar" ? "غير مكتمل التحقق" : "Not Fully Verified"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* CREATION DATE */}
                        <td className="py-4 px-4 font-mono text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formatDate(record.createdAt)}</span>
                          </div>
                        </td>

                        {/* FILE COUNT */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                            record.fileCount > 0 
                              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400" 
                              : "bg-slate-800 border border-slate-700 text-slate-400"
                          }`}>
                            <FileText className="w-3.5 h-3.5" />
                            {record.fileCount} {lang === "ar" ? "ملف" : "files"}
                          </span>
                        </td>

                        {/* COMPANY & ROLE */}
                        <td className="py-4 px-4">
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {record.companyName || record.ownerName || "Default Workspace"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {record.role || "CEO"}
                            </span>
                          </div>
                        </td>

                        {/* ACTION BUTTONS */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserRecord(record);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0075DE]/10 hover:bg-[#0075DE]/20 border border-[#0075DE]/30 text-blue-400 font-semibold transition-all text-xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "استعراض" : "View"}</span>
                            </button>
                            {isDeletable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUserAccount(record.id, record.email);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold transition-all text-xs cursor-pointer"
                                title={lang === "ar" ? "حذف الحساب نهائياً" : "Delete Account"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{lang === "ar" ? "حذف الحساب" : "Delete"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

        {/* CUSTOMER SUPPORT TICKETS MANAGEMENT SECTION */}
        {activeAdminTab === "support" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* TICKET LIST SIDEBAR */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 rounded-2xl border flex flex-col gap-3 bg-slate-900/70 border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs sm:text-sm flex items-center gap-2 text-indigo-400">
                    <LifeBuoy className="w-4 h-4" />
                    <span>{lang === "ar" ? "تذاكر الدعم الواردة" : "Support Inbox"}</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-mono text-indigo-300">
                    {supportTickets.length} {lang === "ar" ? "طلب" : "requests"}
                  </span>
                </div>

                {/* SEARCH & FILTER */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute top-2.5 left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={ticketSearchQuery}
                    onChange={(e) => setTicketSearchQuery(e.target.value)}
                    placeholder={lang === "ar" ? "البحث عن البريد أو التذكرة..." : "Search tickets, user email..."}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="All">{lang === "ar" ? "جميع الحالات" : "All Statuses"}</option>
                    <option value="Open">{lang === "ar" ? "مفتوحة" : "Open"}</option>
                    <option value="In Progress">{lang === "ar" ? "قيد المتابعة" : "In Progress"}</option>
                    <option value="Waiting for User">{lang === "ar" ? "بانتظار رد المستخدم" : "Waiting for User"}</option>
                    <option value="Resolved">{lang === "ar" ? "تم الحل" : "Resolved"}</option>
                    <option value="Closed">{lang === "ar" ? "مغلقة" : "Closed"}</option>
                  </select>
                </div>
              </div>

              {/* LIST CONTAINER */}
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {supportFetchError ? (
                  <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-4 text-rose-400">
                    <h3 className="text-sm font-bold">{lang === "ar" ? "خطأ في التحميل" : "Loading Error"}</h3>
                    <p className="text-xs">{supportFetchError}</p>
                  </div>
                ) : supportTickets
                  .filter((t) => {
                    const statusMatch = ticketStatusFilter === "All" || t.status === ticketStatusFilter;
                    const searchMatch = !ticketSearchQuery.trim() || 
                      (t.userEmail || "").toLowerCase().includes(ticketSearchQuery.toLowerCase()) || 
                      (t.subject || "").toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
                      (t.id || "").toLowerCase().includes(ticketSearchQuery.toLowerCase());
                    return statusMatch && searchMatch;
                  })
                  .map((t) => {
                    const isSelected = selectedTicket?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-950/30 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20"
                            : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            t.status === "Open" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                            t.status === "In Progress" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            t.status === "Waiting for User" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {t.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            t.priority === "Urgent" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                            t.priority === "High" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                            "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}>
                            {t.priority}
                          </span>
                        </div>

                        <h5 className="font-bold text-xs sm:text-sm text-slate-200 line-clamp-1 mb-1">
                          {t.subject}
                        </h5>

                        <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                          {t.message}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/50 pt-2 font-mono">
                          <span className="truncate max-w-[150px]">{t.userEmail}</span>
                          <span>{safeFormatDate(t.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* CONVERSATION THREAD */}
            <div className="lg:col-span-8 space-y-4">
              {selectedTicket ? (
                <div className="border rounded-2xl flex flex-col h-[650px] shadow-2xl overflow-hidden bg-slate-900/90 border-slate-800">
                  {/* Thread Header */}
                  <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-indigo-400">#{selectedTicket.id}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300">
                          {selectedTicket.category}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-extrabold text-white">
                        {selectedTicket.subject}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        By <strong className="text-slate-200 font-semibold">{selectedTicket.userName}</strong> ({selectedTicket.userEmail}) {selectedTicket.userPhone && `• ${selectedTicket.userPhone}`}
                      </p>
                    </div>

                    {/* Quick status actions */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateTicketStatus(e.target.value as SupportStatus)}
                        disabled={isUpdatingTicketStatus}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting for User">Waiting for User</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>

                      <select
                        value={selectedTicket.priority}
                        onChange={(e) => handleUpdateTicketPriority(e.target.value as SupportPriority)}
                        disabled={isUpdatingTicketStatus}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Conversation Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-950/20">
                    {/* User's Original Ticket Message */}
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-black text-xs">
                        U
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                          <span className="font-bold text-slate-300">{selectedTicket.userName}</span>
                          <span>•</span>
                          <span>{safeFormatDateTime(selectedTicket.createdAt)}</span>
                        </div>
                        <div className="p-4 rounded-2xl rounded-tl-none text-xs sm:text-sm bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed shadow-sm">
                          {selectedTicket.message}
                        </div>
                      </div>
                    </div>

                    {/* Thread replies */}
                    {(selectedTicket.messages || []).map((msg, idx) => {
                      const isAdmin = msg.senderType === "admin";
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex gap-3 max-w-[85%] ${isAdmin ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                            isAdmin ? "bg-[#0075DE] text-white font-black" : "bg-indigo-600/20 text-indigo-400"
                          }`}>
                            {isAdmin ? <Bot className="w-4 h-4" /> : "U"}
                          </div>

                          <div className={`space-y-1 ${isAdmin ? "text-right" : "text-left"}`}>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                              <span className="font-semibold text-slate-300">{msg.senderName}</span>
                              <span>•</span>
                              <span>{safeFormatTime(msg.createdAt)}</span>
                            </div>

                            <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                              isAdmin 
                                ? "bg-[#0075DE] text-white font-medium rounded-tr-none shadow-md shadow-blue-500/10" 
                                : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm"
                            }`}>
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Internal Admin Notes */}
                  <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-3">
                    <span className="text-[10px] uppercase font-black tracking-wider text-blue-400 shrink-0">Internal Note:</span>
                    <input
                      type="text"
                      value={adminNotesInput}
                      onChange={(e) => setAdminNotesInput(e.target.value)}
                      placeholder="Add private note (only visible to support admins)..."
                      className="flex-1 bg-transparent border-none text-xs text-slate-300 focus:outline-none placeholder:text-slate-600"
                    />
                    <button
                      onClick={handleSaveAdminNotes}
                      className="px-3 py-1 rounded bg-[#0075DE] hover:bg-blue-600 text-white font-bold text-[10px] transition-all cursor-pointer"
                    >
                      Save Note
                    </button>
                  </div>

                  {/* Reply Input Form */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950/60">
                    <form onSubmit={handleSendAdminReply} className="flex gap-2">
                      <input
                        type="text"
                        value={adminReplyMessage}
                        onChange={(e) => setAdminReplyMessage(e.target.value)}
                        placeholder={lang === "ar" ? "اكتب الرد الرسمي للمستخدم هنا..." : "Type official response to send to customer..."}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={isSendingAdminReply || !adminReplyMessage.trim()}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                      >
                        {isSendingAdminReply ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>{lang === "ar" ? "إرسال الرد" : "Send Response"}</span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="h-[650px] border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900/50">
                  <MessageSquare className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-sm font-bold">
                    {lang === "ar" ? "اختر تذكرة دعم من القائمة لعرض تفاصيلها والرد عليها" : "Select a support ticket from the inbox to manage and reply"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACCOUNT REACTIVATIONS SECTION */}
        {activeAdminTab === "reactivations" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>{lang === "ar" ? "طلبات إعادة تفعيل الحسابات المحذوفة" : "Account Reactivation Requests"}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "ar"
                    ? "مراجعة واعتماد طلبات المستخدمين الذين تم تعطيل حساباتهم بواسطة الإدارة ويرغبون في إعادة التسجيل بنفس البريد الإلكتروني."
                    : "Review and approve requests from users whose accounts were disabled by an administrator."}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {/* Status Filter */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                  <button
                    onClick={() => setReactivationFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      reactivationFilter === "all" ? "bg-amber-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {lang === "ar" ? "الكل" : "All"} ({reactivationRequests.length})
                  </button>
                  <button
                    onClick={() => setReactivationFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      reactivationFilter === "pending" ? "bg-amber-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {lang === "ar" ? "قيد المراجعة" : "Pending"} ({reactivationRequests.filter(r => r.status === "pending").length})
                  </button>
                  <button
                    onClick={() => setReactivationFilter("approved")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      reactivationFilter === "approved" ? "bg-amber-600 text-white font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {lang === "ar" ? "معتمدة" : "Approved"} ({reactivationRequests.filter(r => r.status === "approved").length})
                  </button>
                </div>

                <button
                  onClick={fetchReactivationRequests}
                  disabled={loadingReactivations}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingReactivations ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* LIST OR EMPTY */}
            {reactivationRequests.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-300">
                  {lang === "ar" ? "لا توجد طلبات إعادة تفعيل حالياً" : "No pending reactivation requests found"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === "ar" ? "جميع الحسابات المعطلة في وضع سليم." : "All disabled accounts are in good standing."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reactivationRequests
                  .filter(r => reactivationFilter === "all" || r.status === reactivationFilter)
                  .map((req) => {
                    const isPending = req.status === "pending";
                    const isApproved = req.status === "approved";
                    const isProcessing = actionInProgress === req.email;

                    return (
                      <div
                        key={req.id || req.email}
                        className="p-5 rounded-2xl border bg-slate-900/70 border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-sm font-bold text-white">{req.email}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                isPending
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : isApproved
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              }`}>
                                {isPending
                                  ? (lang === "ar" ? "قيد مراجعة الإدارة" : "Pending Review")
                                  : isApproved
                                  ? (lang === "ar" ? "معتمد (مسموح بالتسجيل)" : "Approved (Can Register)")
                                  : (lang === "ar" ? "مرفوض (محظور)" : "Rejected")}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                              <span>{lang === "ar" ? "تاريخ الطلب:" : "Requested:"} {safeFormatDateTime(req.requestedAt)}</span>
                              {req.handledAt && (
                                <span>• {lang === "ar" ? "تاريخ المعالجة:" : "Handled:"} {safeFormatDateTime(req.handledAt)}</span>
                              )}
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-2">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => handleReactivationDecision(req.email, "approve")}
                                  disabled={isProcessing}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                                >
                                  {isProcessing ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span>{lang === "ar" ? "موافقة واعتماد" : "Approve"}</span>
                                </button>

                                <button
                                  onClick={() => handleReactivationDecision(req.email, "reject")}
                                  disabled={isProcessing}
                                  className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>{lang === "ar" ? "رفض" : "Reject"}</span>
                                </button>
                              </>
                            ) : isApproved ? (
                              <button
                                onClick={() => handleReactivationDecision(req.email, "reject")}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs rounded-xl transition-all cursor-pointer"
                              >
                                {lang === "ar" ? "إلغاء الاعتماد وحظر" : "Revoke Approval"}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivationDecision(req.email, "approve")}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs rounded-xl transition-all cursor-pointer"
                              >
                                {lang === "ar" ? "إعادة النظر والموافقة" : "Re-approve"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* REASON */}
                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                          <span className="text-slate-400 font-bold block mb-1">
                            {lang === "ar" ? "سبب طلب إعادة التفعيل المرسل من المستخدم:" : "Reason provided by user:"}
                          </span>
                          <p className="text-slate-200 leading-relaxed font-sans">
                            {req.reason || (lang === "ar" ? "(لم يقدم المستخدم سبباً تفصيلياً)" : "(No specific reason provided)")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* USER FILES INSPECTION MODAL */}
      {selectedUserRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl w-full rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)]">
            {/* MODAL HEADER */}
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between gap-4 bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0075DE]/20 border border-[#0075DE]/40 flex items-center justify-center text-blue-400 font-bold">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">
                      {lang === "ar" ? `ملفات المستخدم: ${selectedUserRecord.email}` : `Uploaded Files for ${selectedUserRecord.email}`}
                    </h3>
                    {selectedUserRecord.id === currentUser.id && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500 text-white">ADMIN</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    User ID: {selectedUserRecord.id} • Registered: {formatDate(selectedUserRecord.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedUserRecord.id !== currentUser.id && selectedUserRecord.id !== ADMIN_USER_ID && (
                  <button
                    onClick={() => handleDeleteUserAccount(selectedUserRecord.id, selectedUserRecord.email)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-all cursor-pointer"
                    title={lang === "ar" ? "حذف حساب المستخدم نهائياً" : "Delete User Account"}
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>{lang === "ar" ? "حذف الحساب" : "Delete Account"}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedUserRecord(null);
                    setSelectedFileForPreview(null);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL CONTENT BODY */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* USER PROFILE CARD SUMMARY */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block">{lang === "ar" ? "البريد الإلكتروني:" : "User Email:"}</span>
                  <strong className="text-amber-400 text-sm block truncate">{selectedUserRecord.email}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{lang === "ar" ? "حالة النشاط:" : "Activity Status:"}</span>
                  {(() => {
                    const act = getUserActivityStatus(selectedUserRecord.lastActiveAt, selectedUserRecord.createdAt);
                    return (
                      <strong className={`block ${act.key === "online" ? "text-emerald-400" : act.key === "recent" ? "text-amber-400" : "text-slate-400"}`}>
                        {lang === "ar" ? act.labelAr : act.labelEn}
                      </strong>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-slate-400 block">{lang === "ar" ? "آخر ظهور / نشاط:" : "Last Active:"}</span>
                  <strong className="text-slate-200 block">{formatDate(selectedUserRecord.lastActiveAt || selectedUserRecord.createdAt)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{lang === "ar" ? "إجمالي المستندات:" : "Total Documents:"}</span>
                  <strong className="text-emerald-400 block">{selectedUserRecord.fileCount} {lang === "ar" ? "ملف مرفوع" : "uploaded files"}</strong>
                </div>
              </div>

              {/* ACCOUNT VERIFICATION CONTROL PANEL FOR ADMIN */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-[#0075DE]/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                    <h4 className="font-bold text-sm text-slate-100">
                      {lang === "ar" ? "لوحة تدقيق وفصل حالات التحقق (البريد والوثائق)" : "Verification Audit Panel (Email vs Documents)"}
                    </h4>
                  </div>
                  <div>
                    {(() => {
                      const isEmailVer = !!((selectedUserRecord as any).fullUser?.emailVerified || (selectedUserRecord as any).emailVerified || (selectedUserRecord as any).isEmailVerified || (selectedUserRecord as any).email_verified || (selectedUserRecord as any).isVerified);
                      const docSt = selectedUserRecord.verificationInfo?.status || "unverified";
                      const isFullyVer = isEmailVer && docSt === "verified";
                      if (isFullyVer) {
                        return (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            {lang === "ar" ? "الحساب مكتمل التحقق Fully Verified" : "Account Fully Verified"}
                          </span>
                        );
                      }
                      return (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0075DE]/20 text-blue-300 border border-[#0075DE]/40 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          {lang === "ar" ? "الحساب غير مكتمل التحقق" : "Account Not Fully Verified"}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Independent status rows */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Email Verification Status */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-bold">{lang === "ar" ? "التحقق من البريد الإلكتروني" : "Email Verification"}</span>
                      <span className="text-xs font-bold text-slate-200">{selectedUserRecord.email}</span>
                    </div>
                    {(() => {
                      const isEmailVer = !!((selectedUserRecord as any).fullUser?.emailVerified || (selectedUserRecord as any).emailVerified || (selectedUserRecord as any).isEmailVerified || (selectedUserRecord as any).email_verified || (selectedUserRecord as any).isVerified);
                      return isEmailVer ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {lang === "ar" ? "Verified" : "Verified"}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {lang === "ar" ? "Not Verified" : "Not Verified"}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Document Verification Status */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-bold">{lang === "ar" ? "التحقق من الوثائق والمستندات" : "Document Verification"}</span>
                      <span className="text-xs font-bold text-slate-200">{selectedUserRecord.verificationInfo?.documents?.length || 0} {lang === "ar" ? "مستندات مرفقة" : "docs attached"}</span>
                    </div>
                    {(() => {
                      const docSt = selectedUserRecord.verificationInfo?.status || "unverified";
                      if (docSt === "verified") {
                        return (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {lang === "ar" ? "Verified" : "Verified"}
                          </span>
                        );
                      }
                      if (docSt === "under_review") {
                        return (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {lang === "ar" ? "Under Review" : "Under Review"}
                          </span>
                        );
                      }
                      if (docSt === "action_required") {
                        return (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {lang === "ar" ? "Missing" : "Missing"}
                          </span>
                        );
                      }
                      return (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" />
                          {lang === "ar" ? "Unverified" : "Unverified"}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* ACTION BUTTONS FOR ADMIN */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    disabled={savingVerification}
                    onClick={() => handleUpdateUserVerification("verified")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/30"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === "ar" ? "اعتماد وتوثيق الحساب (تم التحقق)" : "Approve & Verify Account"}</span>
                  </button>

                  <button
                    disabled={savingVerification}
                    onClick={() => handleUpdateUserVerification("action_required")}
                    className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{lang === "ar" ? "إخطار بوجود ملفات ناقصة" : "Mark as Missing Files"}</span>
                  </button>

                  <button
                    disabled={savingVerification}
                    onClick={() => handleUpdateUserVerification("under_review")}
                    className="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{lang === "ar" ? "تحويل إلى قيد الدراسة والتحقق" : "Set Under Review"}</span>
                  </button>
                </div>

                {/* ADMIN MISSING FILES NOTE TEXTAREA */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-300">
                    {lang === "ar" 
                      ? "ملاحظات الإدارة للطلب / وصف الملفات الناقصة المطلوبة لتفعيل الحساب:" 
                      : "Admin Note / Description of Missing Files Required for Activation:"}
                  </label>
                  <textarea
                    rows={3}
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    placeholder={
                      lang === "ar"
                        ? "اكتب هنا تفاصيل الملفات الناقصة والمستندات الرسمية المطلوبة من المستخدم لتفعيل حسابه..."
                        : "Specify missing documents or guidelines for the user to upload..."
                    }
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-[#0075DE] focus:outline-none transition-all placeholder:text-slate-600"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      {lang === "ar" ? "سيظهر هذا الوصف مباشرة للمستخدم في واجهة حسابه." : "This note will be displayed directly on user's verification panel."}
                    </span>
                    <button
                      disabled={savingVerification}
                      onClick={() => {
                        const currentStatus = selectedUserRecord.verificationInfo?.status || "action_required";
                        handleUpdateUserVerification(currentStatus, adminNoteInput);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0075DE] hover:bg-blue-600 text-white font-black text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "حفظ وإرسال الملاحظات" : "Save & Send Note"}</span>
                    </button>
                  </div>
                </div>

                {/* DISPLAY VERIFICATION DOCUMENTS IN ADMIN PANEL IF AVAILABLE */}
                {selectedUserRecord.verificationInfo?.documents && selectedUserRecord.verificationInfo.documents.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-800">
                    <span className="text-xs font-bold text-blue-400 block">
                      {lang === "ar" ? "وثائق ومستندات التحقق المرفوعة من المستخدم:" : "Verification Documents Uploaded by User:"}
                    </span>
                    <div className="space-y-2">
                      {selectedUserRecord.verificationInfo.documents.map((doc) => (
                        <div key={doc.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="font-bold text-slate-200 truncate">{doc.fileName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({doc.docType || "ID Document"})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => openUserFileInNewTab({ fileName: doc.fileName, fileUrl: doc.fileUrl, mimeType: doc.mimeType, uploadDate: doc.uploadDate, category: "Verification" })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] transition-all cursor-pointer border border-emerald-500/30"
                              title={lang === "ar" ? "عرض في نافذة جديدة" : "View in new tab"}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "عرض" : "View"}</span>
                            </button>
                            <button
                              onClick={() => downloadUserFile({ fileName: doc.fileName, fileUrl: doc.fileUrl, mimeType: doc.mimeType, uploadDate: doc.uploadDate, category: "Verification" })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-[11px] transition-all cursor-pointer border border-sky-500/30"
                              title={lang === "ar" ? "تنزيل الملف" : "Download file"}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{lang === "ar" ? "تنزيل" : "Download"}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUserVerDoc(doc.id, doc.fileName)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-[11px] transition-all cursor-pointer border border-rose-500/30"
                              title={lang === "ar" ? "حذف المستند" : "Delete document"}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>{lang === "ar" ? "حذف" : "Delete"}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {verificationSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{verificationSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* FILES LIST TITLE */}
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  {lang === "ar" ? "قائمة المستندات والملفات" : "User File Vault Listing"}
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedUserRecord.files.length} {lang === "ar" ? "عنصر" : "items"}
                </span>
              </div>

              {/* FILES LIST */}
              {selectedUserRecord.files.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-800 rounded-xl text-center space-y-3">
                  <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-xs font-medium">
                    {lang === "ar" ? "لم يقم هذا المستخدم برفع أي ملفات حتى الآن." : "This user has not uploaded any files yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedUserRecord.files.map((file) => (
                    <div
                      key={file.id}
                      className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-100 truncate block">
                              {file.fileName}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {file.category || "General"}
                            </span>
                            {file.isEncrypted && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                Encrypted
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono flex-wrap">
                            <span>Uploaded: {formatDate(file.uploadDate)}</span>
                            <span>•</span>
                            <span>Size: {formatBytes(file.fileSize || 0)}</span>
                            <span>•</span>
                            <span>Type: {file.mimeType || "file"}</span>
                          </div>

                          {file.description && (
                            <p className="text-xs text-slate-300 mt-1 bg-slate-900/50 p-2 rounded border border-slate-800">
                              {file.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => openUserFileInNewTab(file)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all cursor-pointer shadow-sm"
                          title={lang === "ar" ? "عرض في نافذة جديدة" : "View in new tab"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? "عرض" : "View"}</span>
                        </button>
                        <button
                          onClick={() => downloadUserFile(file)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-xs transition-all cursor-pointer shadow-sm"
                          title={lang === "ar" ? "تنزيل الملف" : "Download file"}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === "ar" ? "تنزيل" : "Download"}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUserVerDoc(file.id, file.fileName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-all cursor-pointer shadow-sm"
                          title={lang === "ar" ? "حذف الملف" : "Delete file"}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>{lang === "ar" ? "حذف" : "Delete"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Firestore Access Mode: <strong className="text-rose-400">ADMIN SUPERUSER READ</strong>
              </span>
              <button
                onClick={() => setSelectedUserRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
              >
                {lang === "ar" ? "إغلاق" : "Close Window"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
