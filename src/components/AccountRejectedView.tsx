import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  UploadCloud,
  FileCheck,
  Trash2,
  RefreshCw,
  LogOut,
  Send,
  Eye,
  FileText,
  Info,
  CheckCircle2,
  Building2,
  XCircle
} from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { User as UserType, UploadedVerificationDoc } from "../types";
import { authenticatedFetch } from "../lib/apiUtils.js";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

interface AccountRejectedViewProps {
  currentUser: UserType;
  lang?: "ar" | "en" | "fr";
  theme?: "light" | "dark";
  onLogout: () => void;
  onResubmitSuccess?: (updatedUser: UserType) => void;
  onContactSupport?: () => void;
}

export const AccountRejectedView: React.FC<AccountRejectedViewProps> = ({
  currentUser,
  lang = "ar",
  theme = "dark",
  onLogout,
  onResubmitSuccess,
  onContactSupport,
}) => {
  const isAr = lang === "ar";
  const reason =
    currentUser.rejectionReason ||
    currentUser.verificationInfo?.adminNote ||
    (isAr
      ? "يرجى تقديم مستندات ثبوتية رسمية واضحة ومحدثة."
      : "Please provide clear, valid, and up-to-date official identification documents.");

  // Documents
  const [personalDocs, setPersonalDocs] = useState<UploadedVerificationDoc[]>(() => {
    return (currentUser.verificationDocuments || []).filter(
      (d) => d.category === "personal"
    );
  });
  const [companyDocs, setCompanyDocs] = useState<UploadedVerificationDoc[]>(() => {
    return (currentUser.verificationDocuments || []).filter(
      (d) => d.category === "company"
    );
  });

  const [hasCompany, setHasCompany] = useState(
    Boolean(currentUser.hasCompany || (currentUser.institutionalProfile as any)?.hasCompany)
  );
  const [companyName, setCompanyName] = useState(
    currentUser.institutionalProfile?.companyName || currentUser.companyName || ""
  );
  const [fullName, setFullName] = useState(
    currentUser.institutionalProfile?.fullName || currentUser.fullName || currentUser.ownerName || ""
  );
  const [phone, setPhone] = useState(
    currentUser.institutionalProfile?.phone || currentUser.phone || ""
  );
  const [resubmitNotes, setResubmitNotes] = useState("");

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<"personal" | "company">("personal");
  const [selectedDocType, setSelectedDocType] = useState<string>("national_id");
  const [uploadError, setUploadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string; category?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const validTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    const validExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      return isAr
        ? "نوع الملف غير مدعوم. الأنواع المدعومة: PDF, PNG, JPG, JPEG, WEBP."
        : "Unsupported file type. Supported types: PDF, PNG, JPG, JPEG, WEBP.";
    }

    if (file.size > 10 * 1024 * 1024) {
      return isAr
        ? "حجم الملف يتجاوز الحد الأقصى (10 ميغابايت)."
        : "File size exceeds 10MB limit.";
    }

    return null;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError("");
    const file = files[0];

    const validationMsg = validateFile(file);
    if (validationMsg) {
      setUploadError(validationMsg);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      formData.append("docType", selectedDocType);

      const res = await authenticatedFetch("/api/auth/verification-document/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.userFriendlyMessage ||
            errorData.message ||
            errorData.error ||
            (isAr ? "فشل رفع الملف." : "Failed to upload file.")
        );
      }

      const resJson = await res.json();
      const uploadedDoc: UploadedVerificationDoc = resJson.document;

      if (uploadCategory === "personal") {
        setPersonalDocs((prev) => [...prev, uploadedDoc]);
      } else {
        setCompanyDocs((prev) => [...prev, uploadedDoc]);
      }
    } catch (err: any) {
      setUploadError(err.message || (isAr ? "حدث خطأ أثناء الرفع." : "Upload error."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDoc = (category: "personal" | "company", docId: string) => {
    if (category === "personal") {
      setPersonalDocs((prev) => prev.filter((d) => d.documentId !== docId));
    } else {
      setCompanyDocs((prev) => prev.filter((d) => d.documentId !== docId));
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (personalDocs.length === 0) {
      setSubmitError(
        isAr
          ? "يرجى رفع وثيقة إثبات شخصية رسمية واحدة على الأقل قبل إعادة الإرسال."
          : "Please upload at least one personal identity document before resubmitting."
      );
      return;
    }

    if (hasCompany && !companyName.trim()) {
      setSubmitError(
        isAr
          ? "يرجى إدخال اسم المنشأة أو إلغاء تحديد خيار الشركة."
          : "Please enter company name or uncheck company option."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim() || currentUser.fullName || currentUser.ownerName,
        phone: phone.trim() || currentUser.phone,
        hasCompany,
        companyName: hasCompany ? companyName.trim() : "",
        personalDocuments: personalDocs,
        companyDocuments: hasCompany ? companyDocs : [],
        additionalNotes: resubmitNotes.trim()
          ? `[إعادة إرسال]: ${resubmitNotes.trim()}`
          : (currentUser.institutionalProfile?.additionalNotes || ""),
      };

      const response = await authenticatedFetch("/api/auth/submit-verification-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(
          resData.userFriendlyMessage ||
            resData.error ||
            resData.message ||
            (isAr ? "فشل إعادة الإرسال." : "Failed to resubmit documents.")
        );
      }

      setSubmitSuccess(
        isAr
          ? "تمت إعادة إرسال المستندات بنجاح للمراجعة الإدارية!"
          : "Documents resubmitted successfully for administrative review!"
      );

      const updatedUser: UserType = {
        ...currentUser,
        ...(resData.user || {}),
        accountStatus: "PENDING_ADMIN_REVIEW",
        documentVerificationStatus: "UNDER_REVIEW",
        rejectionReason: undefined,
        verificationDocuments: [
          ...personalDocs,
          ...(hasCompany ? companyDocs : []),
        ],
        institutionalProfile: resData.institutionalProfile,
      };

      setTimeout(() => {
        if (onResubmitSuccess) {
          onResubmitSuccess(updatedUser);
        }
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message || (isAr ? "حدث خطأ أثناء الإرسال." : "Error resubmitting."));
    } finally {
      setIsSubmitting(false);
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
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800/80 mb-6">
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

      {/* Main Container */}
      <main className="max-w-3xl w-full mx-auto flex-1 pb-12">
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Header Title & Reason */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>{isAr ? "يلزم تحديث مستندات التوثيق" : "Action Required: Update Verification Documents"}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {isAr ? "مراجعة وتحديث مستندات الحساب" : "Review & Update Verification Documents"}
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isAr
                ? "بعد فحص المستندات المقدمة، يرجى استبدال أو رفع الوثائق المطلوبة وفق الملاحظات الإدارية أدناه، ثم الضغط على إعادة إرسال للمراجعة."
                : "After reviewing your submitted application, please replace or upload the required documents per admin remarks below, then resubmit for review."}
            </p>
          </div>

          {/* Admin Rejection Reason Banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-right space-y-1.5">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{isAr ? "سبب الرفض والملاحظات الإدارية:" : "Admin Rejection Reason:"}</span>
            </div>
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200 leading-relaxed">
              {reason}
            </p>
          </div>

          {/* Messages */}
          {submitSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {(submitError || uploadError) && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-sm font-semibold flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{submitError || uploadError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleResubmit} className="space-y-6">
            {/* Current Uploaded Documents */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0075DE]" />
                <span>{isAr ? "الوثائق المرفوعة حالياً:" : "Current Attached Documents:"}</span>
              </h2>

              {personalDocs.length === 0 && companyDocs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {isAr ? "لا توجد مستندات مرفوعة حالياً. يرجى رفع مستند هوية أدناه." : "No documents currently attached. Please upload below."}
                </p>
              ) : (
                <div className="space-y-2">
                  {personalDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{getDocTypeLabel(doc.docType)}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({ id: doc.documentId, name: doc.fileName, category: doc.category })}
                          className="p-1.5 text-slate-500 hover:text-[#0075DE] transition-colors"
                          title={isAr ? "معاينة الوثيقة" : "Preview"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc("personal", doc.documentId)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors"
                          title={isAr ? "حذف الوثيقة" : "Remove"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {companyDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileCheck className="w-5 h-5 text-blue-500 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {doc.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{getDocTypeLabel(doc.docType)}</span>
                            <span>•</span>
                            <span>{formatFileSize(doc.size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc({ id: doc.documentId, name: doc.fileName, category: doc.category })}
                          className="p-1.5 text-slate-500 hover:text-[#0075DE] transition-colors"
                          title={isAr ? "معاينة الوثيقة" : "Preview"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc("company", doc.documentId)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors"
                          title={isAr ? "حذف الوثيقة" : "Remove"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Replacement / New Document Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? "رفع وثيقة جديدة / بديلة:" : "Upload New / Replacement Document:"}
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="personal">{isAr ? "وثيقة شخصية" : "Personal Doc"}</option>
                    <option value="company">{isAr ? "وثيقة منشأة" : "Company Doc"}</option>
                  </select>

                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    {uploadCategory === "personal" ? (
                      <>
                        <option value="national_id">{isAr ? "بطاقة هوية" : "National ID"}</option>
                        <option value="passport">{isAr ? "جواز سفر" : "Passport"}</option>
                        <option value="driving_license">{isAr ? "رخصة قيادة" : "Driver License"}</option>
                      </>
                    ) : (
                      <>
                        <option value="commercial_register">{isAr ? "سجل تجاري" : "Commercial Register"}</option>
                        <option value="tax_card">{isAr ? "شهادة ضريبية" : "Tax Certificate"}</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Upload Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#0075DE] bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-[#0075DE] dark:hover:border-[#0075DE] bg-slate-50/50 dark:bg-slate-950/40"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[#0075DE] flex items-center justify-center">
                    {isUploading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#0075DE]">
                      {isUploading
                        ? isAr
                          ? "جاري رفع الوثيقة..."
                          : "Uploading document..."
                        : isAr
                        ? "انقر لاختيار وثيقة جديدة أو اسحبها هنا"
                        : "Click to upload replacement document"}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAr
                        ? "PDF, PNG, JPG (حتى 10 ميغابايت)"
                        : "PDF, PNG, JPG (Up to 10MB)"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resubmission Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? "توضيحات وملاحظات للإدارة مع إعادة الإرسال:" : "Notes / Clarifications for Admin:"}
              </label>
              <textarea
                rows={2}
                value={resubmitNotes}
                onChange={(e) => setResubmitNotes(e.target.value)}
                placeholder={isAr ? "مثال: تم إرفاق صورة أوضح للهوية الوطنية وتحديث البيانات..." : "Clarifications regarding the updated documents..."}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{isAr ? "تسجيل الخروج" : "Log Out"}</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || isUploading || personalDocs.length === 0}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? "جاري إعادة الإرسال..." : "Resubmitting..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 rtl:rotate-180" />
                    <span>{isAr ? "إعادة إرسال للمراجعة" : "Resubmit for Review"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
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
