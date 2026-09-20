import React, { useState } from "react";
import { X, CheckCircle, ShieldAlert, Sparkles, Send, FileText, CreditCard } from "lucide-react";
import { User } from "../types";

interface SubscriptionCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  lang?: "ar" | "en" | "fr";
  theme?: "dark" | "light";
  onSuccess?: () => void;
}

export const SubscriptionCorrectionModal: React.FC<SubscriptionCorrectionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  lang = "ar",
  theme = "dark",
  onSuccess
}) => {
  const isAr = lang === "ar";
  const [requestedPlan, setRequestedPlan] = useState<"Starter" | "Professional" | "Enterprise">("Professional");
  const [issueType, setIssueType] = useState<string>("PLAN_MISMATCH");
  const [userNotes, setUserNotes] = useState<string>("");
  const [referenceData, setReferenceData] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ requestId: string; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token") || (currentUser as any)?.token;
      const res = await fetch("/api/subscription/correction-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          requestedPlan,
          issueType,
          userNotes,
          referenceData
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessData({
          requestId: data.requestId,
          message: data.message
        });
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(data.error || (isAr ? "فشل إرسال طلب تصحيح الاشتراك" : "Failed to submit request"));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? "حدث خطأ في الاتصال بالخادم" : "Connection error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessData(null);
    setErrorMessage(null);
    setUserNotes("");
    setReferenceData("");
    onClose();
  };

  const isLight = theme === "light";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-100"
        }`}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? "border-slate-100 bg-slate-50/50" : "border-slate-800/80 bg-slate-950/40"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0075DE]/10 text-[#0075DE] flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                {isAr ? "طلب تصحيح الاشتراك والاستحقاق" : "Subscription Correction Request"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? "مراجعة وتعديل خطة حسابك يدويًا مع الإدارة"
                  : "Manual review and plan entitlement correction"}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successData ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-emerald-400">
                  {isAr ? "تم إرسال الطلب بنجاح!" : "Request Submitted Successfully!"}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {successData.message}
                </p>
                <div className={`mt-4 p-3 rounded-xl inline-block border font-mono text-xs ${
                  isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                }`}>
                  <span className="text-slate-500 mr-2">{isAr ? "رقم المرجع:" : "Reference ID:"}</span>
                  <span className="font-bold text-[#0075DE]">{successData.requestId}</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-6 py-2.5 bg-[#0075DE] text-white font-bold rounded-xl text-xs hover:bg-[#0075DE]/90 transition-all cursor-pointer shadow-lg shadow-[#0075DE]/20"
                >
                  {isAr ? "إغلاق ومتابعة" : "Close & Continue"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Account Status Info Box */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"
              }`}>
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    {isAr ? "الخطة المسجلة حالياً في النظام:" : "Current Registered Plan:"}
                  </span>
                  <span className="font-black text-slate-300 text-sm">
                    {currentUser?.subscriptionPlan || "Starter"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[11px]">
                    {isAr ? "حالة الاشتراك:" : "Subscription Status:"}
                  </span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] inline-block ${
                    currentUser?.subscriptionStatus === "Active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {currentUser?.subscriptionStatus || "Trial"}
                  </span>
                </div>
              </div>

              {/* Target Plan Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {isAr ? "الخطة الصحيحة التي تم الاشتراك بها:" : "Correct Subscribed Plan:"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Starter", "Professional", "Enterprise"] as const).map((p) => {
                    const isSelected = requestedPlan === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setRequestedPlan(p)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? "bg-[#0075DE]/15 border-[#0075DE] text-[#0075DE] shadow-sm shadow-[#0075DE]/20"
                            : isLight
                            ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                        }`}
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isSelected ? "text-[#0075DE]" : "text-slate-500"}`} />
                        <span>{p}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Issue Type */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? "نوع المشكلة:" : "Issue Category:"}
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0075DE] ${
                    isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"
                  }`}
                >
                  <option value="PLAN_MISMATCH">
                    {isAr ? "عدم تطابق الباقة الحالية مع الاشتراك المدفوع" : "Plan mismatch after payment"}
                  </option>
                  <option value="UPGRADE_NOT_REFLECTED">
                    {isAr ? "تمت الترقية ولم تفتح ميزات الباقة" : "Upgrade completed but features not unlocked"}
                  </option>
                  <option value="TRIAL_LOCKED_PREMATURELY">
                    {isAr ? "إغلاق الحساب/التجربة رغم وجود اشتراك مدفوع" : "Account locked despite active subscription"}
                  </option>
                  <option value="OTHER">
                    {isAr ? "أخرى (توضيح في الملاحظات)" : "Other (details in notes)"}
                  </option>
                </select>
              </div>

              {/* Transaction Reference / Invoice Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? "مرجع المعاملة / رقم الفاتورة / بريد الدفع (اختياري):" : "Reference ID / Invoice # / Stripe Email (Optional):"}
                </label>
                <input
                  type="text"
                  value={referenceData}
                  onChange={(e) => setReferenceData(e.target.value)}
                  placeholder={isAr ? "مثال: ch_xxx / in_xxx / invoice@company.com" : "e.g. ch_xxx / in_xxx / billing@company.com"}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-[#0075DE] font-mono ${
                    isLight ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400" : "bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600"
                  }`}
                />
              </div>

              {/* User Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? "ملاحظات وشرح المشكلة:" : "Additional Notes & Explanation:"}
                </label>
                <textarea
                  rows={3}
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder={isAr ? "يرجى توضيح أي تفاصيل تساعد المشرف في التحقق من اشتراكك وتحديثه..." : "Explain details to help the admin verify and correct your plan..."}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-[#0075DE] resize-none ${
                    isLight ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400" : "bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600"
                  }`}
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isLight ? "border-slate-200 hover:bg-slate-100 text-slate-600" : "border-slate-800 hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#0075DE] to-[#005bb5] hover:from-[#005bb5] hover:to-[#004a94] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#0075DE]/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isAr ? "إرسال طلب التصحيح" : "Submit Request"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
