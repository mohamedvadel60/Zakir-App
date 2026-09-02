import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  RotateCcw,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  Copy,
  Check,
  RefreshCw,
  Lock,
  UserCheck,
  FileCheck,
  Send,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Info,
  Mail
} from "lucide-react";
import {
  uploadRecoveryDocumentApi,
  submitAccountRecoveryRequestApi,
  fetchAccountRecoveryStatusApi,
  sendRecoveryApprovalOtpApi,
  verifyRecoveryApprovalOtpAndRestoreApi,
  checkAccountLifecycleApi
} from "../lib/firebaseServices";
import { User } from "../types";

export interface DeletedAccountRecoveryProps {
  email: string;
  daysRemaining?: number;
  restoreUntil?: string | null;
  isExpired?: boolean;
  lang: "ar" | "fr" | "en";
  theme?: "light" | "dark";
  onCancel: () => void;
  onRestored: (user: User) => void;
}

interface UploadedDocumentItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "selected" | "uploading" | "uploaded" | "failed";
  progress: number;
  documentId?: string;
  uploadToken?: string;
  storageReference?: string;
  error?: string;
}

export const DeletedAccountRecovery: React.FC<DeletedAccountRecoveryProps> = ({
  email: initialEmail,
  daysRemaining: initialDays,
  restoreUntil,
  isExpired = false,
  lang = "ar",
  theme = "light",
  onCancel,
  onRestored
}) => {
  const isRtl = lang === "ar";
  const ArrowBackIcon = isRtl ? ArrowRight : ArrowLeft;
  const ArrowForwardIcon = isRtl ? ArrowLeft : ArrowRight;

  // View state: "request" | "status" | "success" | "restore_otp"
  const [activeTab, setActiveTab] = useState<"request" | "status">("request");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Email & Lifecycle state
  const [email, setEmail] = useState((initialEmail || "").trim().toLowerCase());
  const [dynamicDays, setDynamicDays] = useState<number>(initialDays ?? 30);
  const [isLoadingLifecycle, setIsLoadingLifecycle] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      const formatted = initialEmail.trim().toLowerCase();
      setEmail(formatted);
      setStatusEmail(prev => prev || formatted);
    }
  }, [initialEmail]);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Document Uploads State
  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [submissionSuccessData, setSubmissionSuccessData] = useState<any | null>(null);
  const [copiedRequestId, setCopiedRequestId] = useState(false);

  // Error & Alert States
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Status Check State
  const [statusEmail, setStatusEmail] = useState(initialEmail.trim().toLowerCase());
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<{
    recoverable: boolean;
    status: "none" | "pending" | "under_review" | "approved" | "rejected";
    remainingDays?: number;
    recoveryRequest: any | null;
  } | null>(null);

  // OTP Restoration State (if approved)
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Format File Size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Translations Map
  const t = {
    badge: lang === "ar" ? "استعادة الحساب" : lang === "fr" ? "Récupération de compte" : "Account Recovery",
    title: lang === "ar" ? "استعادة الحساب المحذوف" : lang === "fr" ? "Récupération du compte supprimé" : "Recover Deleted Account",
    subtitle:
      lang === "ar"
        ? "تم العثور على حسابك المحذوف سابقاً وهو متاح للاستعادة بالكامل مع كافة البيانات والمستندات المحفوظة خلال الفترة النظامية."
        : lang === "fr"
        ? "Votre compte précédemment supprimé a été détecté et reste récupérable avec toutes vos données durant la période autorisée."
        : "Your previously deleted account was detected and is eligible for full restoration with all documents and settings.",
    statusAvailable:
      lang === "ar"
        ? `الاستعادة متاحة • متبقي ${dynamicDays} يوماً`
        : lang === "fr"
        ? `Récupération disponible • ${dynamicDays} jours restants`
        : `Recovery Available • ${dynamicDays} days remaining`,
    tabNewRequest: lang === "ar" ? "تقديم طلب استعادة" : lang === "fr" ? "Nouvelle demande" : "Submit Request",
    tabCheckStatus: lang === "ar" ? "متابعة حالة الطلب" : lang === "fr" ? "Suivi du statut" : "Track Status",
    step1: lang === "ar" ? "1. معلومات الحساب" : lang === "fr" ? "1. Informations" : "1. Account Info",
    step2: lang === "ar" ? "2. وثائق التحقق" : lang === "fr" ? "2. Documents" : "2. Verification Docs",
    step3: lang === "ar" ? "3. تأكيد التقديم" : lang === "fr" ? "3. Confirmation" : "3. Review & Submit",
    infoTitle: lang === "ar" ? "معلومات مهمة حول إجراءات الاستعادة:" : lang === "fr" ? "Informations importantes sur la récupération :" : "Important Information Regarding Recovery:",
    infoPoint1:
      lang === "ar"
        ? "تظل بيانات ومستندات مساحة العمل محفوظة بشكل آمن خلال فترة السماح."
        : lang === "fr"
        ? "Vos données et documents restent sécurisés durant la période de rétention."
        : "Your workspace data and files remain securely retained during the retention window.",
    infoPoint2:
      lang === "ar"
        ? "يتطلب تقديم وثيقة رسمية سارية (بطاقة الهوية، جواز السفر، أو السجل التجاري) لإثبات الملكية."
        : lang === "fr"
        ? "Une pièce d'identité officielle (carte d'identité, passeport ou registre) est requise."
        : "A valid official document (National ID, Passport, or Business Registry) is required for ownership verification.",
    infoPoint3:
      lang === "ar"
        ? "تتم مراجعة الطلب من قبل إدارة المنصة خلال 24 إلى 48 ساعة واستعادة الحساب فور الموافقة."
        : lang === "fr"
        ? "Votre demande sera traitée par l'administration sous 24 à 48 heures."
        : "The administrative team reviews requests within 24–48 hours, restoring immediate access upon approval.",
    fullNameLabel: lang === "ar" ? "الاسم الكامل لصاحب الحساب *" : lang === "fr" ? "Nom complet du titulaire *" : "Account Owner Full Name *",
    fullNamePlaceholder: lang === "ar" ? "أدخل اسمك الثلاثي أو الرباعي" : lang === "fr" ? "Entrez votre nom complet" : "Enter your full legal name",
    phoneLabel: lang === "ar" ? "رقم الهاتف للتواصل والتحقق *" : lang === "fr" ? "Numéro de téléphone *" : "Contact Phone Number *",
    phonePlaceholder: lang === "ar" ? "+222 XX XX XX XX" : "+1 (555) 000-0000",
    orgLabel: lang === "ar" ? "اسم الشركة أو المؤسسة (اختياري)" : lang === "fr" ? "Nom de l'entreprise (optionnel)" : "Company / Organization Name (Optional)",
    orgPlaceholder: lang === "ar" ? "اسم المنشأة أو مساحة العمل" : lang === "fr" ? "Nom de la société" : "Company or Workspace name",
    reasonLabel: lang === "ar" ? "سبب وتفاصيل طلب الاستعادة *" : lang === "fr" ? "Motif de la demande *" : "Reason for Recovery Request *",
    reasonPlaceholder:
      lang === "ar"
        ? "يرجى توضيح سبب طلب استعادة الحساب وتفاصيل مساحة العمل السابقة لمطابقتها..."
        : lang === "fr"
        ? "Veuillez expliquer le motif de la récupération de votre compte..."
        : "Please explain the reason for recovering the account and any previous workspace details...",
    uploadZoneTitle:
      lang === "ar"
        ? "اسحب وأفلت وثائق الهوية هنا، أو انقر للتصفح"
        : lang === "fr"
        ? "Glissez-déposez vos documents ici, ou cliquez pour parcourir"
        : "Drag & drop identity documents here, or click to browse",
    uploadZoneSubtitle:
      lang === "ar"
        ? "الصيغ المدعومة: PDF, PNG, JPG, JPEG (الحد الأقصى: 5 ميغابايت لكل ملف - وثيقتان كحد أقصى)"
        : lang === "fr"
        ? "Formats supportés : PDF, PNG, JPG, JPEG (Max 5 Mo par fichier - 2 documents max)"
        : "Supported formats: PDF, PNG, JPG, JPEG (Max 5MB per file — up to 2 documents)",
    uploadBrowseBtn: lang === "ar" ? "اختيار ملف من الجهاز" : lang === "fr" ? "Parcourir les fichiers" : "Browse Files",
    uploadedDocsTitle: lang === "ar" ? "المستندات المرفقة للتحقق:" : lang === "fr" ? "Documents joints pour vérification :" : "Attached Verification Documents:",
    statusUploading: lang === "ar" ? "جاري الرفع..." : lang === "fr" ? "Téléversement..." : "Uploading...",
    statusUploaded: lang === "ar" ? "تم الرفع بنجاح" : lang === "fr" ? "Téléversé avec succès" : "Uploaded Successfully",
    statusFailed: lang === "ar" ? "فشل الرفع" : lang === "fr" ? "Échec du téléversement" : "Upload Failed",
    retryBtn: lang === "ar" ? "إعادة المحاولة" : lang === "fr" ? "Réessayer" : "Retry",
    removeBtn: lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Remove",
    termsText:
      lang === "ar"
        ? "أقر بأنني المالك الشرعي لهذا الحساب وأن كافة المعلومات والوثائق المرفقة صحيحة ومطابقة للهوية الرسمية."
        : lang === "fr"
        ? "Je certifie être le titulaire légitime de ce compte et que les informations et documents fournis sont authentiques."
        : "I confirm that I am the rightful owner of this account and all submitted information and documents are authentic.",
    btnNext: lang === "ar" ? "المتابعة للخطوة التالية" : lang === "fr" ? "Continuer" : "Continue",
    btnBack: lang === "ar" ? "السابق" : lang === "fr" ? "Retour" : "Back",
    btnSubmit: lang === "ar" ? "تقديم طلب استعادة الحساب" : lang === "fr" ? "Soumettre la demande de récupération" : "Submit Recovery Request",
    btnSubmitting: lang === "ar" ? "جاري تقديم الطلب..." : lang === "fr" ? "Soumission en cours..." : "Submitting Request...",
    btnCancel: lang === "ar" ? "إلغاء والعودة لتسجيل الدخول" : lang === "fr" ? "Annuler et retourner à la connexion" : "Cancel & Return to Login",
    successTitle: lang === "ar" ? "تم تقديم طلب استعادة الحساب بنجاح" : lang === "fr" ? "Demande de récupération soumise avec succès" : "Recovery Request Submitted Successfully",
    successMsg:
      lang === "ar"
        ? "تم استلام طلبك ومستندات التحقق المرفقة بأمان. يقوم فريق الإدارة بمراجعة الطلب والتحقق من الهوية."
        : lang === "fr"
        ? "Votre demande a été reçue. Notre équipe administrative vérifie vos documents."
        : "Your request and attached documents have been received. Our administrative team will verify your identity.",
    requestIdLabel: lang === "ar" ? "رقم الطلب المرجعي:" : lang === "fr" ? "Numéro de référence du dossier :" : "Request Reference ID:",
    statusLabel: lang === "ar" ? "حالة الطلب الحالية:" : lang === "fr" ? "Statut actuel :" : "Current Status:",
    statusPendingReview: lang === "ar" ? "قيد المراجعة الإدارية" : lang === "fr" ? "En attente d'examen" : "Pending Administrative Review",
    btnBackToLogin: lang === "ar" ? "العودة لصفحة الدخول" : lang === "fr" ? "Retour à la connexion" : "Back to Sign In",
    btnViewStatus: lang === "ar" ? "متابعة حالة هذا الطلب" : lang === "fr" ? "Suivre cette demande" : "Track Recovery Status",
    copySuccess: lang === "ar" ? "تم نسخ رقم الطلب" : lang === "fr" ? "Copié !" : "Copied!",
    copyId: lang === "ar" ? "نسخ الرقم" : lang === "fr" ? "Copier" : "Copy ID",
    statusCheckPlaceholder: lang === "ar" ? "أدخل بريدك الإلكتروني لمتابعة الطلب" : lang === "fr" ? "Entrez votre email de récupération" : "Enter email to check recovery status",
    btnCheckStatusNow: lang === "ar" ? "استعلام عن الحالة" : lang === "fr" ? "Vérifier le statut" : "Check Status",
    noRequestFound:
      lang === "ar"
        ? "لم يتم العثور على طلب استعادة نشط لهذا البريد الإلكتروني. يمكنك تقديم طلب جديد الآن."
        : lang === "fr"
        ? "Aucune demande de récupération trouvée pour cet email. Vous pouvez soumettre une nouvelle demande."
        : "No active recovery request found for this email. You can submit a new request now.",
    reqApprovedTitle: lang === "ar" ? "تهانينا! تمت الموافقة على طلب الاستعادة" : lang === "fr" ? "Félicitations ! Demande approuvée" : "Congratulations! Request Approved",
    reqApprovedSubtitle:
      lang === "ar"
        ? "وافقت الإدارة على طلبك. انقر أدناه لإرسال رمز التحقق واستعادة حسابك فوراً."
        : lang === "fr"
        ? "Votre demande a été approuvée. Cliquez ci-dessous pour recevoir votre code OTP et restaurer votre compte."
        : "Your recovery request has been approved. Click below to receive your verification code and restore your account.",
    btnSendRestoreOtp: lang === "ar" ? "إرسال رمز التحقق للاستعادة" : lang === "fr" ? "Envoyer le code OTP" : "Send Recovery Verification Code",
    otpCodeLabel: lang === "ar" ? "رمز التحقق (6 أرقام)" : lang === "fr" ? "Code de vérification (6 chiffres)" : "Verification Code (6 digits)",
    btnRestoreAccountNow: lang === "ar" ? "تأكيد واستعادة الحساب الآن" : lang === "fr" ? "Confirmer et restaurer le compte" : "Confirm & Restore Account Now",
    reqRejectedTitle: lang === "ar" ? "لم تتم الموافقة على طلب الاستعادة" : lang === "fr" ? "Demande non approuvée" : "Recovery Request Declined",
    rejectionReasonLabel: lang === "ar" ? "سبب عدم الموافقة:" : lang === "fr" ? "Motif du refus :" : "Reason:",
    btnSubmitNewWithDocs: lang === "ar" ? "تقديم طلب جديد بوثائق محدثة" : lang === "fr" ? "Soumettre une nouvelle demande" : "Submit New Request with Updated Docs"
  };

  // Fetch live lifecycle data on mount
  useEffect(() => {
    let isMounted = true;
    const loadLifecycle = async () => {
      if (!initialEmail) return;
      setIsLoadingLifecycle(true);
      try {
        const res = await checkAccountLifecycleApi(initialEmail.trim().toLowerCase());
        if (isMounted && res && res.success) {
          if (res.daysRemaining !== undefined) {
            setDynamicDays(res.daysRemaining);
          }
        }
      } catch (e) {
        console.warn("Lifecycle check warning:", e);
      } finally {
        if (isMounted) setIsLoadingLifecycle(false);
      }
    };
    loadLifecycle();
    return () => {
      isMounted = false;
    };
  }, [initialEmail]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(Array.from(e.target.files));
    }
    if (e.target) e.target.value = "";
  };

  // Process & Upload Selected Files
  const handleFilesSelected = (files: File[]) => {
    setUploadError(null);
    setFormError(null);

    const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".webp", ".heic", ".heif", ".txt"];
    const allowedTypeKeywords = ["pdf", "image", "png", "jpeg", "jpg", "msword", "officedocument", "text", "octet-stream"];

    if (documents.length + files.length > 2) {
      setUploadError(
        lang === "ar"
          ? "يمكنك إرفاق وثيقتين كحد أقصى (مثال: الهوية الوطنية + وثيقة داعمة أو السجل التجاري)."
          : "You can attach a maximum of 2 documents."
      );
      return;
    }

    const newDocs: UploadedDocumentItem[] = [];

    for (const file of files) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const fileType = (file.type || "").toLowerCase();
      const isExtValid = allowedExtensions.includes(ext);
      const isTypeValid = allowedTypeKeywords.some(kw => fileType.includes(kw));

      if (!isExtValid && !isTypeValid) {
        setUploadError(
          lang === "ar"
            ? `الملف (${file.name}) بصيغة غير مدعومة. يرجى رفع ملفات PDF أو Word أو صور PNG و JPG.`
            : `File (${file.name}) is unsupported. Please upload PDF, Word, PNG, or JPG files.`
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setUploadError(
          lang === "ar"
            ? `حجم الملف (${file.name}) يتجاوز الحد المسموح 10 ميغابايت. يرجى اختيار ملف أصغر.`
            : `File (${file.name}) exceeds 10MB limit. Please choose a smaller file.`
        );
        return;
      }

      const item: UploadedDocumentItem = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        status: "uploading",
        progress: 30
      };
      newDocs.push(item);
    }

    setDocuments(prev => [...prev, ...newDocs]);

    // Trigger individual uploads
    newDocs.forEach(item => {
      uploadSingleDocument(item);
    });
  };

  // Upload single document helper
  const uploadSingleDocument = async (item: UploadedDocumentItem) => {
    setDocuments(prev =>
      prev.map(d => (d.id === item.id ? { ...d, status: "uploading", progress: 50, error: undefined } : d))
    );

    try {
      const result = await uploadRecoveryDocumentApi(item.file);
      if (result && result.success && (result.documentId || result.document?.documentId)) {
        const docId = result.documentId || result.document?.documentId;
        const uploadToken = result.uploadToken || result.document?.uploadToken;
        const storageRef = result.document?.storageReference || `secure_uploads/${docId}`;

        setDocuments(prev =>
          prev.map(d =>
            d.id === item.id
              ? {
                  ...d,
                  status: "uploaded",
                  progress: 100,
                  documentId: docId,
                  uploadToken: uploadToken,
                  storageReference: storageRef
                }
              : d
          )
        );
      } else {
        const errorMsg = result?.error || result?.message || (lang === "ar" ? "فشل رفع الملف." : "Upload failed.");
        setDocuments(prev =>
          prev.map(d => (d.id === item.id ? { ...d, status: "failed", error: errorMsg } : d))
        );
      }
    } catch (err: any) {
      const errorMsg = err?.message || (lang === "ar" ? "خطأ في الاتصال بالخادم أثناء الرفع." : "Network connection error.");
      setDocuments(prev =>
        prev.map(d => (d.id === item.id ? { ...d, status: "failed", error: errorMsg } : d))
      );
    }
  };

  // Remove document
  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  // Submit Final Recovery Request
  const handleSubmitRequest = async () => {
    setFormError(null);

    if (!fullName.trim()) {
      setFormError(lang === "ar" ? "يرجى إدخال الاسم الكامل لصاحب الحساب." : "Please enter your full name.");
      setCurrentStep(1);
      return;
    }
    if (!phone.trim()) {
      setFormError(lang === "ar" ? "يرجى إدخال رقم الهاتف للتواصل والتحقق." : "Please enter a valid phone number.");
      setCurrentStep(1);
      return;
    }
    if (!recoveryReason.trim()) {
      setFormError(lang === "ar" ? "يرجى كتابة سبب وتفاصيل طلب الاستعادة." : "Please describe the reason for recovery.");
      setCurrentStep(1);
      return;
    }

    const uploadedDocs = documents.filter(d => d.status === "uploaded" && d.documentId);
    if (uploadedDocs.length === 0) {
      setFormError(
        lang === "ar"
          ? "يرجى رفع وثيقة إثبات هوية رسمية واحدة على الأقل قبل إرسال الطلب."
          : "Please upload at least one valid identification document before submitting."
      );
      setCurrentStep(2);
      return;
    }

    const hasUploading = documents.some(d => d.status === "uploading");
    if (hasUploading) {
      setFormError(
        lang === "ar"
          ? "يرجى الانتظار حتى يكتمل رفع كافة المستندات الجاري رفعها."
          : "Please wait until all document uploads have completed."
      );
      return;
    }

    if (!termsAccepted) {
      setFormError(
        lang === "ar"
          ? "يجب الموافقة على إقرار صحة البيانات وملكية الحساب للمتابعة."
          : "You must accept the terms of service and ownership declaration."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        phoneVerified: false,
        organization: organization.trim() || undefined,
        reason: recoveryReason.trim(),
        termsAccepted: true,
        documents: uploadedDocs.map(d => ({
          documentId: d.documentId!,
          uploadToken: d.uploadToken,
          storageReference: d.storageReference || `secure_uploads/${d.documentId}`,
          fileName: d.name,
          mimeType: d.type,
          size: d.size,
          uploadedAt: new Date().toISOString()
        }))
      };

      const result = await submitAccountRecoveryRequestApi(payload);

      if (result && result.success) {
        const reqId = result.requestId || result.request?.id || `REQ-${Date.now()}`;
        setSubmittedRequestId(reqId);
        setSubmissionSuccessData(result.request || result);
        setActiveTab("request");
      } else {
        const errorMsg = result?.error || result?.message || (lang === "ar" ? "فشل تقديم طلب الاستعادة. يرجى المحاولة لاحقاً." : "Failed to submit recovery request.");
        setFormError(errorMsg);
      }
    } catch (err: any) {
      setFormError(err?.message || (lang === "ar" ? "حدث خطأ غير متوقع أثناء إرسال الطلب." : "An unexpected error occurred."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy Request ID to clipboard
  const handleCopyRequestId = () => {
    if (!submittedRequestId) return;
    navigator.clipboard.writeText(submittedRequestId);
    setCopiedRequestId(true);
    setTimeout(() => setCopiedRequestId(false), 3000);
  };

  // Status Check Handler
  const handleCheckStatus = async (targetEmail?: string) => {
    const emailToQuery = (targetEmail || statusEmail || email).trim().toLowerCase();
    if (!emailToQuery) {
      setFormError(lang === "ar" ? "يرجى كتابة البريد الإلكتروني للاستعلام." : "Please enter an email address.");
      return;
    }

    setIsCheckingStatus(true);
    setFormError(null);

    try {
      const res = await fetchAccountRecoveryStatusApi(emailToQuery);
      if (res && res.success) {
        setStatusResult(res);
      } else {
        setFormError(res?.error || (lang === "ar" ? "تعذر جلب حالة الطلب." : "Could not fetch status."));
      }
    } catch (err: any) {
      setFormError(err?.message || (lang === "ar" ? "خطأ في الاتصال بالخادم." : "Server connection error."));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Send Recovery Approval OTP
  const handleSendApprovalOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendRecoveryApprovalOtpApi(statusEmail || email);
      if (res && res.success) {
        setOtpSent(true);
      } else {
        setOtpError(res?.error || (lang === "ar" ? "فشل إرسال رمز التحقق." : "Failed to send verification code."));
      }
    } catch (err: any) {
      setOtpError(err?.message || (lang === "ar" ? "خطأ في إرسال الرمز." : "Error sending code."));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP and Restore Account
  const handleVerifyOtpAndRestore = async () => {
    if (!otpCode.trim()) {
      setOtpError(lang === "ar" ? "يرجى إدخال رمز التحقق المكون من 6 أرقام." : "Please enter the 6-digit code.");
      return;
    }
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await verifyRecoveryApprovalOtpAndRestoreApi(statusEmail || email, otpCode);
      if (res && res.success && res.user) {
        onRestored(res.user);
      } else {
        setOtpError(res?.error || (lang === "ar" ? "رمز التحقق غير صحيح أو منتهي الصلاحية." : "Invalid or expired verification code."));
      }
    } catch (err: any) {
      setOtpError(err?.message || (lang === "ar" ? "فشل تأكيد الرمز واستعادة الحساب." : "Failed to restore account."));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Determine readiness for next step
  const isStep1Valid = fullName.trim().length > 2 && phone.trim().length > 5 && recoveryReason.trim().length > 3;
  const isStep2Valid = documents.some(d => d.status === "uploaded");
  const isCanSubmit = isStep1Valid && isStep2Valid && termsAccepted && !isSubmitting && !documents.some(d => d.status === "uploading");

  return (
    <div
      id="account-recovery-container"
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full max-w-2xl mx-auto bg-white dark:bg-[#0C101A] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] p-5 sm:p-7 text-slate-900 dark:text-slate-100 transition-all font-sans"
    >
      {/* TOP BAR / NAVIGATION */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/80">
        <button
          id="btn-recovery-back-top"
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
        >
          <ArrowBackIcon className="w-3.5 h-3.5" />
          <span>{t.btnCancel}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-[#0075DE] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t.badge}</span>
          </span>
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="text-start space-y-1.5 mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {t.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t.subtitle}
        </p>

        {/* Dynamic Days Remaining Banner */}
        <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t.statusAvailable}</span>
        </div>
      </div>

      {/* TABS SWITCHER: NEW REQUEST vs TRACK STATUS */}
      {!submittedRequestId && (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl mb-6">
          <button
            id="tab-new-recovery-request"
            type="button"
            onClick={() => {
              setActiveTab("request");
              setFormError(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "request"
                ? "bg-white dark:bg-[#151B28] text-[#0075DE] dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.tabNewRequest}</span>
          </button>
          <button
            id="tab-track-recovery-status"
            type="button"
            onClick={() => {
              setActiveTab("status");
              setFormError(null);
              if (email) handleCheckStatus(email);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "status"
                ? "bg-white dark:bg-[#151B28] text-[#0075DE] dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t.tabCheckStatus}</span>
          </button>
        </div>
      )}

      {/* ERROR BANNER */}
      <AnimatePresence>
        {formError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5 text-start"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{formError}</div>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* 1. SUCCESS CONFIRMATION SCREEN                      */}
      {/* ---------------------------------------------------- */}
      {submittedRequestId ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6 text-center py-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {t.successTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.successMsg}
            </p>
          </div>

          {/* REQUEST SUMMARY CARD */}
          <div className="max-w-md mx-auto p-4 bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-xl text-start space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/60">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.requestIdLabel}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-[#0075DE] dark:text-blue-400">
                  {submittedRequestId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRequestId}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                  title={t.copyId}
                >
                  {copiedRequestId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.statusLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                <Clock className="w-3 h-3" />
                <span>{t.statusPendingReview}</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span>البريد الإلكتروني:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{email}</span>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2">
            <button
              id="btn-success-back-to-login"
              type="button"
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowBackIcon className="w-3.5 h-3.5" />
              <span>{t.btnBackToLogin}</span>
            </button>
            <button
              id="btn-success-view-status"
              type="button"
              onClick={() => {
                setSubmittedRequestId(null);
                setActiveTab("status");
                handleCheckStatus(email);
              }}
              className="flex-1 h-11 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.btnViewStatus}</span>
            </button>
          </div>
        </motion.div>
      ) : activeTab === "status" ? (
        /* ---------------------------------------------------- */
        /* 2. TRACK STATUS TAB                                 */
        /* ---------------------------------------------------- */
        <div className="space-y-5 text-start">
          <div className="flex gap-2">
            <input
              type="email"
              value={statusEmail}
              onChange={e => setStatusEmail(e.target.value)}
              placeholder={t.statusCheckPlaceholder}
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0075DE]/40 dark:focus:ring-blue-500/40"
            />
            <button
              id="btn-query-recovery-status"
              type="button"
              onClick={() => handleCheckStatus()}
              disabled={isCheckingStatus}
              className="h-11 px-5 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isCheckingStatus ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>{t.btnCheckStatusNow}</span>
            </button>
          </div>

          {statusResult && (
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
              {statusResult.status === "none" ? (
                <div className="text-center py-4 space-y-2">
                  <Info className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t.noRequestFound}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0075DE] hover:underline pt-2 cursor-pointer"
                  >
                    <span>{t.tabNewRequest}</span>
                    <ArrowForwardIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : statusResult.status === "approved" ? (
                /* APPROVED STATE -> OTP RESTORE FLOW */
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">{t.reqApprovedTitle}</h4>
                      <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                        {t.reqApprovedSubtitle}
                      </p>
                    </div>
                  </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendApprovalOtp}
                      disabled={isSendingOtp}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isSendingOtp ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{t.btnSendRestoreOtp}</span>
                    </button>
                  ) : (
                    <div className="space-y-3 pt-2">
                      {otpError && (
                        <p className="text-xs text-rose-600 font-semibold">{otpError}</p>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t.otpCodeLabel}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="123456"
                          className="w-full h-11 text-center font-mono tracking-widest text-lg font-black rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyOtpAndRestore}
                        disabled={isVerifyingOtp || otpCode.length < 6}
                        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                      >
                        {isVerifyingOtp ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{t.btnRestoreAccountNow}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : statusResult.status === "rejected" ? (
                /* REJECTED STATE */
                <div className="space-y-3">
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-800 dark:text-rose-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold">{t.reqRejectedTitle}</h4>
                      {statusResult.recoveryRequest?.rejectionReason && (
                        <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                          <strong>{t.rejectionReasonLabel}</strong>{" "}
                          {statusResult.recoveryRequest.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    className="w-full h-10 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t.btnSubmitNewWithDocs}</span>
                  </button>
                </div>
              ) : (
                /* PENDING / UNDER REVIEW STATE */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500">
                      {t.requestIdLabel}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#0075DE]">
                      {statusResult.recoveryRequest?.requestId || statusResult.recoveryRequest?.id || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">{t.statusLabel}</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200">
                      <Clock className="w-3 h-3" />
                      <span>{t.statusPendingReview}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    طلبك قيد الدراسة والمطابقة مع الوثائق المرفوعة. سيتم إشعارك فور اتخاذ القرار.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* 3. NEW RECOVERY REQUEST FORM                        */
        /* ---------------------------------------------------- */
        <div className="space-y-6 text-start">
          {/* STEP INDICATORS */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div
              className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors ${
                currentStep === 1
                  ? "text-[#0075DE] dark:text-blue-400"
                  : currentStep > 1
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
              onClick={() => setCurrentStep(1)}
            >
              {currentStep > 1 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0075DE] text-[11px] flex items-center justify-center font-black">
                  1
                </span>
              )}
              <span>{t.step1}</span>
            </div>

            <ChevronRight className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-700 ${isRtl ? "rotate-180" : ""}`} />

            <div
              className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors ${
                currentStep === 2
                  ? "text-[#0075DE] dark:text-blue-400"
                  : currentStep > 2
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400"
              }`}
              onClick={() => {
                if (isStep1Valid) setCurrentStep(2);
              }}
            >
              {currentStep > 2 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] flex items-center justify-center font-black">
                  2
                </span>
              )}
              <span>{t.step2}</span>
            </div>

            <ChevronRight className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-700 ${isRtl ? "rotate-180" : ""}`} />

            <div
              className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors ${
                currentStep === 3
                  ? "text-[#0075DE] dark:text-blue-400"
                  : "text-slate-400"
              }`}
              onClick={() => {
                if (isStep1Valid && isStep2Valid) setCurrentStep(3);
              }}
            >
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] flex items-center justify-center font-black">
                3
              </span>
              <span>{t.step3}</span>
            </div>
          </div>

          {/* INFORMATION ACCORDION / CARD */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs space-y-2">
            <h4 className="font-bold text-[#0075DE] dark:text-blue-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>{t.infoTitle}</span>
            </h4>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
              <li>{t.infoPoint1}</li>
              <li>{t.infoPoint2}</li>
              <li>{t.infoPoint3}</li>
            </ul>
          </div>

          {/* ------------------------------------------- */}
          {/* STEP 1: ACCOUNT & CONTACT INFO             */}
          {/* ------------------------------------------- */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === "ar" ? "البريد الإلكتروني للحساب المطلوب استعادته *" : lang === "fr" ? "E-mail du compte à récupérer *" : "Account Email to Recover *"}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute top-1/2 -translate-y-1/2 left-3.5 rtl:right-3.5 rtl:left-auto pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      const val = e.target.value;
                      setEmail(val);
                      if (!statusEmail) setStatusEmail(val);
                    }}
                    placeholder={lang === "ar" ? "أدخل البريد الإلكتروني للحساب" : lang === "fr" ? "Entrez l'adresse e-mail du compte" : "Enter account email"}
                    className="w-full h-11 pl-10 pr-3.5 rtl:pr-10 rtl:pl-3.5 rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0075DE]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t.fullNameLabel}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder={t.fullNamePlaceholder}
                  className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-[#0075DE]/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t.phoneLabel}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-[#0075DE]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t.orgLabel}
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    placeholder={t.orgPlaceholder}
                    className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-[#0075DE]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t.reasonLabel}
                </label>
                <textarea
                  rows={3}
                  value={recoveryReason}
                  onChange={e => setRecoveryReason(e.target.value)}
                  placeholder={t.reasonPlaceholder}
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#0C101A] border border-slate-300 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-[#0075DE]/40 resize-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!fullName.trim() || !phone.trim() || !recoveryReason.trim()) {
                    setFormError(lang === "ar" ? "يرجى تعبئة كافة الحقول المطلوبة للمتابعة." : "Please fill in all required fields.");
                    return;
                  }
                  setFormError(null);
                  setCurrentStep(2);
                }}
                className="w-full h-11 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <span>{t.btnNext}</span>
                <ArrowForwardIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ------------------------------------------- */}
          {/* STEP 2: DOCUMENT UPLOADS                   */}
          {/* ------------------------------------------- */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* DRAG & DROP ZONE */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  isDragging
                    ? "border-[#0075DE] bg-blue-50/50 dark:bg-blue-950/40 scale-[1.01]"
                    : "border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-[#131926]/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.webp,.heic,.heif,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/plain"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0075DE] dark:text-blue-400 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div className="space-y-1 max-w-sm">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t.uploadZoneTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.uploadZoneSubtitle}
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-1 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all pointer-events-none"
                >
                  {t.uploadBrowseBtn}
                </button>
              </div>

              {/* UPLOAD ERROR DISPLAY */}
              {uploadError && (
                <p className="text-xs text-rose-600 font-semibold text-start flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}

              {/* ATTACHED DOCUMENTS LIST */}
              {documents.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.uploadedDocsTitle} ({documents.length}/2)
                  </h4>

                  <div className="space-y-2">
                    {documents.map(item => {
                      const isPdf = item.type.includes("pdf") || item.name.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0075DE] dark:text-blue-400 flex items-center justify-center shrink-0">
                              {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1 text-start">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span>{formatFileSize(item.size)}</span>
                                <span>•</span>
                                {item.status === "uploaded" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t.statusUploaded}
                                  </span>
                                ) : item.status === "uploading" ? (
                                  <span className="text-[#0075DE] dark:text-blue-400 font-bold flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    {t.statusUploading}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span>{t.statusFailed}{item.error ? `: ${item.error}` : ""}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.status === "failed" && (
                              <button
                                type="button"
                                onClick={() => uploadSingleDocument(item)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-[#0075DE] text-[11px] font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                {t.retryBtn}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveDocument(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title={t.removeBtn}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NAVIGATION BUTTONS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowBackIcon className="w-3.5 h-3.5" />
                  <span>{t.btnBack}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isStep2Valid) {
                      setFormError(lang === "ar" ? "يرجى رفع وثيقة إثبات هوية رسمية واحدة على الأقل." : "Please upload at least one identification document.");
                      return;
                    }
                    setFormError(null);
                    setCurrentStep(3);
                  }}
                  disabled={!isStep2Valid}
                  className="flex-1 h-11 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <span>{t.btnNext}</span>
                  <ArrowForwardIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------- */}
          {/* STEP 3: SUMMARY & SUBMIT                   */}
          {/* ------------------------------------------- */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* SUMMARY BOX */}
              <div className="p-4 bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-slate-200 dark:border-slate-800">
                  ملخص بيانات طلب الاستعادة:
                </h4>
                <div className="flex justify-between">
                  <span className="text-slate-500">البريد الإلكتروني:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{email || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الاسم الكامل:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{phone}</span>
                </div>
                {organization && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">المنشأة:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{organization}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">الوثائق المرفقة:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {documents.filter(d => d.status === "uploaded").length} وثيقة تم التحقق منها
                  </span>
                </div>
              </div>

              {/* TERMS ACCEPTANCE CHECKBOX */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#0075DE] focus:ring-[#0075DE] cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.termsText}
                </span>
              </label>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowBackIcon className="w-3.5 h-3.5" />
                  <span>{t.btnBack}</span>
                </button>
                <button
                  id="btn-submit-recovery-request"
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={!isCanSubmit}
                  className="flex-1 h-11 rounded-xl bg-[#0075DE] hover:bg-[#0060B6] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.btnSubmitting}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{t.btnSubmit}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
