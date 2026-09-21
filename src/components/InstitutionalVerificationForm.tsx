import React, { useState } from "react";
import { motion } from "motion/react";
import { Building2, User, Phone, Briefcase, Globe, Users, Target, FileText, Send, LogOut, AlertCircle, CheckCircle2 } from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { User as UserType } from "../types";
import { auth } from "../firebase";

interface InstitutionalVerificationFormProps {
  currentUser: UserType;
  lang: "ar" | "en" | "fr";
  onSuccess: (updatedUser: UserType) => void;
  onLogout: () => void;
}

const SECTOR_OPTIONS = [
  { value: "Finance", labelAr: "الخدمات المالية والمصرفية والاستثمار", labelEn: "Financial Services, Banking & Investment" },
  { value: "Technology", labelAr: "التكنولوجيا والبرمجيات والاتصالات", labelEn: "Technology, Software & Telecom" },
  { value: "Logistics", labelAr: "اللوجستيات وسلاسل الإمداد والنقل", labelEn: "Logistics, Supply Chain & Transport" },
  { value: "Energy", labelAr: "الطاقة والنفط والغاز والتعدين", labelEn: "Energy, Oil & Gas, Mining" },
  { value: "Healthcare", labelAr: "الرعاية الصحية والأدوية", labelEn: "Healthcare & Pharmaceuticals" },
  { value: "RealEstate", labelAr: "العقارات والإنشاءات والتطوير", labelEn: "Real Estate, Construction & Development" },
  { value: "Retail", labelAr: "التجارة والتجزئة والسلع الاستهلاكية", labelEn: "Retail, Commerce & Consumer Goods" },
  { value: "PublicSector", labelAr: "القطاع الحكومي والمؤسسات العامة", labelEn: "Government & Public Institutions" },
  { value: "Consulting", labelAr: "الاستشارات المهنية والإدارية", labelEn: "Professional & Management Consulting" },
  { value: "Other", labelAr: "قطاع آخر", labelEn: "Other Industry" }
];

const COUNTRY_OPTIONS = [
  { code: "Mauritania", nameAr: "موريتانيا", nameEn: "Mauritania", phoneCode: "+222" },
  { code: "Saudi Arabia", nameAr: "المملكة العربية السعودية", nameEn: "Saudi Arabia", phoneCode: "+966" },
  { code: "UAE", nameAr: "الإمارات العربية المتحدة", nameEn: "United Arab Emirates", phoneCode: "+971" },
  { code: "Egypt", nameAr: "مصر", nameEn: "Egypt", phoneCode: "+20" },
  { code: "Algeria", nameAr: "الجزائر", nameEn: "Algeria", phoneCode: "+213" },
  { code: "Morocco", nameAr: "المغرب", nameEn: "Morocco", phoneCode: "+212" },
  { code: "Qatar", nameAr: "قطر", nameEn: "Qatar", phoneCode: "+974" },
  { code: "Kuwait", nameAr: "الكويت", nameEn: "Kuwait", phoneCode: "+965" },
  { code: "Oman", nameAr: "عُمان", nameEn: "Oman", phoneCode: "+968" },
  { code: "Bahrain", nameAr: "البحرين", nameEn: "Bahrain", phoneCode: "+973" },
  { code: "Jordan", nameAr: "الأردن", nameEn: "Jordan", phoneCode: "+962" },
  { code: "USA", nameAr: "الولايات المتحدة", nameEn: "United States", phoneCode: "+1" },
  { code: "UK", nameAr: "المملكة المتحدة", nameEn: "United Kingdom", phoneCode: "+44" },
  { code: "Other", nameAr: "دولة أخرى", nameEn: "Other Country", phoneCode: "" }
];

export const InstitutionalVerificationForm: React.FC<InstitutionalVerificationFormProps> = ({
  currentUser,
  lang,
  onSuccess,
  onLogout
}) => {
  const isAr = lang === "ar";

  const [fullName, setFullName] = useState(currentUser.fullName || currentUser.ownerName || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || "");
  const [companyName, setCompanyName] = useState(currentUser.companyName || "");
  const [sector, setSector] = useState(SECTOR_OPTIONS[0].value);
  const [country, setCountry] = useState("Mauritania");
  const [companySize, setCompanySize] = useState("11-50");
  const [intendedUse, setIntendedUse] = useState("Strategic Decision Intelligence");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !phone.trim() || !companyName.trim() || !sector || !country) {
      setErrorMsg(isAr ? "يرجى تعبئة كافة الحقول الإلزامية." : "Please fill in all required fields.");
      return;
    }

    setLoading(true);

    try {
      let token = "";
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken(true);
        }
      } catch (tErr) {
        console.warn("Token fetch notice in verification form:", tErr);
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else if (currentUser.id) {
        headers["x-auth-token"] = currentUser.id;
      }

      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim() || "Executive",
        companyName: companyName.trim(),
        sector,
        country,
        companySize,
        intendedUse,
        additionalNotes: additionalNotes.trim()
      };

      const response = await fetch("/api/auth/submit-institutional-data", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || resData.message || (isAr ? "فشل إرسال بيانات التحقق" : "Failed to submit verification data"));
      }

      setSuccessMsg(isAr ? "تم إرسال بيانات التحقق بنجاح! جاري تحويلك..." : "Verification data submitted successfully! Redirecting...");

      const updatedUser: UserType = {
        ...currentUser,
        fullName: payload.fullName,
        ownerName: payload.fullName,
        phone: payload.phone,
        jobTitle: payload.jobTitle,
        companyName: payload.companyName,
        accountStatus: "PENDING_ADMIN_REVIEW",
        verification_status: "under_review",
        verification_required: true,
        institutionalProfile: {
          ...payload,
          submittedAt: new Date().toISOString()
        }
      };

      setTimeout(() => {
        onSuccess(updatedUser);
      }, 1000);
    } catch (err: any) {
      console.error("Submission error:", err);
      setErrorMsg(err.message || (isAr ? "حدث خطأ أثناء إرسال البيانات. يرجى المحاولة ثانية." : "Error submitting data. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="zakir-screen zakir-auth min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl relative z-10 my-8"
      >
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <ZakirLogo size="lg" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isAr ? "بيانات الحساب والتحقق المؤسسي" : "Institutional & Account Verification"}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-xl mx-auto">
            {isAr
              ? "يرجى استكمال البيانات الرسمية لمؤسستك لتقديم طلب فتح الحساب للمراجعة الإدارية وتفعيل فترتك التجريبية (24 ساعة)."
              : "Please complete your organization profile to submit your account for administrative review and activate your full 24-hour trial."}
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-lg">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Contact / Personal Details */}
            <div>
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                {isAr ? "1. البيانات الشخصية ومسؤول الحساب" : "1. Personal & Contact Information"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "الاسم الكامل *" : "Full Name *"}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={isAr ? "مثال: عبد الله أحمد" : "e.g. John Doe"}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "رقم الهاتف / واتساب للتواصل *" : "Phone / WhatsApp Number *"}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={isAr ? "مثال: +222 45 00 00 00" : "e.g. +1 555 0199"}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "المسمى الوظيفي / الدور المؤسسي" : "Official Job Title / Role"}
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder={isAr ? "مثال: الرئيس التنفيذي / مدير التخطيط الاستراتيجي" : "e.g. CEO / Strategic Planning Director"}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {isAr ? "2. البيانات المؤسسية وبيئة العمل" : "2. Organization Profile"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "اسم المؤسسة / الشركة *" : "Organization / Company Name *"}
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={isAr ? "مثال: الشركة الوطنية للاستثمار" : "e.g. Acme Corporation"}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "القطاع / المجال *" : "Sector / Industry *"}
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  >
                    {SECTOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isAr ? opt.labelAr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "الدولة / المقر الرئيسي *" : "Country / Headquarters *"}
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {isAr ? c.nameAr : c.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "حجم المؤسسة (عدد الموظفين)" : "Organization Size"}
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <select
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    >
                      <option value="1-10">{isAr ? "1 - 10 موظفين" : "1 - 10 employees"}</option>
                      <option value="11-50">{isAr ? "11 - 50 موظفاً" : "11 - 50 employees"}</option>
                      <option value="51-200">{isAr ? "51 - 200 موظف" : "51 - 200 employees"}</option>
                      <option value="201-500">{isAr ? "201 - 500 موظف" : "201 - 500 employees"}</option>
                      <option value="500+">{isAr ? "أكثر من 500 موظف" : "500+ employees"}</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "الغرض الرئيسي من استخدام ذاكر" : "Primary Intended Use Case"}
                  </label>
                  <div className="relative">
                    <Target className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <select
                      value={intendedUse}
                      onChange={(e) => setIntendedUse(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    >
                      <option value="Strategic Decision Intelligence">{isAr ? "دعم اتخاذ القرارات الاستراتيجية والتحليل المؤسسي" : "Strategic Decision Intelligence & Executive Analysis"}</option>
                      <option value="Executive AI Advisory">{isAr ? "المستشار الإدراكي الذاتي والمحاكاة التنفيذية" : "Executive Cognitive Advisor & Operational Simulation"}</option>
                      <option value="Market Intelligence & Analysis">{isAr ? "ذكاء السوق والمنافسة والتحليل الجغرافي والقطاعي" : "Market & Sectoral Intelligence & Competitor Tracking"}</option>
                      <option value="Risk Management & Radar">{isAr ? "إدارة المخاطر والإنذار المبكر" : "Risk Radar & Early Threat Detection"}</option>
                      <option value="Corporate Knowledge Vault">{isAr ? "خزينة الذاكرة المؤسسية وحفظ المعرفة التنفيذية" : "Corporate Knowledge Vault & Institutional Memory"}</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isAr ? "ملاحظات إضافية / طلبات خاصة (اختياري)" : "Additional Notes / Special Requirements (Optional)"}
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-500 absolute top-3.5 start-3 pointer-events-none" />
                    <textarea
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder={isAr ? "أي معلومات إضافية ترغب في مشاركتها مع فريق المراجعة..." : "Any additional notes for the admin review team..."}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 ps-10 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submission Actions */}
            <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isAr ? "تسجيل الخروج والعودة لاحقاً" : "Log out and return later"}</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>{isAr ? "جاري الإرسال..." : "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isAr ? "إرسال البيانات للمراجعة الإدارية" : "Submit for Admin Review"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
