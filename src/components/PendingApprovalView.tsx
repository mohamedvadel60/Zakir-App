import React, { useState } from "react";
import { motion } from "motion/react";
import { Clock, ShieldAlert, CheckCircle2, RefreshCw, LogOut, Building2, User, Globe, Mail, Phone, ExternalLink } from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { User as UserType } from "../types";
import { auth } from "../firebase";

interface PendingApprovalViewProps {
  currentUser: UserType;
  lang: "ar" | "en" | "fr";
  onLogout: () => void;
  onRefreshUser: () => Promise<void>;
  onContactSupport?: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  currentUser,
  lang,
  onLogout,
  onRefreshUser,
  onContactSupport
}) => {
  const isAr = lang === "ar";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const profile = currentUser.institutionalProfile;

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      let token = "";
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken(true);
        }
      } catch (e) {}

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else if (currentUser.id) {
        headers["x-auth-token"] = currentUser.id;
      }

      const res = await fetch("/api/user/entitlement-status", { headers });
      const data = await res.json();

      if (data.success && data.entitlement) {
        if (data.entitlement.accountStatus === "APPROVED" || data.entitlement.allowed) {
          setRefreshMessage(isAr ? "تم اعتماد حسابك بنجاح! جاري الدخول..." : "Account approved! Entering workspace...");
          await onRefreshUser();
        } else {
          setRefreshMessage(isAr ? "الحساب لا يزال قيد المراجعة الإدارية." : "Account is still pending review.");
          await onRefreshUser();
        }
      } else {
        await onRefreshUser();
        setRefreshMessage(isAr ? "الحساب لا يزال قيد المراجعة الإدارية." : "Account is still pending review.");
      }
    } catch (err) {
      console.warn("Refresh error:", err);
      setRefreshMessage(isAr ? "تعذر التحقق من الحالة حالياً. يرجى المحاولة لاحقاً." : "Could not verify status now. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="zakir-screen zakir-auth min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10 my-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ZakirLogo size="lg" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium mb-3">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>{isAr ? "قيد المراجعة الإدارية" : "Under Administrative Review"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isAr ? "طلب اعتماد الحساب قيد الفحص" : "Account Application Under Review"}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-lg mx-auto">
            {isAr
              ? "تم استلام بيانات التحقق الخاصة بمؤسستك بنجاح. يتم فحص الطلبات بواسطة الإدارة لضمان سرية وأمان المنظومة المؤسسية. فور الاعتماد، ستبدأ فترتك التجريبية (24 ساعة) تلقائياً."
              : "Your organization verification details have been received. Applications are reviewed to maintain institutional security. Upon approval, your 24-hour trial starts immediately."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg space-y-6">
          {refreshMessage && (
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-amber-300 text-sm flex items-center justify-between">
              <span>{refreshMessage}</span>
              <button onClick={() => setRefreshMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
          )}

          {/* Application Summary Box */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>{isAr ? "تفاصيل الطلب المقدم" : "Submitted Application Details"}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                <span className="text-xs text-slate-500 block mb-0.5">{isAr ? "اسم المؤسسة" : "Organization"}</span>
                <span className="text-slate-200 font-medium">{profile?.companyName || currentUser.companyName || "—"}</span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                <span className="text-xs text-slate-500 block mb-0.5">{isAr ? "مسؤول الحساب" : "Account Owner"}</span>
                <span className="text-slate-200 font-medium">{profile?.fullName || currentUser.fullName || currentUser.ownerName || "—"}</span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                <span className="text-xs text-slate-500 block mb-0.5">{isAr ? "البريد الإلكتروني" : "Email"}</span>
                <span className="text-slate-200 font-mono text-xs">{currentUser.email}</span>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                <span className="text-xs text-slate-500 block mb-0.5">{isAr ? "القطاع / الدولة" : "Sector / Country"}</span>
                <span className="text-slate-200">{profile?.sector || "—"} • {profile?.country || "—"}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60">
              <span>{isAr ? "تاريخ التقديم:" : "Submitted Date:"}</span>
              <span className="font-mono">{profile?.submittedAt ? new Date(profile.submittedAt).toLocaleDateString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : "اليوم"}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isAr ? "تسجيل الخروج" : "Log out"}</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefreshClick}
              className="w-full sm:w-auto px-6 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? (isAr ? "جاري الفحص..." : "Checking...") : (isAr ? "تحديث حالة الحساب" : "Check Status / Refresh")}</span>
            </button>
          </div>
        </div>

        {/* Footer info note */}
        <p className="text-center text-xs text-slate-500 mt-6">
          {isAr
            ? "يتم مراجعة الطلبات على مدار الساعة. لأي استفسارات عاجلة يرجى التواصل مع الدعم الفني."
            : "Applications are reviewed around the clock. For urgent inquiries, please contact platform support."}
        </p>
      </motion.div>
    </div>
  );
};
