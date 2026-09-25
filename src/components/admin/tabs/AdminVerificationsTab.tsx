import React, { useState } from "react";
import { 
  ShieldCheck, 
  FileText, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Download, 
  Building2, 
  Calendar,
  RefreshCw,
  HelpCircle,
  FileCheck
} from "lucide-react";
import { PendingApprovalRecord } from "../adminTypes.js";
import { safeFormatDate } from "../../../lib/dateUtils.js";
import { DocumentPreviewModal } from "../../DocumentPreviewModal.js";

interface AdminVerificationsTabProps {
  pendingApprovals: PendingApprovalRecord[];
  onApprove: (userId: string, plan: string, trialHours: number, notes: string) => Promise<void>;
  onApproveDocuments?: (userId: string, notes?: string) => Promise<void>;
  onRejectDocuments?: (userId: string, reason: string) => Promise<void>;
  onReject: (userId: string, reason: string) => Promise<void>;
  onRequireDocs: (userId: string, reason: string) => Promise<void>;
  loading: boolean;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminVerificationsTab: React.FC<AdminVerificationsTabProps> = ({
  pendingApprovals,
  onApprove,
  onApproveDocuments,
  onRejectDocuments,
  onReject,
  onRequireDocs,
  loading,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState<string>("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Action dialog state
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "require_docs" | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("Starter");
  const [customTrialHours, setCustomTrialHours] = useState(24);
  const [reasonInput, setReasonInput] = useState("");
  const [processing, setProcessing] = useState(false);

  const t = {
    title: isAr ? "طلبات التوثيق والمراجعة المؤسسية" : isFr ? "Vérifications Institutionnelles" : "Institutional Verifications & KYC",
    subtitle: isAr ? "فحص الوثائق والتراخيص الرسمية المقدمة من الشركات والمؤسسات واعتماد التوثيق" : isFr ? "Examen des documents officiels et licences pour approbation" : "Review submitted official corporate credentials & documents",
    pendingCount: isAr ? "طلبات معلقة" : isFr ? "demandes en attente" : "pending requests",
    noPending: isAr ? "لا توجد طلبات توثيق معلقة حاليًا. جميع الحسابات تمت مراجعتها." : isFr ? "Aucune demande de vérification en attente." : "No pending verification requests. All clear.",
    company: isAr ? "الشركة / المؤسسة" : isFr ? "Entreprise" : "Company",
    applicant: isAr ? "مقدم الطلب" : isFr ? "Demandeur" : "Applicant",
    submittedDocs: isAr ? "المستندات المرفقة" : isFr ? "Documents joints" : "Attached Documents",
    actions: isAr ? "اتخاذ القرار" : isFr ? "Décision" : "Decision",
    previewDoc: isAr ? "معاينة المستند" : isFr ? "Aperçu" : "Preview",
    approveBtn: isAr ? "اعتماد الوثائق و KYC" : isFr ? "Valider documents & KYC" : "Approve Documents & KYC",
    requireDocsBtn: isAr ? "طلب مستندات إضافية" : isFr ? "Demander pièces" : "Request Docs",
    rejectBtn: isAr ? "رفض الطلب" : isFr ? "Rejeter" : "Reject",
    confirmApprove: isAr ? "تأكيد اعتماد الوثائق و KYC" : isFr ? "Confirmer la validation documents" : "Confirm Document Verification Approval",
    confirmReject: isAr ? "تأكيد رفض وثائق التوثيق" : isFr ? "Confirmer le rejet des pièces" : "Confirm Document Rejection",
    confirmRequireDocs: isAr ? "طلب إعادة إرفاق مستندات" : isFr ? "Demande de renvoi" : "Require Document Resubmission",
    reasonPlaceholder: isAr ? "اكتب توضيحًا أو سببًا يظهر للمستخدم..." : isFr ? "Indiquez un motif..." : "Enter reason or instructions for the user...",
    planLabel: isAr ? "الباقة المعتمدة" : isFr ? "Plan" : "Assigned Plan",
    trialHoursLabel: isAr ? "ساعات التجربة المجانية" : isFr ? "Heures d'essai" : "Trial Hours",
    cancel: isAr ? "إلغاء" : isFr ? "Annuler" : "Cancel",
    execute: isAr ? "تنفيذ القرار" : isFr ? "Exécuter" : "Execute Decision"
  };

  const handleOpenDocPreview = (doc: any) => {
    const docId = doc.documentId || doc.id || doc.storageReference || doc.fileName;
    setSelectedDocId(docId);
    setSelectedDocName(doc.fileName || doc.name || "Verification Document");
    setIsPreviewOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!actionUserId || !actionType) return;
    setProcessing(true);
    try {
      if (actionType === "approve") {
        if (onApproveDocuments) {
          await onApproveDocuments(actionUserId, reasonInput);
        } else {
          await onApprove(actionUserId, selectedPlan, customTrialHours, reasonInput);
        }
      } else if (actionType === "reject") {
        if (onRejectDocuments) {
          await onRejectDocuments(actionUserId, reasonInput || "Verification documents could not be validated.");
        } else {
          await onReject(actionUserId, reasonInput || "Verification documents could not be validated.");
        }
      } else if (actionType === "require_docs") {
        await onRequireDocs(actionUserId, reasonInput || "Additional official identity documents required.");
      }
      setActionUserId(null);
      setActionType(null);
      setReasonInput("");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t.subtitle} • {pendingApprovals.length} {t.pendingCount}
        </p>
      </div>

      {/* List of Pending Verifications */}
      <div className="space-y-3">
        {pendingApprovals.map((req) => {
          const docs = Array.isArray(req.documents) ? req.documents : [];
          return (
            <div
              key={req.id || req.userId}
              className={`p-4 md:p-5 rounded-xl border transition-all ${
                theme === "dark" 
                  ? "bg-[#090D16]/90 border-slate-800/80" 
                  : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Applicant details */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {req.companyName || req.name || req.email}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {req.accountStatus}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span>{req.email}</span>
                      <span>•</span>
                      <span>{req.role || "CEO"}</span>
                      {req.createdAt && (
                        <>
                          <span>•</span>
                          <span>{safeFormatDate(req.createdAt, isAr ? "ar" : "en")}</span>
                        </>
                      )}
                    </div>

                    {/* Attached Documents */}
                    {docs.length > 0 ? (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium text-slate-400">
                          {t.submittedDocs}:
                        </span>
                        {docs.map((doc, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleOpenDocPreview(doc)}
                            type="button"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3 h-3 text-blue-500" />
                            <span className="truncate max-w-[150px]">{doc.fileName || doc.name || `Document #${idx + 1}`}</span>
                            <Eye className="w-3 h-3 ms-1 opacity-70" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{isAr ? "لم يقم المستخدم برفع وثائق بعد (تسجيل أولي)" : "No documents uploaded yet"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  {docs.length > 0 ? (
                    <button
                      onClick={() => {
                        setActionUserId(req.userId || req.id);
                        setActionType("approve");
                      }}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t.approveBtn}</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{isAr ? "بانتظار الوثائق (الاعتماد معطل)" : "Awaiting Docs (Approval Disabled)"}</span>
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setActionUserId(req.userId || req.id);
                      setActionType("require_docs");
                    }}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 transition-colors cursor-pointer border border-amber-200 dark:border-amber-800"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{t.requireDocsBtn}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActionUserId(req.userId || req.id);
                      setActionType("reject");
                    }}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{t.rejectBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {pendingApprovals.length === 0 && (
          <div 
            className={`p-12 text-center rounded-xl border flex flex-col items-center justify-center gap-3 ${
              theme === "dark" ? "bg-[#090D16]/90 border-slate-800/80" : "bg-white border-slate-200"
            }`}
          >
            <ShieldCheck className="w-10 h-10 text-emerald-500" />
            <div className="text-sm font-semibold">{t.noPending}</div>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {actionUserId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div 
            className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl transition-all ${
              theme === "dark" ? "bg-[#0B0F19] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold">
              {actionType === "approve" 
                ? t.confirmApprove 
                : actionType === "reject" 
                  ? t.confirmReject 
                  : t.confirmRequireDocs}
            </h3>

            {actionType === "approve" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t.planLabel}</label>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border bg-transparent outline-hidden"
                  >
                    <option value="Starter">Starter Plan</option>
                    <option value="Professional">Professional Plan</option>
                    <option value="Enterprise">Enterprise Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t.trialHoursLabel}</label>
                  <input
                    type="number"
                    value={customTrialHours}
                    onChange={(e) => setCustomTrialHours(Number(e.target.value) || 24)}
                    className="w-full text-xs p-2 rounded-lg border bg-transparent outline-hidden"
                  />
                </div>
              </div>
            )}

            {(actionType === "reject" || actionType === "require_docs") && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {isAr ? "السبب / الملاحظات" : "Reason / Feedback Notes"}
                </label>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={t.reasonPlaceholder}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border bg-transparent outline-hidden"
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setActionUserId(null);
                  setActionType(null);
                }}
                disabled={processing}
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={processing}
                type="button"
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : actionType === "reject"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {processing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.execute}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        documentId={selectedDocId}
        fileName={selectedDocName}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedDocId(null);
        }}
        lang={lang === "fr" ? "en" : lang}
      />
    </div>
  );
};
