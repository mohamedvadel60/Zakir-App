import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Building2,
  User,
  Mail,
  FileCheck,
  Eye,
  Info,
  Calendar
} from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { User as UserType } from "../types";
import { auth } from "../firebase";
import { authenticatedFetch } from "../lib/apiUtils.js";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

interface PendingApprovalViewProps {
  currentUser: UserType;
  lang?: "ar" | "en" | "fr";
  theme?: "light" | "dark";
  onLogout: () => void;
  onRefreshUser: () => Promise<void>;
  onContactSupport?: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  currentUser,
  lang = "ar",
  theme = "dark",
  onLogout,
  onRefreshUser,
}) => {
  const isAr = lang === "ar";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string; category?: string } | null>(null);

  const profile = currentUser.institutionalProfile;
  const rawDocs = currentUser.verificationDocuments || [];
  const seenKeys = new Set<string>();
  const docs: any[] = [];
  for (const d of (rawDocs as any[])) {
    if (!d) continue;
    const docId = String(d.documentId || d.id || d.fileId || "").trim();
    const storageRef = String(d.storageReference || d.storagePath || d.fileUrl || "").trim();
    const fileName = String(d.fileName || d.name || "").trim();
    const sizeStr = d.size ? String(d.size) : "";

    const key1 = docId ? `id_${docId}` : "";
    const key2 = storageRef ? `ref_${storageRef}` : "";
    const key3 = fileName ? `fn_${fileName.toLowerCase()}_${sizeStr}` : "";

    if ((key1 && seenKeys.has(key1)) || (key2 && seenKeys.has(key2)) || (key3 && seenKeys.has(key3))) {
      continue;
    }
    if (key1) seenKeys.add(key1);
    if (key2) seenKeys.add(key2);
    if (key3) seenKeys.add(key3);

    docs.push(d);
  }

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await authenticatedFetch("/api/user/entitlement-status");
      const data = await res.json();

      if (data.success && data.entitlement) {
        if (data.entitlement.accountStatus === "APPROVED" || data.entitlement.allowed) {
          setRefreshMessage(
            isAr
              ? "تم اعتماد حسابك بنجاح! جاري تحويلك إلى مساحة العمل..."
              : "Account approved! Redirecting to workspace..."
          );
          await onRefreshUser();
        } else if (data.entitlement.accountStatus === "REJECTED") {
          setRefreshMessage(
            isAr
              ? "يلزم تحديث مستندات التوثيق الخاصة بحسابك."
              : "Action required: update your verification documents."
          );
          await onRefreshUser();
        } else {
          setRefreshMessage(
            isAr
              ? "الطلب لا يزال قيد المراجعة والتدقيق الإداري حالياً."
              : "Account is still undergoing administrative review."
          );
          await onRefreshUser();
        }
      } else {
        await onRefreshUser();
        setRefreshMessage(
          isAr
            ? "الطلب لا يزال قيد المراجعة الإدارية."
            : "Account is still pending review."
        );
      }
    } catch (err) {
      console.warn("Refresh error:", err);
      setRefreshMessage(
        isAr
          ? "تعذر التحقق من الحالة حالياً. يرجى المحاولة لاحقاً."
          : "Could not verify status now. Please try again."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDocTypeLabel = (docType?: string) => {
    switch (docType) {
      case "national_id":
        return isAr ? "بطاقة الهوية الوطنية" : "National ID Card";
      case "passport":
        return isAr ? "جواز السفر" : "Passport";
      case "driving_license":
        return isAr ? "رخصة القيادة" : "Driving License";
      case "commercial_register":
        return isAr ? "السجل التجاري / الترخيص" : "Commercial Register";
      case "tax_card":
        return isAr ? "الشهادة الضريبية" : "Tax Certificate";
      default:
        return isAr ? "وثيقة رسمية" : "Official Document";
    }
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 dark:bg-[#080C14] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 transition-colors duration-200"
    >
      {/* Top Navbar */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <ZakirLogo size="md" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hidden sm:inline-block">
            {currentUser.email}
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{isAr ? "تسجيل الخروج" : "Log Out"}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl w-full mx-auto flex-1 flex flex-col justify-center my-4">
        {/* Stepper Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />

            {/* Step 1: Email Verified */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {isAr ? "البريد الإلكتروني" : "Email"}
              </span>
            </div>

            {/* Step 2: Documents Submitted */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {isAr ? "المستندات" : "Documents"}
              </span>
            </div>

            {/* Step 3: Admin Review (Active) */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-amber-500/30 ring-4 ring-amber-500/20">
                <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: "6s" }} />
              </div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {isAr ? "المراجعة الإدارية" : "Admin Review"}
              </span>
            </div>
          </div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          {/* Header Status */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span>{isAr ? "تم استلام طلب التوثيق" : "Verification Request Received"}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {isAr ? "طلبك قيد المراجعة والتدقيق" : "Application Under Review"}
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {isAr
                ? "تم إرسال مستنداتك للمراجعة. سيتم إشعارك عبر البريد الإلكتروني بعد انتهاء المراجعة وتفعيل حسابك تلقائياً."
                : "Your documents have been submitted for review. You will be notified by email once the review is complete and your account is approved."}
            </p>
          </div>

          {refreshMessage && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center justify-between">
              <span>{refreshMessage}</span>
              <button
                onClick={() => setRefreshMessage(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-white font-bold ml-2 rtl:mr-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Application Summary Box */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0075DE]" />
              <span>{isAr ? "ملخص بيانات الطلب" : "Submitted Details"}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isAr ? "صاحب الحساب" : "Account Owner"}
                </span>
                <span className="text-slate-900 dark:text-white font-semibold">
                  {profile?.fullName || currentUser.fullName || currentUser.ownerName || "—"}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isAr ? "البريد الإلكتروني" : "Email Address"}
                </span>
                <span className="text-slate-900 dark:text-white font-mono text-xs truncate block">
                  {currentUser.email}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isAr ? "نوع الحساب / المنشأة" : "Account Type / Organization"}
                </span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {currentUser.hasCompany || (profile as any)?.hasCompany
                    ? profile?.companyName || currentUser.companyName || (isAr ? "شركة مسجلة" : "Registered Company")
                    : (isAr ? "حساب فردي / شخصي" : "Individual Account")}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                  {isAr ? "تاريخ التقديم" : "Submitted Date"}
                </span>
                <span className="text-slate-900 dark:text-white text-xs">
                  {profile?.submittedAt || (currentUser as any).verificationSubmittedAt
                    ? new Date(
                        profile?.submittedAt || (currentUser as any).verificationSubmittedAt
                      ).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
                        dateStyle: "medium",
                      })
                    : (isAr ? "اليوم" : "Today")}
                </span>
              </div>
            </div>

            {/* Uploaded Documents List */}
            {docs.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                  {isAr ? "المستندات المرفقة للتدقيق:" : "Attached Documents for Verification:"}
                </span>
                <div className="space-y-1.5">
                  {docs.map((doc, idx) => {
                    const docKey = doc.documentId || doc.id || doc.fileName || `pdoc_${idx}`;
                    return (
                      <div
                        key={docKey}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {doc.fileName}
                        </span>
                        <span className="text-slate-400">({getDocTypeLabel(doc.docType)})</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ id: doc.documentId, name: doc.fileName, category: doc.category })}
                        className="flex items-center gap-1 text-[#0075DE] hover:underline text-xs shrink-0 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isAr ? "معاينة" : "Preview"}</span>
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{isAr ? "تسجيل الخروج" : "Log Out"}</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isAr ? "تحديث حالة الطلب" : "Refresh Status"}</span>
            </button>
          </div>
        </motion.div>
      </main>

      <DocumentPreviewModal
        documentId={previewDoc?.id || null}
        fileName={previewDoc?.name}
        category={previewDoc?.category}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        lang={lang === "fr" ? "en" : lang}
      />
    </div>
  );
};
