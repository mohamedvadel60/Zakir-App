import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  UploadCloud,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ArrowRight,
  LogOut,
  FileCheck,
  FileWarning,
  Eye,
  Info
} from "lucide-react";
import { User as UserType, UploadedVerificationDoc } from "../types";
import { ZakirLogo } from "./ZakirLogo";
import { authenticatedFetch } from "../lib/apiUtils.js";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { auth } from "../firebase.js";

interface DocumentVerificationViewProps {
  currentUser: UserType;
  lang?: "ar" | "en";
  theme?: "light" | "dark";
  onSuccess: (updatedUser: UserType) => void;
  onLogout: () => void;
}

export const DocumentVerificationView: React.FC<DocumentVerificationViewProps> = ({
  currentUser,
  lang = "ar",
  theme = "dark",
  onSuccess,
  onLogout,
}) => {
  const isAr = lang === "ar";

  // Form Fields
  const [fullName, setFullName] = useState(
    currentUser.fullName || currentUser.ownerName || ""
  );
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [jobTitle, setJobTitle] = useState(currentUser.jobTitle || "");
  const [hasCompany, setHasCompany] = useState(Boolean(currentUser.hasCompany));
  const [companyName, setCompanyName] = useState(currentUser.companyName || "");
  const [sector, setSector] = useState(currentUser.institutionalProfile?.sector || "Technology");
  const [country, setCountry] = useState(currentUser.institutionalProfile?.country || "Saudi Arabia");
  const [registrationNumber, setRegistrationNumber] = useState(
    (currentUser.institutionalProfile as any)?.registrationNumber || ""
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    currentUser.institutionalProfile?.additionalNotes || ""
  );

  // Document Storage
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

  // Selected doc types for uploads
  const [selectedPersonalDocType, setSelectedPersonalDocType] = useState<
    "national_id" | "passport" | "driving_license" | "other"
  >("national_id");
  const [selectedCompanyDocType, setSelectedCompanyDocType] = useState<
    "commercial_register" | "tax_card" | "other"
  >("commercial_register");

  // Upload States
  const [isUploadingPersonal, setIsUploadingPersonal] = useState(false);
  const [isUploadingCompany, setIsUploadingCompany] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string; category?: string } | null>(null);

  // Hidden File Inputs
  const personalFileInputRef = useRef<HTMLInputElement>(null);
  const companyFileInputRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [isDraggingPersonal, setIsDraggingPersonal] = useState(false);
  const [isDraggingCompany, setIsDraggingCompany] = useState(false);

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

  const uploadFileToServer = async (
    file: File,
    category: "personal" | "company",
    docType: string
  ): Promise<UploadedVerificationDoc> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("docType", docType);

    const response = await authenticatedFetch("/api/auth/verification-document/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.userFriendlyMessage ||
          errorData.message ||
          errorData.error ||
          (isAr ? "فشل رفع الملف إلى الخادم." : "Failed to upload file to server.")
      );
    }

    const resJson = await response.json();
    return resJson.document;
  };

  const handlePersonalFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError("");
    const file = files[0];

    const validationMsg = validateFile(file);
    if (validationMsg) {
      setUploadError(validationMsg);
      return;
    }

    setIsUploadingPersonal(true);
    try {
      const uploadedDoc = await uploadFileToServer(
        file,
        "personal",
        selectedPersonalDocType
      );
      setPersonalDocs((prev) => [...prev, uploadedDoc]);
    } catch (err: any) {
      setUploadError(err.message || (isAr ? "حدث خطأ أثناء الرفع." : "Upload error."));
    } finally {
      setIsUploadingPersonal(false);
      if (personalFileInputRef.current) personalFileInputRef.current.value = "";
    }
  };

  const handleCompanyFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError("");
    const file = files[0];

    const validationMsg = validateFile(file);
    if (validationMsg) {
      setUploadError(validationMsg);
      return;
    }

    setIsUploadingCompany(true);
    try {
      const uploadedDoc = await uploadFileToServer(
        file,
        "company",
        selectedCompanyDocType
      );
      setCompanyDocs((prev) => [...prev, uploadedDoc]);
    } catch (err: any) {
      setUploadError(err.message || (isAr ? "حدث خطأ أثناء الرفع." : "Upload error."));
    } finally {
      setIsUploadingCompany(false);
      if (companyFileInputRef.current) companyFileInputRef.current.value = "";
    }
  };

  const removeDoc = (category: "personal" | "company", docId: string) => {
    if (category === "personal") {
      setPersonalDocs((prev) => prev.filter((d) => d.documentId !== docId));
    } else {
      setCompanyDocs((prev) => prev.filter((d) => d.documentId !== docId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!fullName.trim() || !phone.trim()) {
      setSubmitError(
        isAr
          ? "يرجى إدخال الاسم الكامل ورقم الهاتف للتواصل."
          : "Please enter your full name and phone number."
      );
      return;
    }

    if (personalDocs.length === 0) {
      setSubmitError(
        isAr
          ? "يرجى رفع وثيقة إثبات شخصية رسمية واحدة على الأقل (بطاقة هوية / جواز سفر)."
          : "Please upload at least one personal identification document."
      );
      return;
    }

    if (hasCompany && !companyName.trim()) {
      setSubmitError(
        isAr
          ? "يرجى كتابة اسم المنشأة / الشركة أو إلغاء تحديد خيار المنشأة."
          : "Please enter the company name or deselect the company option."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        hasCompany,
        companyName: hasCompany ? companyName.trim() : "",
        sector: hasCompany ? sector.trim() : "",
        country: hasCompany ? country.trim() : "",
        registrationNumber: hasCompany ? registrationNumber.trim() : "",
        personalDocuments: personalDocs,
        companyDocuments: hasCompany ? companyDocs : [],
        additionalNotes: additionalNotes.trim(),
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
            (isAr ? "فشل إرسال مستندات التوثيق." : "Failed to submit verification documents.")
        );
      }

      // Transition to updated user
      const updatedUser: UserType = {
        ...currentUser,
        ...(resData.user || {}),
        accountStatus: "PENDING_ADMIN_REVIEW",
        documentVerificationStatus: "UNDER_REVIEW",
        requiresDocumentVerification: true,
        verificationDocuments: [
          ...personalDocs,
          ...(hasCompany ? companyDocs : []),
        ],
        institutionalProfile: resData.institutionalProfile,
      };

      onSuccess(updatedUser);
    } catch (err: any) {
      setSubmitError(err.message || (isAr ? "حدث خطأ غير متوقع." : "An unexpected error occurred."));
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
        return isAr ? "السجل التجاري / الترخيص" : "Commercial Register / License";
      case "tax_card":
        return isAr ? "الشهادة / البطاقة الضريبية" : "Tax Certificate";
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
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800/80 mb-8">
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
      <main className="max-w-4xl w-full mx-auto flex-1 pb-12">
        {/* Stepper Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-lg mx-auto relative">
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

            {/* Step 2: Documents Verification (Active) */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-[#0075DE] text-white flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/30 ring-4 ring-[#0075DE]/20">
                2
              </div>
              <span className="text-xs font-bold text-[#0075DE]">
                {isAr ? "توثيق المستندات" : "Documents"}
              </span>
            </div>

            {/* Step 3: Admin Review */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center font-semibold text-xs border border-slate-300 dark:border-slate-700">
                3
              </div>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {isAr ? "الاعتماد الإداري" : "Admin Review"}
              </span>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl p-6 sm:p-8 transition-all">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isAr ? "توثيق الحساب والمستندات" : "Account Verification & Documents"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isAr
                  ? "يرجى إكمال بيانات الحساب ورفع الوثائق الرسمية المطلوبة لاعتماد حسابك وتفعيل فترة التجربة المعتمدة."
                  : "Please provide your details and required official documents for account review and activation."}
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {(submitError || uploadError) && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{submitError || uploadError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Basic Personal Info */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <User className="w-4 h-4 text-[#0075DE]" />
                <span>{isAr ? "بيانات صاحب الحساب" : "Account Owner Details"}</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? "الاسم الكامل *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isAr ? "مثال: عبدالله محمد" : "e.g. Abdullah Mohamed"}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isAr ? "رقم الهاتف / الجوال *" : "Phone Number *"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={isAr ? "مثال: +966 50 000 0000" : "+966 50 000 0000"}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Personal Documents (Mandatory) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0075DE]" />
                  <span>{isAr ? "المستندات الشخصية (مطلوب وثيقة واحدة على الأقل) *" : "Personal Identification Documents *"}</span>
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? "الحد الأقصى: 10 ميغابايت (PDF, PNG, JPG)" : "Max 10MB (PDF, PNG, JPG)"}
                </span>
              </div>

              {/* Doc Type Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {isAr ? "نوع الوثيقة:" : "Document Type:"}
                </span>
                {(
                  [
                    { id: "national_id", label: isAr ? "بطاقة الهوية" : "National ID" },
                    { id: "passport", label: isAr ? "جواز السفر" : "Passport" },
                    { id: "driving_license", label: isAr ? "رخصة القيادة" : "Driving License" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedPersonalDocType(t.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${
                      selectedPersonalDocType === t.id
                        ? "bg-[#0075DE] text-white border-[#0075DE]"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* File Dropzone */}
              <input
                type="file"
                ref={personalFileInputRef}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handlePersonalFileSelect(e.target.files)}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingPersonal(true);
                }}
                onDragLeave={() => setIsDraggingPersonal(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingPersonal(false);
                  handlePersonalFileSelect(e.dataTransfer.files);
                }}
                onClick={() => personalFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDraggingPersonal
                    ? "border-[#0075DE] bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-[#0075DE] dark:hover:border-[#0075DE] bg-slate-50/50 dark:bg-slate-950/40"
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[#0075DE] flex items-center justify-center">
                    {isUploadingPersonal ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#0075DE]">
                      {isUploadingPersonal
                        ? isAr
                          ? "جاري رفع الملف..."
                          : "Uploading file..."
                        : isAr
                        ? "انقر لاختيار ملف أو اسحب الملف هنا"
                        : "Click to upload or drag & drop"}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAr
                        ? "صورة واضحة للهوية أو جواز السفر (PDF, PNG, JPG حتى 10 ميغابايت)"
                        : "Clear copy of National ID or Passport (PDF, PNG, JPG up to 10MB)"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Uploaded Personal Docs List */}
              {personalDocs.length > 0 && (
                <div className="space-y-2 mt-3">
                  {personalDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
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
                          title={isAr ? "حذف" : "Remove"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Optional Company Toggle & Details */}
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0075DE]" />
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {isAr ? "بيانات المنشأة / الشركة (اختياري)" : "Company / Organization (Optional)"}
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCompany}
                      onChange={(e) => setHasCompany(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-[#0075DE]"></div>
                    <span className="ms-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isAr ? "لدي شركة / مؤسسة" : "I have a company"}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAr
                    ? "إذا كنت مستخدماً فردياً، يمكنك المتابعة مباشرة دون تحديد هذا الخيار."
                    : "If you are an individual user, you can proceed directly without checking this option."}
                </p>
              </div>

              {/* Conditional Company Fields */}
              <AnimatePresence>
                {hasCompany && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden pt-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {isAr ? "اسم المنشأة / الشركة *" : "Company Name *"}
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder={isAr ? "مثال: شركة الحلول المتقدمة" : "e.g. Advanced Solutions Co."}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {isAr ? "رقم السجل التجاري / الترخيص" : "CR / License Number"}
                        </label>
                        <input
                          type="text"
                          value={registrationNumber}
                          onChange={(e) => setRegistrationNumber(e.target.value)}
                          placeholder={isAr ? "مثال: 1010XXXXXX" : "CR Number"}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {isAr ? "القطاع / مجال العمل" : "Sector / Industry"}
                        </label>
                        <input
                          type="text"
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          placeholder={isAr ? "مثال: تقنية المعلومات، تجارة، استشارات" : "e.g. Technology, Retail"}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {isAr ? "الدولة" : "Country"}
                        </label>
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder={isAr ? "المملكة العربية السعودية" : "Saudi Arabia"}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Company Documents Upload Zone */}
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {isAr ? "مستندات المنشأة (السجل التجاري أو الترخيص الرسمي)" : "Company Documents (CR or License)"}
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCompanyDocType("commercial_register")}
                            className={`px-2.5 py-0.5 text-xs rounded-md border ${
                              selectedCompanyDocType === "commercial_register"
                                ? "bg-[#0075DE] text-white border-[#0075DE]"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isAr ? "سجل تجاري" : "Commercial Register"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCompanyDocType("tax_card")}
                            className={`px-2.5 py-0.5 text-xs rounded-md border ${
                              selectedCompanyDocType === "tax_card"
                                ? "bg-[#0075DE] text-white border-[#0075DE]"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isAr ? "شهادة ضريبية" : "Tax Certificate"}
                          </button>
                        </div>
                      </div>

                      <input
                        type="file"
                        ref={companyFileInputRef}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => handleCompanyFileSelect(e.target.files)}
                      />

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingCompany(true);
                        }}
                        onDragLeave={() => setIsDraggingCompany(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingCompany(false);
                          handleCompanyFileSelect(e.dataTransfer.files);
                        }}
                        onClick={() => companyFileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                          isDraggingCompany
                            ? "border-[#0075DE] bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-slate-300 dark:border-slate-700 hover:border-[#0075DE] dark:hover:border-[#0075DE] bg-slate-50/50 dark:bg-slate-950/40"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-[#0075DE] flex items-center justify-center">
                            {isUploadingCompany ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <UploadCloud className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-[#0075DE]">
                            {isUploadingCompany
                              ? isAr
                                ? "جاري رفع وثيقة الشركة..."
                                : "Uploading company document..."
                              : isAr
                              ? "انقر لرفع مستند المنشأة (سجل تجاري / رخصة)"
                              : "Click to upload company document"}
                          </span>
                        </div>
                      </div>

                      {/* Uploaded Company Docs List */}
                      {companyDocs.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {companyDocs.map((doc) => (
                            <div
                              key={doc.documentId}
                              className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700"
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
                                  title={isAr ? "حذف" : "Remove"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Section 4: Additional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? "ملاحظات إضافية للإدارة (اختياري)" : "Additional Notes for Admin (Optional)"}
              </label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder={isAr ? "أي معلومات إضافية تود تزويد الإدارة بها..." : "Any additional info for review..."}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE] outline-none transition-colors resize-none"
              />
            </div>

            {/* Submission Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 shrink-0 text-[#0075DE]" />
                <span>
                  {isAr
                    ? "تخضع جميع الوثائق لحماية وتشفير مشدد وفق معايير الأمان المؤسسية لمنصة ذاكر."
                    : "All uploaded documents are encrypted and handled with strict enterprise security."}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isUploadingPersonal || isUploadingCompany || personalDocs.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-[#0075DE] hover:bg-[#0060B6] transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? "جاري الإرسال للمراجعة..." : "Submitting..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isAr ? "إرسال مستندات التوثيق للمراجعة" : "Submit Documents for Review"}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
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
        lang={lang}
      />
    </div>
  );
};
