import React from "react";
import { motion } from "motion/react";
import { XCircle, AlertTriangle, LogOut, Mail, HelpCircle } from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { User as UserType } from "../types";

interface AccountRejectedViewProps {
  currentUser: UserType;
  lang: "ar" | "en" | "fr";
  onLogout: () => void;
  onContactSupport?: () => void;
}

export const AccountRejectedView: React.FC<AccountRejectedViewProps> = ({
  currentUser,
  lang,
  onLogout,
  onContactSupport
}) => {
  const isAr = lang === "ar";
  const reason = currentUser.rejectionReason || currentUser.verificationInfo?.adminNote;

  return (
    <div className="zakir-screen zakir-auth min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6" dir={isAr ? "rtl" : "ltr"}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative z-10 my-8"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <ZakirLogo size="lg" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium mb-3">
            <XCircle className="w-3.5 h-3.5" />
            <span>{isAr ? "طلب الحساب مرفوض" : "Application Rejected"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isAr ? "تعذر اعتماد حساب المنشأة" : "Account Verification Declined"}
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
            {isAr
              ? "نأسف، لم تتم الموافقة على طلب تسجيل الحساب بعد المراجعة الإدارية للبيانات المقدمة."
              : "We regret to inform you that your account registration request was not approved following administrative review."}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg space-y-6">
          {reason ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-red-300 text-sm space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400 block">
                {isAr ? "سبب الرفض المذكور:" : "Reason provided:"}
              </span>
              <p className="text-slate-300 leading-relaxed">{reason}</p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-sm">
              {isAr
                ? "لم تستوفِ البيانات المقدمة معايير التحقق المؤسسي المعتمدة لدى المنصة."
                : "The submitted details did not meet the institutional verification criteria."}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isAr ? "تسجيل الخروج" : "Log out"}</span>
            </button>

            {onContactSupport && (
              <button
                type="button"
                onClick={onContactSupport}
                className="w-full sm:w-auto px-6 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{isAr ? "التواصل مع الدعم" : "Contact Support"}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
