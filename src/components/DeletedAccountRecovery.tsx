import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Mail, 
  Lock, 
  Upload, 
  FileText, 
  User as UserIcon, 
  Building2, 
  Phone, 
  X,
  FileCheck,
  Send,
  RotateCcw
} from "lucide-react";
import { 
  fetchAccountRecoveryStatusApi, 
  submitAccountRecoveryRequestApi, 
  sendRecoveryApprovalOtpApi, 
  verifyRecoveryApprovalOtpAndRestoreApi,
  loginWithCustomToken,
  uploadRecoveryDocumentApi
} from "../lib/firebaseServices.js";
import { User, AccountRecoveryRequest } from "../types.js";

interface DeletedAccountRecoveryProps {
  email: string;
  daysRemaining?: number;
  restoreUntil?: string | null;
  isExpired?: boolean;
  lang: "ar" | "en" | "fr";
  theme?: "light" | "dark" | "custom";
  onCancel: () => void;
  onRestored: (user: User, customToken?: string) => void;
}

export const DeletedAccountRecovery: React.FC<DeletedAccountRecoveryProps> = ({
  email,
  lang,
  theme = "light",
  onCancel,
  onRestored
}) => {
  const isRtl = lang === "ar";
  const normalizedEmail = email.trim().toLowerCase();

  // Mode states: "status_view" | "form_view" | "verify_email_view" | "success_view"
  const [viewMode, setViewMode] = useState<"status_view" | "form_view" | "verify_email_view" | "success_view">("status_view");
  const [formStep, setFormStep] = useState<number>(1);

  // Status state from backend
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [requestData, setRequestData] = useState<AccountRecoveryRequest | null>(null);
  const [statusType, setStatusType] = useState<"none" | "pending" | "under_review" | "approved" | "rejected">("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Form Fields State
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [organization, setOrganization] = useState<string>("");
  const [previousWorkspaceInfo, setPreviousWorkspaceInfo] = useState<string>("");
  const [deletionReason, setDeletionReason] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  
  // File Upload State
  const [attachedDoc, setAttachedDoc] = useState<{
    documentId: string;
    storageReference: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
    uploadToken?: string;
    id?: string;
    name?: string;
    type?: string;
  } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);

  // Email OTP Verification State (After Approval)
  const [otpCode, setOtpCode] = useState<string>("");
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // General Error & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);
  const [restoredUser, setRestoredUser] = useState<User | null>(null);

  // Load request status on mount
  const checkStatus = async () => {
    setLoadingStatus(true);
    setErrorMessage(null);
    try {
      const res = await fetchAccountRecoveryStatusApi(normalizedEmail);
      if (res.success && res.recoveryRequest) {
        setRequestData(res.recoveryRequest);
        setStatusType(res.recoveryRequest.status || "pending");
        setRejectionReason(res.recoveryRequest.rejectionReason || null);
      } else if (res.success && res.status === "APPROVED") {
        setStatusType("approved");
      } else {
        setStatusType("none");
        setRequestData(null);
      }
    } catch (err: any) {
      console.error("Error loading recovery status:", err);
      setStatusType("none");
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [normalizedEmail]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Document Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        lang === "ar"
          ? "حجم الملف يتجاوز الحد المسموح به (5 ميجابايت)."
          : "File size exceeds the 5MB limit."
      );
      return;
    }

    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimeTypes.includes(file.type)) {
      setErrorMessage(
        lang === "ar"
          ? "امتداد وصيغة الملف غير مدعومة. يسمح فقط بملفات PDF, PNG, JPG."
          : "Unsupported document format. Only PDF, PNG, and JPEG files are allowed."
      );
      return;
    }

    setIsUploadingFile(true);
    setErrorMessage(null);

    try {
      const res = await uploadRecoveryDocumentApi(file);
      if (!res.success) {
        throw new Error(res.error || (lang === "ar" ? "فشل رفع الملف." : "Failed to upload document."));
      }
      
      // Keep name/id/type compatibility for backward compatibility with UI rendering
      setAttachedDoc({
        ...res.document,
        id: res.document.documentId,
        name: res.document.fileName,
        type: res.document.mimeType.includes("pdf") ? "pdf" : "identity_document"
      });
      setErrorMessage(null);
    } catch (err: any) {
      console.error("Document upload error:", err);
      setErrorMessage(
        err.message || 
        (lang === "ar" ? "حدث خطأ أثناء رفع المستند." : "An error occurred during file upload.")
      );
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Submit Multi-step Recovery Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validations
    if (!fullName.trim()) {
      setErrorMessage(lang === "ar" ? "يرجى إدخال الاسم الكامل." : "Please enter your full name.");
      setFormStep(1);
      return;
    }
    if (!phone.trim()) {
      setErrorMessage(lang === "ar" ? "يرجى إدخال رقم الهاتف." : "Please enter your phone number.");
      setFormStep(1);
      return;
    }
    if (!deletionReason.trim()) {
      setErrorMessage(lang === "ar" ? "يرجى توضيح سبب حذف/استعادة الحساب." : "Please specify the reason for account deletion/recovery.");
      setFormStep(2);
      return;
    }
    if (!termsAccepted) {
      setErrorMessage(lang === "ar" ? "يجب الموافقة على شروط خدمة وسياقات المنصة." : "You must accept the Terms of Service.");
      setFormStep(3);
      return;
    }
    if (!attachedDoc) {
      setErrorMessage(lang === "ar" ? "يرجى إرفاق وثيقة اثبات الهوية." : "Please attach an identity verification document.");
      setFormStep(4);
      return;
    }

    setIsSubmittingForm(true);

    try {
      const payload = {
        email: normalizedEmail,
        fullName: fullName.trim(),
        phone: phone.trim(),
        phoneVerified: phoneVerified,
        organization: organization.trim(),
        previousWorkspaceInfo: previousWorkspaceInfo.trim(),
        reason: deletionReason.trim(),
        termsAccepted: true,
        documents: [attachedDoc]
      };

      const res = await submitAccountRecoveryRequestApi(payload);
      if (!res.success) {
        throw new Error(res.error || (lang === "ar" ? "فشل تقديم طلب الاستعادة." : "Failed to submit recovery request."));
      }

      setStatusType("pending");
      setRequestData(res.request || null);
      setViewMode("status_view");
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "حدث خطأ أثناء تقديم الطلب." : "An error occurred during submission."));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Start Email Verification (for Approved requests)
  const handleStartEmailVerification = async () => {
    setIsSendingOtp(true);
    setErrorMessage(null);

    try {
      const res = await sendRecoveryApprovalOtpApi(normalizedEmail);
      if (!res.success) {
        throw new Error(res.error || (lang === "ar" ? "فشل إرسال رمز التحقق." : "Failed to send verification code."));
      }
      setResendCooldown(60);
      setViewMode("verify_email_view");
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "تعذر إرسال رمز التحقق." : "Unable to send verification code."));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify Approval OTP and Complete Account Restoration
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setErrorMessage(lang === "ar" ? "يرجى إدخال رمز التحقق المكون من 6 أرقام." : "Please enter the 6-digit code.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      const res = await verifyRecoveryApprovalOtpAndRestoreApi(normalizedEmail, otpCode.trim());
      if (!res.success || !res.user) {
        throw new Error(res.error || (lang === "ar" ? "فشل استعادة الحساب. يرجى التأكد من الرمز." : "Failed to restore account."));
      }

      const user = res.user as User;
      setRestoredUser(user);
      setViewMode("success_view");

      setTimeout(() => {
        onCancel();
      }, 2500);

    } catch (err: any) {
      setErrorMessage(err.message || (lang === "ar" ? "رمز التحقق غير صحيح أو انتهت صلاحيته." : "Invalid or expired verification code."));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className={`w-full max-w-xl mx-auto p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${
      theme === "dark" 
        ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-slate-950/50" 
        : "bg-white border-slate-200 text-slate-900 shadow-slate-200/50"
    }`} dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Header Banner */}
      <div className="text-center space-y-3 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#2563EB]/20 text-[#2563EB] mb-1 shadow-sm">
          <ShieldAlert className="w-7 h-7 text-[#2563EB]" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {lang === "ar" ? "تم حذف حسابك" : "Your account has been deleted"}
        </h2>

        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {lang === "ar"
            ? `البريد الإلكتروني (${normalizedEmail}) مرتبط بحساب تم حذفه سابقاً ولا يمكن الوصول إليه كالمعتاد. تتطلب استعادة الحساب تقديم طلب مراجعة من قبل الإدارة.`
            : `The account associated with (${normalizedEmail}) was previously deleted and cannot be accessed normally. Account recovery requires submitting a request for administrator review.`}
        </p>

        {/* Email Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] dark:bg-blue-950/50 dark:text-blue-300 font-mono text-xs font-semibold border border-blue-200 dark:border-blue-900">
          <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>{normalizedEmail}</span>
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">{lang === "ar" ? "تنبيه:" : "Notice:"}</span>
            <p className="leading-normal">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* VIEW 1: STATUS OVERVIEW */}
      {viewMode === "status_view" && (
        <div className="space-y-6">
          {loadingStatus ? (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#2563EB] animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-medium">
                {lang === "ar" ? "جارٍ التحقق من حالة طلب الاستعادة…" : "Checking recovery status…"}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              
              {/* Status 1: NO REQUEST SUBMITTED */}
              {statusType === "none" && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {lang === "ar" ? "لم يتم تقديم طلب استعادة" : "No recovery request submitted"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === "ar"
                      ? "لاستعادة الوصول إلى حسابك، يلزم تقديم طلب استعادة يتضمن تفاصيل الهوية وسبب الاستعادة لمراجعته من قبل مسؤولي المنصة."
                      : "To restore access to your account and workspace data, you must submit an account recovery request with identity verification for administrator review."}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setFormStep(1);
                      setViewMode("form_view");
                    }}
                    className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{lang === "ar" ? `تقديم طلب استعادة الحساب (${normalizedEmail})` : `Request account recovery (${normalizedEmail})`}</span>
                  </button>
                </div>
              )}

              {/* Status 2: REQUEST PENDING */}
              {(statusType === "pending" || statusType === "under_review") && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{lang === "ar" ? "طلب الاستعادة قيد المراجعة" : "Recovery request pending"}</span>
                    </span>

                    {requestData?.submittedAt && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(requestData.submittedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {lang === "ar" 
                        ? "سيتم مراجعة طلب الاستعادة الخاص بك من قبل مسؤول النظام. وسيتم إخطارك فور اتخاذ القرار."
                        : "Your recovery request will be reviewed by an administrator. You will be notified when a decision is made."}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === "ar"
                        ? "يرجى الانتظار حتى اكتمال المراجعة. لا يمكنك تقديم طلب جديد أثناء وجود طلب قيد المراجعة."
                        : "Please wait for administrator review. Duplicate requests are blocked while review is pending."}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={checkStatus}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "تحديث الحالة" : "Refresh Status"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status 3: REQUEST REJECTED */}
              {statusType === "rejected" && (
                <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                      {lang === "ar" ? "تم رفض طلب الاستعادة" : "Recovery request rejected"}
                    </span>
                  </div>

                  {rejectionReason && (
                    <div className="p-3 bg-rose-500/15 rounded-xl border border-rose-500/20 space-y-1">
                      <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                        {lang === "ar" ? "سبب الرفض الموضح من الإدارة:" : "Reason for rejection:"}
                      </span>
                      <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                        "{rejectionReason}"
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === "ar"
                      ? "تم مراجعة طلبك السابق ورفضه. يمكنك تقديم طلب استعادة جديد متضمناً الوثائق وتوضيح الأسباب."
                      : "Your previous recovery request was reviewed and rejected. You may submit a new recovery request with updated details."}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setFormStep(1);
                      setViewMode("form_view");
                    }}
                    className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{lang === "ar" ? `تقديم طلب استعادة جديد (${normalizedEmail})` : `Submit a new recovery request (${normalizedEmail})`}</span>
                  </button>
                </div>
              )}

              {/* Status 4: REQUEST APPROVED */}
              {statusType === "approved" && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{lang === "ar" ? "تمت الموافقة على طلب الاستعادة" : "Recovery request approved"}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {lang === "ar"
                      ? "تمت الموافقة على طلب استعادة حسابك من قبل الإدارة! للمتابعة واستعادة الحساب، يرجى إجراء إثبات ملكية البريد الإلكتروني."
                      : "Your account recovery request has been approved by an administrator! To complete restoration, please proceed to verify your email address."}
                  </p>

                  <button
                    type="button"
                    onClick={handleStartEmailVerification}
                    disabled={isSendingOtp}
                    className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSendingOtp ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    <span>{lang === "ar" ? "المتابعة لإثبات ملكية البريد الإلكتروني" : "Proceed to Email Verification"}</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{lang === "ar" ? "العودة لتسجيل الدخول" : "Back to Sign In"}</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: MULTI-STEP RECOVERY FORM */}
      {viewMode === "form_view" && (
        <form onSubmit={handleSubmitForm} className="space-y-5">
          {/* Step Progress Bar */}
          <div className="flex items-center justify-between gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div 
                key={stepNum} 
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  stepNum === formStep 
                    ? "bg-[#2563EB]" 
                    : stepNum < formStep 
                    ? "bg-[#1D4ED8]/40" 
                    : "bg-slate-200 dark:bg-slate-700"
                }`} 
              />
            ))}
          </div>

          <div className="text-xs font-bold text-slate-400 font-mono">
            {lang === "ar" ? `الخطوة ${formStep} من 5` : `Step ${formStep} of 5`}
          </div>

          {/* STEP 1: Account Information */}
          {formStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#2563EB]" />
                <span>{lang === "ar" ? "معلومات الحساب والتواصل" : "Account & Contact Information"}</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "البريد الإلكتروني للحساب" : "Account Email Address"}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={normalizedEmail}
                    className="w-full p-2.5 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === "ar" ? "أدخل اسمك الكامل" : "Enter your full name"}
                    className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "رقم الهاتف *" : "Phone Number *"}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966 50 123 4567"
                      className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "اسم المنظمة / الشركة (إن وجد)" : "Organization / Company Name (Optional)"}
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder={lang === "ar" ? "اسم الشركة أو المؤسسة" : "Company or organization name"}
                    className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!fullName.trim() || !phone.trim()) {
                    setErrorMessage(lang === "ar" ? "يرجى تعبئة الحقول المطلوبة." : "Please fill in required fields.");
                    return;
                  }
                  setErrorMessage(null);
                  setFormStep(2);
                }}
                className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === "ar" ? "التالي: سبب الاستعادة" : "Next: Recovery Reason"}
              </button>
            </div>
          )}

          {/* STEP 2: Reason for Deletion / Recovery */}
          {formStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <span>{lang === "ar" ? "سبب حذف واستعادة الحساب" : "Reason for Deletion & Recovery"}</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "لماذا تم حذف الحساب ولماذا ترغب في استعادته؟ *" : "Why was the account deleted and why do you wish to recover it? *"}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder={lang === "ar" 
                      ? "وضح بالتفصيل سبب حذف الحساب السابق والسياق الداعي لاستعادته الآن..." 
                      : "Explain the details regarding account deletion and the context for restoring it..."}
                    className="w-full p-3 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "ar" ? "معلومات مساحة العمل السابقة (اختياري)" : "Previous Workspace Info (Optional)"}
                  </label>
                  <input
                    type="text"
                    value={previousWorkspaceInfo}
                    onChange={(e) => setPreviousWorkspaceInfo(e.target.value)}
                    placeholder={lang === "ar" ? "مثال: اسم مساحة العمل، الملفات المخزنة" : "e.g. Workspace name, projects"}
                    className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === "ar" ? "السابق" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!deletionReason.trim()) {
                      setErrorMessage(lang === "ar" ? "يرجى كتابة سبب الاستعادة." : "Please enter recovery reason.");
                      return;
                    }
                    setErrorMessage(null);
                    setFormStep(3);
                  }}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "التالي: الموافقة على الشروط" : "Next: Terms Agreement"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Platform Terms Acknowledgement */}
          {formStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <span>{lang === "ar" ? "الموافقة على شروط المنصة" : "Platform Terms Acknowledgement"}</span>
              </h3>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === "ar"
                    ? "بتقديم هذا الطلب، أقر بصحة جميع البيانات المدخلة وبأحقيتي القانونية في طلب استعادة الحساب، وأتعهد بالالتزام التام بسياسات الاستخدام العادل وشروط الخدمة الخاصة بـ Zakir."
                    : "By submitting this request, I declare that all information provided is true and accurate, and I agree to comply with Zakir's Terms of Service and security policies."}
                </p>

                <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded text-[#2563EB] focus:ring-[#2563EB] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {lang === "ar"
                      ? "أقر وأوافق على الالتزام بشروط خدمة Zakir وسياسات الاستخدام."
                      : "I acknowledge and agree to comply with Zakir's Terms of Service and platform policies."}
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormStep(2)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === "ar" ? "السابق" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!termsAccepted) {
                      setErrorMessage(lang === "ar" ? "يجب الموافقة على الشروط للمتابعة." : "You must accept terms to proceed.");
                      return;
                    }
                    setErrorMessage(null);
                    setFormStep(4);
                  }}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "التالي: إثبات الهوية" : "Next: Identity Verification"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Identity Verification Document */}
          {formStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#2563EB]" />
                <span>{lang === "ar" ? "إثبات الهوية والوثائق" : "Identity Verification Document"}</span>
              </h3>

              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-center space-y-3">
                {isUploadingFile ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <RefreshCw className="w-6 h-6 text-[#2563EB] animate-spin" />
                    <p className="text-xs font-bold text-slate-500">
                      {lang === "ar" ? "جاري رفع المستند بأمان..." : "Uploading document securely..."}
                    </p>
                  </div>
                ) : attachedDoc ? (
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-2.5 text-left rtl:text-right">
                      <FileText className="w-5 h-5 text-[#2563EB] shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{attachedDoc.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{attachedDoc.mimeType}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedDoc(null)}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-[#2563EB] mx-auto opacity-80" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {lang === "ar" ? "ارفق رسمياً وثيقة إثبات الهوية (جواز سفر / هوية وطنية / رخصة)" : "Attach official identity document (Passport, National ID, Driver's License)"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {lang === "ar" ? "الصيغ المقبولة: PDF, PNG, JPG (الحد الأقصى 5 ميجابايت)" : "Accepted formats: PDF, PNG, JPG (Up to 5MB)"}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "اختيار ملف" : "Choose File"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
                <span>
                  {lang === "ar"
                    ? "يتم نقل وتشفير وثائق الهوية بأمان، وتقتصر إمكانية الوصول عليها على مسؤولي المنصة المخولين فقط لغرض التحقق من الملكية."
                    : "Identity documents are transmitted securely and restricted strictly to authorized administrators for verification purposes."}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormStep(3)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === "ar" ? "السابق" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!attachedDoc) {
                      setErrorMessage(lang === "ar" ? "يرجى إرفاق الوثيقة." : "Please attach identity document.");
                      return;
                    }
                    setErrorMessage(null);
                    setFormStep(5);
                  }}
                  className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === "ar" ? "التالي: المراجعة والإرسال" : "Next: Review & Submit"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Confirmation & Submission */}
          {formStep === 5 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2563EB]" />
                <span>{lang === "ar" ? "مراجعة الطلب وتأكيد الإرسال" : "Review & Confirm Request"}</span>
              </h3>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-400">{lang === "ar" ? "مقدم الطلب:" : "Applicant:"}</span>
                  <span className="font-bold">{fullName} ({normalizedEmail})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-400">{lang === "ar" ? "رقم الهاتف:" : "Phone:"}</span>
                  <span className="font-mono">{phone}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-400">{lang === "ar" ? "الوثيقة المرفقة:" : "Identity Doc:"}</span>
                  <span className="font-semibold text-[#2563EB]">{attachedDoc?.name}</span>
                </div>
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">{lang === "ar" ? "سبب الاستعادة:" : "Recovery Reason:"}</span>
                  <p className="p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 italic">
                    "{deletionReason}"
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#EFF6FF] dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-semibold text-[#1D4ED8] dark:text-blue-300">
                {lang === "ar"
                  ? "سيتم مراجعة طلب الاستعادة الخاص بك من قبل مسؤول النظام. وسيتم إخطارك فور اتخاذ القرار."
                  : "Your recovery request will be reviewed by an administrator. You will be notified when a decision is made."}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormStep(4)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === "ar" ? "السابق" : "Back"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="flex-1 py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmittingForm ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{lang === "ar" ? `إرسال طلب الاستعادة للإدارة (${normalizedEmail})` : `Submit recovery request (${normalizedEmail})`}</span>
                </button>
              </div>
            </div>
          )}

        </form>
      )}

      {/* VIEW 3: EMAIL VERIFICATION AFTER APPROVAL */}
      {viewMode === "verify_email_view" && (
        <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fade-in">
          <div className="p-4 rounded-xl bg-[#EFF6FF] border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 space-y-2">
            <h3 className="text-xs font-bold text-[#1D4ED8] dark:text-blue-300 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#2563EB]" />
              <span>{lang === "ar" ? "رمز التحقق لإكمال الاستعادة" : "Verification Code for Account Restoration"}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === "ar"
                ? `تم إرسال رمز تحقق مكون من 6 أرقام إلى بريدك الإلكتروني (${normalizedEmail}) لإكمال تفعيل واستعادة حسابك.`
                : `A 6-digit verification code was sent to (${normalizedEmail}) to finalize restoring your approved account.`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {lang === "ar" ? "رمز التحقق (6 أرقام)" : "Verification Code (6 digits)"}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              className="w-full p-3 rounded-xl text-center font-mono text-base tracking-widest bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-[#2563EB] outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={resendCooldown > 0 || isSendingOtp}
              onClick={handleStartEmailVerification}
              className="text-[#2563EB] hover:underline disabled:opacity-50 cursor-pointer font-semibold"
            >
              {resendCooldown > 0 
                ? (lang === "ar" ? `إعادة الإرسال بعد (${resendCooldown}ث)` : `Resend in (${resendCooldown}s)`)
                : (lang === "ar" ? "إعادة إرسال الرمز" : "Resend Code")}
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifyingOtp}
            className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isVerifyingOtp ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{lang === "ar" ? "تأكيد واستعادة الحساب" : "Verify & Restore Account"}</span>
          </button>
        </form>
      )}

      {/* VIEW 4: SUCCESS VIEW */}
      {viewMode === "success_view" && (
        <div className="text-center space-y-4 py-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 mb-1">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {lang === "ar" ? "تمت استعادة حسابك بنجاح!" : "Account Restored Successfully!"}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {lang === "ar"
              ? "تمت استعادة حسابك وصلاحياتك وتوجيهك مباشرة إلى جلسة العمل."
              : "Your account and workspace role have been fully restored. Transitioning to your active session..."}
          </p>

          {restoredUser && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs font-mono space-y-1 text-slate-600 dark:text-slate-300">
              <div>{lang === "ar" ? "الدور المحفوظ:" : "Preserved Role:"} <span className="font-bold text-[#2563EB]">{restoredUser.role || "CEO"}</span></div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
