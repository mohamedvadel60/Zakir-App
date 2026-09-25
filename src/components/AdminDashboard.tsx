import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  AdminHeader 
} from "./admin/AdminHeader.js";
import { 
  AdminSidebar 
} from "./admin/AdminSidebar.js";
import { 
  AdminOverviewTab 
} from "./admin/tabs/AdminOverviewTab.js";
import { 
  AdminUsersTab 
} from "./admin/tabs/AdminUsersTab.js";
import { 
  AdminVerificationsTab 
} from "./admin/tabs/AdminVerificationsTab.js";
import { 
  AdminRecoveryTab 
} from "./admin/tabs/AdminRecoveryTab.js";
import { 
  AdminSupportTab 
} from "./admin/tabs/AdminSupportTab.js";
import { 
  AdminSubscriptionsTab 
} from "./admin/tabs/AdminSubscriptionsTab.js";
import { 
  UserDetailModal 
} from "./admin/modals/UserDetailModal.js";
import { 
  AdminTab, 
  PendingApprovalRecord, 
  RecoveryRequestRecord, 
  SubscriptionStats, 
  SubscriptionCorrectionRecord 
} from "./admin/adminTypes.js";
import { 
  AdminUserRecord, 
  fetchAllUsersForAdmin, 
  deleteAdminUserAccountApi,
  fetchAdminRecoveryRequestsApi,
  handleAdminRecoveryRequestDecisionApi,
  fetchSupportTicketsApi,
  addSupportTicketMessageApi,
  updateSupportTicketStatusApi,
  subscribeToSupportTickets,
  bulkAdminUserActionApi,
  computeUserVerificationBreakdown
} from "../lib/firebaseServices.js";
import { 
  authenticatedFetch, 
  safeJsonResponse, 
  getFreshAuthToken 
} from "../lib/apiUtils.js";
import { SupportTicket, SupportStatus, SupportPriority } from "../types.js";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface AdminDashboardProps {
  currentUser: any;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
  toggleLanguage?: (newLang: "ar" | "fr" | "en") => void;
  toggleTheme: (newTheme: "dark" | "light") => void;
  onLogout: () => void;
  onSwitchToWorkspace?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  lang,
  theme,
  toggleLanguage,
  toggleTheme,
  onLogout,
  onSwitchToWorkspace
}) => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [userTabFilter, setUserTabFilter] = useState<string>("all");

  // Core Data States
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalRecord[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequestRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [subscriptionCorrections, setSubscriptionCorrections] = useState<SubscriptionCorrectionRecord[]>([]);

  // Selected User Modal
  const [selectedUserRecord, setSelectedUserRecord] = useState<AdminUserRecord | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Status & Telemetry
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Main Data Loader
  const loadAllAdminData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const token = await getFreshAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Fetch Users
      const usersData = await fetchAllUsersForAdmin();
      setUsers(usersData || []);

      // 2. Fetch Pending Approvals from /api/admin/pending-approvals
      try {
        const res = await authenticatedFetch("/api/admin/pending-approvals");
        const json = await safeJsonResponse(res, "Failed to load approvals");
        if (json?.success && Array.isArray(json.pendingUsers)) {
          setPendingApprovals(json.pendingUsers);
        } else if (Array.isArray(json?.users)) {
          setPendingApprovals(json.users);
        } else {
          // Derive fallback pending from usersData (strictly only users with real pending verification requests or documents)
          const derived = usersData
            .filter((u) => {
              const breakdown = computeUserVerificationBreakdown(u);
              return (
                (breakdown.uiState === "PENDING_REVIEW" && breakdown.documentCount > 0) ||
                (breakdown.uiState === "AWAITING_DOCS")
              );
            })
            .map((u) => {
              const breakdown = computeUserVerificationBreakdown(u);
              return {
                id: (u as any).verificationRequestId || `vreq_${u.id}`,
                requestId: (u as any).verificationRequestId || `vreq_${u.id}`,
                userId: u.id,
                email: u.email,
                name: u.ownerName || u.email?.split("@")[0] || "User",
                userName: u.ownerName || u.email?.split("@")[0] || "User",
                companyName: u.companyName || "Organization",
                role: u.role || "Contributor",
                accountStatus: breakdown.accountApprovalStatus,
                requestStatus: breakdown.uiState === "PENDING_REVIEW" ? "UNDER_REVIEW" : "AWAITING_DOCUMENTS",
                documentCount: breakdown.documentCount,
                documents: breakdown.documents,
                createdAt: u.createdAt
              };
            });
          setPendingApprovals(derived);
        }
      } catch (e) {
        console.warn("Notice: /api/admin/pending-approvals fallback notice:", e);
      }

      // 3. Fetch Recovery Requests
      try {
        const recResult = await fetchAdminRecoveryRequestsApi(token || "");
        if (recResult?.success && Array.isArray(recResult.requests)) {
          setRecoveryRequests(recResult.requests);
        } else if (Array.isArray(recResult?.recoveryRequests)) {
          setRecoveryRequests(recResult.recoveryRequests);
        }
      } catch (e) {
        console.warn("Notice: recovery requests notice:", e);
      }

      // 4. Fetch Support Tickets
      try {
        const ticketsResult = await fetchSupportTicketsApi(undefined, undefined, true);
        if (Array.isArray(ticketsResult)) {
          setSupportTickets(ticketsResult);
        } else if (ticketsResult && Array.isArray((ticketsResult as any).tickets)) {
          setSupportTickets((ticketsResult as any).tickets);
        }
      } catch (e) {
        console.warn("Notice: support tickets notice:", e);
      }

      // 5. Fetch Subscription Corrections
      try {
        const corrRes = await authenticatedFetch("/api/admin/subscription-correction-requests");
        const corrJson = await safeJsonResponse(corrRes, "Corrections");
        if (corrJson?.success && Array.isArray(corrJson.requests)) {
          setSubscriptionCorrections(corrJson.requests);
        }
      } catch (e) {
        console.warn("Notice: corrections notice:", e);
      }

      setIsRealtimeConnected(true);
    } catch (err: any) {
      console.error("Admin data loading notice:", err);
      showToast("error", err?.message || "تعذر مزامنة بعض بيانات الإدارة");
      setIsRealtimeConnected(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial Load & Realtime Subscription Setup
  useEffect(() => {
    loadAllAdminData();

    // Subscribe to support tickets live
    const unsubscribeSupport = subscribeToSupportTickets("admin", true, (liveTickets) => {
      if (Array.isArray(liveTickets)) {
        setSupportTickets(liveTickets);
      }
    });

    return () => {
      if (typeof unsubscribeSupport === "function") unsubscribeSupport();
    };
  }, [loadAllAdminData]);

  // Handle Tab Navigation with Optional Filter
  const handleNavigateTab = (tab: AdminTab, filterParam?: string) => {
    setActiveTab(tab);
    if (tab === "users" && filterParam) {
      setUserTabFilter(filterParam);
    }
  };

  // Open User Detail Modal
  const handleOpenUserDetail = (user: AdminUserRecord) => {
    setSelectedUserRecord(user);
    setIsUserModalOpen(true);
  };

  // 1. Pure Account Approval (Account Activation - Independent of KYC)
  const handleApproveAccount = async (
    userId: string,
    plan = "Starter",
    trialHours = 24,
    notes = ""
  ) => {
    try {
      const res = await authenticatedFetch("/api/admin/approve-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          assignPlan: plan,
          customTrialHours: trialHours,
          notes,
          adminOverride: false
        })
      });
      const data = await safeJsonResponse(res, "Approve failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.userFriendlyMessage || "Failed to approve account");
      }

      // Optimistically update local users list for account status
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const full = (u.fullUser || {}) as any;
            return {
              ...u,
              accountStatus: "APPROVED",
              fullUser: {
                ...full,
                accountStatus: "APPROVED",
                subscriptionPlan: plan
              } as any
            };
          }
          return u;
        })
      );

      showToast("success", "تم تفعيل الحساب الأساسي بنجاح");
      if (selectedUserRecord?.id === userId) {
        setSelectedUserRecord((prev) =>
          prev ? { ...prev, accountStatus: "APPROVED" } : null
        );
      }
    } catch (err: any) {
      showToast("error", err?.message || "فشل تفعيل الحساب");
      throw err;
    }
  };

  // 1b. Approve Verification Documents & KYC (Requires submitted documents)
  const handleApproveDocuments = async (userId: string, notes = "") => {
    try {
      const res = await authenticatedFetch("/api/admin/approve-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notes })
      });
      const data = await safeJsonResponse(res, "Approve documents failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.userFriendlyMessage || data?.error || "Failed to approve documents");
      }

      // Optimistically update user KYC status
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const full = (u.fullUser || {}) as any;
            return {
              ...u,
              isVerified: true,
              kycStatus: "VERIFIED",
              documentVerificationStatus: "APPROVED",
              fullUser: {
                ...full,
                isVerified: true,
                kycStatus: "VERIFIED",
                documentVerificationStatus: "APPROVED",
                verificationRequestStatus: "APPROVED"
              } as any
            };
          }
          return u;
        })
      );

      // Remove from pending verification review queue
      setPendingApprovals((prev) => prev.filter((p) => p.userId !== userId && p.id !== userId));

      showToast("success", "تم اعتماد الوثائق وتوثيق الهوية المؤسسية بنجاح");
      if (selectedUserRecord?.id === userId) {
        setSelectedUserRecord((prev) =>
          prev ? { ...prev, isVerified: true, kycStatus: "VERIFIED", documentVerificationStatus: "APPROVED" } : null
        );
      }
    } catch (err: any) {
      showToast("error", err?.message || "فشل اعتماد الوثائق");
      throw err;
    }
  };

  // 1c. Reject Verification Documents (Sets document/KYC status to REJECTED)
  const handleRejectDocuments = async (userId: string, reason: string) => {
    try {
      const res = await authenticatedFetch("/api/admin/reject-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason })
      });
      const data = await safeJsonResponse(res, "Reject documents failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.userFriendlyMessage || data?.error || "Failed to reject documents");
      }

      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === userId) {
            const full = (u.fullUser || {}) as any;
            return {
              ...u,
              kycStatus: "REJECTED",
              documentVerificationStatus: "REJECTED",
              fullUser: {
                ...full,
                kycStatus: "REJECTED",
                documentVerificationStatus: "REJECTED",
                verificationRequestStatus: "REJECTED",
                rejectionReason: reason
              } as any
            };
          }
          return u;
        })
      );

      setPendingApprovals((prev) => prev.filter((p) => p.userId !== userId && p.id !== userId));

      showToast("success", "تم رفض وثائق التوثيق وإشعار المستخدم");
      if (selectedUserRecord?.id === userId) {
        setSelectedUserRecord((prev) =>
          prev ? { ...prev, kycStatus: "REJECTED", documentVerificationStatus: "REJECTED" } : null
        );
      }
    } catch (err: any) {
      showToast("error", err?.message || "فشل رفض الوثائق");
      throw err;
    }
  };

  // 2. Reject / Suspend Account
  const handleRejectAccount = async (userId: string, reason: string) => {
    try {
      const res = await authenticatedFetch("/api/admin/reject-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason })
      });
      const data = await safeJsonResponse(res, "Reject failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to reject account");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                isVerified: false,
                accountStatus: "REJECTED",
                fullUser: { ...(u.fullUser || {}), accountStatus: "REJECTED", isVerified: false } as any
              }
            : u
        )
      );

      showToast("success", "تم تعليق الحساب وتسجيل السبب");
    } catch (err: any) {
      showToast("error", err?.message || "فشل تعليق الحساب");
      throw err;
    }
  };

  // 3. Require Verification Documents
  const handleRequireDocuments = async (userId: string, reason: string) => {
    try {
      const res = await authenticatedFetch("/api/admin/require-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason })
      });
      const data = await safeJsonResponse(res, "Require docs failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to require documents");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                isVerified: false,
                accountStatus: "VERIFICATION_REQUIRED",
                fullUser: { ...(u.fullUser || {}), accountStatus: "VERIFICATION_REQUIRED" } as any
              }
            : u
        )
      );

      showToast("success", "تم إرسال طلب إعادة إرفاق المستندات للمستخدم");
    } catch (err: any) {
      showToast("error", err?.message || "فشل طلب المستندات");
      throw err;
    }
  };

  // 4. Extend Trial
  const handleExtendTrial = async (userId: string, hours: number, reason = "") => {
    try {
      const res = await authenticatedFetch("/api/admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, extensionHours: hours, reason })
      });
      const data = await safeJsonResponse(res, "Extend trial failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to extend trial");
      }

      showToast("success", `تم تمديد التجربة المجانية بمقدار ${hours} ساعة`);
    } catch (err: any) {
      showToast("error", err?.message || "فشل تمديد التجربة");
      throw err;
    }
  };

  // 5. Update User Subscription Plan
  const handleUpdateUserPlan = async (
    userId: string,
    plan: string,
    subscriptionStatus = "Active",
    notes = ""
  ) => {
    try {
      const res = await authenticatedFetch("/api/admin/update-user-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan, subscriptionStatus, notes })
      });
      const data = await safeJsonResponse(res, "Update plan failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to update user plan");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                fullUser: { ...(u.fullUser || {}), subscriptionPlan: plan, subscriptionStatus } as any
              }
            : u
        )
      );

      showToast("success", "تم تحديث ترخيص وباقة المستخدم بنجاح");
    } catch (err: any) {
      showToast("error", err?.message || "فشل تحديث باقة المستخدم");
      throw err;
    }
  };

  // 6. Delete User Account Permanently
  const handleDeleteUserAccount = async (userId: string, email: string) => {
    try {
      const result = await deleteAdminUserAccountApi(userId, email);
      if (!result?.success) {
        throw new Error(result?.message || "Failed to delete account");
      }

      // Remove from state
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setPendingApprovals((prev) => prev.filter((p) => p.userId !== userId && p.id !== userId));
      setSelectedUserRecord(null);
      setIsUserModalOpen(false);

      showToast("success", "تم حذف الحساب والبيانات التابعة له نهائيًا");
    } catch (err: any) {
      showToast("error", err?.message || "فشل حذف الحساب");
      throw err;
    }
  };

  // 7. Handle Recovery Request Decision
  const handleRecoveryDecision = async (
    requestId: string,
    email: string,
    action: "approve" | "reject",
    reason?: string
  ) => {
    try {
      const token = await getFreshAuthToken();
      const res = await handleAdminRecoveryRequestDecisionApi(
        token || "",
        requestId,
        email,
        action,
        reason,
        reason
      );
      if (!res?.success) {
        throw new Error(res?.error || "Failed to process recovery request");
      }

      setRecoveryRequests((prev) =>
        prev.map((r) =>
          (r.id === requestId || r.requestId === requestId)
            ? { ...r, status: action === "approve" ? "approved" : "rejected" }
            : r
        )
      );

      showToast(
        "success",
        action === "approve"
          ? "تمت الموافقة على استعادة الحساب وإشعار المستخدم"
          : "تم رفض طلب الاستعادة"
      );
    } catch (err: any) {
      showToast("error", err?.message || "فشل اتخاذ القرار في طلب الاستعادة");
      throw err;
    }
  };

  // 8. Support Ticket Operations
  const handleSendSupportMessage = async (ticketId: string, message: string) => {
    try {
      const res = await addSupportTicketMessageApi(ticketId, {
        senderType: "admin",
        senderName: currentUser?.name || "ZAKIR Admin",
        senderEmail: currentUser?.email || "admin@zakir.ai",
        message
      });
      if (!res?.success) {
        throw new Error(res?.error || "Failed to send reply");
      }

      // Optimistically append to local ticket
      setSupportTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                messages: [
                  ...(t.messages || []),
                  {
                    id: `msg_${Date.now()}`,
                    ticketId,
                    senderType: "admin",
                    senderName: currentUser?.name || "ZAKIR Admin",
                    senderEmail: currentUser?.email || "admin@zakir.ai",
                    message,
                    createdAt: new Date().toISOString()
                  }
                ]
              }
            : t
        )
      );

      showToast("success", "تم إرسال الرد للعميل");
    } catch (err: any) {
      showToast("error", err?.message || "فشل إرسال الرد");
      throw err;
    }
  };

  const handleUpdateTicketStatus = async (
    ticketId: string,
    status: SupportStatus,
    priority: SupportPriority,
    notes?: string
  ) => {
    try {
      const res = await updateSupportTicketStatusApi(ticketId, {
        status,
        priority,
        adminNotes: notes
      });
      if (!res?.success) {
        throw new Error(res?.error || "Failed to update ticket");
      }

      setSupportTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status, priority } : t))
      );

      showToast("success", "تم تحديث حالة تذكرة الدعم");
    } catch (err: any) {
      showToast("error", err?.message || "فشل تحديث التذكرة");
      throw err;
    }
  };

  // 9. Resolve Subscription Correction
  const handleResolveSubscriptionCorrection = async (
    requestId: string,
    userId: string,
    action: "APPROVE" | "REJECT",
    targetPlan = "Professional",
    notes = ""
  ) => {
    try {
      const res = await authenticatedFetch("/api/admin/resolve-subscription-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          userId,
          action,
          targetPlan,
          adminNotes: notes
        })
      });
      const data = await safeJsonResponse(res, "Resolve correction failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to resolve correction request");
      }

      setSubscriptionCorrections((prev) =>
        prev.map((c) =>
          c.id === requestId ? { ...c, status: action === "APPROVE" ? "APPROVED" : "REJECTED" } : c
        )
      );

      showToast("success", "تمت معالجة طلب تصحيح الاشتراك بنجاح");
    } catch (err: any) {
      showToast("error", err?.message || "فشل معالجة طلب التصحيح");
      throw err;
    }
  };

  // 10. Execute Bulk Action across multiple accounts
  const handleBulkAction = async (
    userIds: string[],
    action: "APPROVE" | "SUSPEND" | "CHANGE_ROLE" | "DELETE" | "UPDATE" | "BULK_EDIT",
    payload?: any
  ) => {
    try {
      const res = await bulkAdminUserActionApi(userIds, action, payload);
      if (!res.success) {
        throw new Error(res.error || "فشل تنفيذ العملية الجماعية.");
      }
      showToast("success", res.message || "تم تنفيذ العملية بنجاح على الحسابات المحددة");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err?.message || "فشل تنفيذ العملية الجماعية");
      throw err;
    }
  };

  // 11. Save User Profile Edits directly
  const handleSaveProfile = async (userId: string, profileData: Record<string, any>) => {
    try {
      const res = await authenticatedFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData)
      });
      const data = await safeJsonResponse(res, "Update user profile failed");
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "فشل تحديث بيانات المستخدم");
      }
      showToast("success", "تم حفظ وتحديث بيانات المستخدم بنجاح");
      await loadAllAdminData();
    } catch (err: any) {
      showToast("error", err?.message || "فشل حفظ بيانات الملف الشخصي");
      throw err;
    }
  };

  // Computed Subscription Stats
  const subscriptionStats: SubscriptionStats = useMemo(() => {
    let enterprise = 0;
    let professional = 0;
    let starter = 0;
    let free = 0;

    users.forEach((u) => {
      const plan = String(u.fullUser?.subscriptionPlan || (u as any).subscriptionPlan || "Starter").toUpperCase();
      if (plan.includes("ENTERPRISE")) enterprise++;
      else if (plan.includes("PRO")) professional++;
      else if (plan.includes("STARTER")) starter++;
      else free++;
    });

    return {
      totalSubscriptions: users.length,
      activePaid: enterprise + professional + starter,
      trials: free,
      plans: {
        Enterprise: enterprise,
        Professional: professional,
        Starter: starter,
        Free: free
      }
    };
  }, [users]);

  // Sidebar Badges Count
  const badges = useMemo(() => {
    const pendingVerifications = pendingApprovals.filter(
      (a) => String(a.accountStatus || "").toUpperCase() !== "APPROVED"
    ).length;
    const pendingRecovery = recoveryRequests.filter((r) => r.status === "pending").length;
    const openTickets = supportTickets.filter((t) => t.status === "Open").length;
    const pendingCorrections = subscriptionCorrections.filter((c) => c.status === "PENDING").length;

    return {
      totalUsers: users.length,
      pendingVerifications,
      pendingRecovery,
      openTickets,
      pendingCorrections
    };
  }, [users, pendingApprovals, recoveryRequests, supportTickets, subscriptionCorrections]);

  return (
    <div 
      className={`h-screen w-screen max-w-full overflow-hidden flex flex-col font-sans select-none transition-colors ${
        theme === "dark" ? "bg-[#05070D] text-slate-100" : "bg-slate-100/60 text-slate-900"
      }`}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 start-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border pointer-events-auto ${
              toastMessage.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            {toastMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* 1. Executive Top Header (Strictly Fixed at Top) */}
      <div className="shrink-0 z-30">
        <AdminHeader
          currentUser={currentUser}
          lang={lang}
          theme={theme}
          toggleLanguage={toggleLanguage}
          toggleTheme={toggleTheme}
          onLogout={onLogout}
          onRefresh={() => loadAllAdminData(true)}
          refreshing={refreshing}
          onSwitchToWorkspace={onSwitchToWorkspace}
          isRealtimeConnected={isRealtimeConnected}
        />
      </div>

      {/* 2. Main Body with Fixed Sidebar + Scrollable Tab Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Sidebar Navigation (Strictly Fixed at Left/Right) */}
        <div className="shrink-0 h-full overflow-y-auto custom-scrollbar z-20 flex flex-col">
          <AdminSidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            lang={lang}
            theme={theme}
            badges={badges}
          />
        </div>

        {/* Tab Content Canvas (The Only Scrollable Container) */}
        <main className="flex-1 h-full min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto pb-16">
            {activeTab === "overview" && (
              <AdminOverviewTab
                users={users}
                pendingApprovals={pendingApprovals}
                recoveryRequests={recoveryRequests}
                supportTickets={supportTickets}
                onNavigateTab={handleNavigateTab}
                onOpenUserDetail={handleOpenUserDetail}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === "users" && (
              <AdminUsersTab
                users={users}
                onOpenUserDetail={handleOpenUserDetail}
                onReviewDocs={handleOpenUserDetail}
                onQuickApprove={(userId) => handleApproveAccount(userId)}
                onQuickReject={(userId) => handleRejectAccount(userId, "Suspended by admin")}
                onBulkAction={handleBulkAction}
                initialFilter={userTabFilter}
                loading={loading}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === "verifications" && (
              <AdminVerificationsTab
                pendingApprovals={pendingApprovals}
                onApprove={handleApproveAccount}
                onApproveDocuments={handleApproveDocuments}
                onRejectDocuments={handleRejectDocuments}
                onReject={handleRejectAccount}
                onRequireDocs={handleRequireDocuments}
                loading={loading}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === "recovery" && (
              <AdminRecoveryTab
                recoveryRequests={recoveryRequests}
                onDecision={handleRecoveryDecision}
                loading={loading}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === "support" && (
              <AdminSupportTab
                tickets={supportTickets}
                onSendMessage={handleSendSupportMessage}
                onUpdateStatus={handleUpdateTicketStatus}
                loading={loading}
                lang={lang}
                theme={theme}
              />
            )}

            {activeTab === "subscriptions" && (
              <AdminSubscriptionsTab
                stats={subscriptionStats}
                corrections={subscriptionCorrections}
                users={users}
                onResolveCorrection={handleResolveSubscriptionCorrection}
                onAssignUserPlan={handleUpdateUserPlan}
                onOpenUserDetail={handleOpenUserDetail}
                loading={loading}
                lang={lang}
                theme={theme}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. User Detail & Administrative Action Modal */}
      <UserDetailModal
        user={selectedUserRecord}
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setSelectedUserRecord(null);
        }}
        onApprove={handleApproveAccount}
        onApproveDocuments={handleApproveDocuments}
        onRejectDocuments={handleRejectDocuments}
        onReject={handleRejectAccount}
        onRequireDocs={handleRequireDocuments}
        onExtendTrial={handleExtendTrial}
        onUpdatePlan={handleUpdateUserPlan}
        onDeleteUser={handleDeleteUserAccount}
        onSaveProfile={handleSaveProfile}
        lang={lang}
        theme={theme}
      />
    </div>
  );
};
export default AdminDashboard;
