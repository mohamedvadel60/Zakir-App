import React, { useState } from "react";
import { 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  Eye, 
  User, 
  RefreshCw,
  Download
} from "lucide-react";
import { RecoveryRequestRecord } from "../adminTypes.js";
import { safeFormatDate } from "../../../lib/dateUtils.js";
import { DocumentPreviewModal } from "../../DocumentPreviewModal.js";
import { downloadUserFile } from "../../../lib/fileViewerUtils.js";

interface AdminRecoveryTabProps {
  recoveryRequests: RecoveryRequestRecord[];
  onDecision: (requestId: string, email: string, action: "approve" | "reject", reason?: string) => Promise<void>;
  loading: boolean;
  lang: "ar" | "fr" | "en";
  theme: "dark" | "light";
}

export const AdminRecoveryTab: React.FC<AdminRecoveryTabProps> = ({
  recoveryRequests,
  onDecision,
  loading,
  lang,
  theme
}) => {
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Dialog State
  const [activeRequest, setActiveRequest] = useState<RecoveryRequestRecord | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [processing, setProcessing] = useState(false);

  const t = {
    title: isAr ? "استعادة الحسابات المحذوفة والمعلقة" : isFr ? "Récupération des Comptes" : "Account Recovery Requests",
    subtitle: isAr ? "مراجعة وفحص طلبات استعادة الحسابات وإعادة تفعيلها وفق معايير الأمان" : isFr ? "Examen des demandes de restauration de compte supprimé" : "Review deleted/suspended account restoration inquiries",
    pending: isAr ? "قيد المراجعة" : isFr ? "En attente" : "Pending",
    approved: isAr ? "تمت الموافقة" : isFr ? "Approuvé" : "Approved",
    rejected: isAr ? "مرفوض" : isFr ? "Rejeté" : "Rejected",
    applicantEmail: isAr ? "البريد الإلكتروني" : isFr ? "Email du compte" : "Account Email",
    requestDate: isAr ? "تاريخ الطلب" : isFr ? "Date de demande" : "Request Date",
    reason: isAr ? "سبب طلب الاستعادة" : isFr ? "Motif" : "Reason",
    idDoc: isAr ? "إثبات الهوية" : isFr ? "Pièce d'identité" : "Identity Document",
    noRequests: isAr ? "لا توجد طلبات استعادة حسابات حاليًا." : isFr ? "Aucune demande de récupération." : "No account recovery requests found.",
    approveBtn: isAr ? "الموافقة وإعادة التفعيل" : isFr ? "Approuver et restaurer" : "Approve & Restore",
    rejectBtn: isAr ? "رفض الطلب" : isFr ? "Rejeter" : "Reject",
    previewDoc: isAr ? "معاينة الوثيقة" : isFr ? "Aperçu" : "Preview Document",
    confirmApproveTitle: isAr ? "الموافقة على استعادة الحساب" : isFr ? "Confirmer la restauration" : "Confirm Account Restoration",
    confirmRejectTitle: isAr ? "رفض طلب الاستعادة" : isFr ? "Rejeter la demande" : "Reject Recovery Request",
    cancel: isAr ? "إلغاء" : isFr ? "Annuler" : "Cancel",
    confirm: isAr ? "تأكيد" : isFr ? "Confirmer" : "Confirm"
  };

  const handleExecute = async () => {
    if (!activeRequest || !actionType) return;
    setProcessing(true);
    try {
      await onDecision(
        activeRequest.id || activeRequest.requestId || "",
        activeRequest.email,
        actionType,
        reasonInput
      );
      setActiveRequest(null);
      setActionType(null);
      setReasonInput("");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t.subtitle}
        </p>
      </div>

      <div className="space-y-3">
        {recoveryRequests.map((req) => {
          const isPending = req.status === "pending";
          const hasDoc = Boolean(req.documentId || req.identityDocument);

          return (
            <div
              key={req.id || req.requestId}
              className={`p-4 md:p-5 rounded-xl border transition-all ${
                theme === "dark" ? "bg-[#090D16]/90 border-slate-800/80" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    <RotateCcw className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {req.email}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          req.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : req.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {req.status === "approved" ? t.approved : req.status === "rejected" ? t.rejected : t.pending}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t.requestDate}: {safeFormatDate(req.createdAt || req.requestedAt, isAr ? "ar" : "en")}
                    </div>

                    {req.reason && (
                      <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{t.reason}: </span>
                        <span className="text-slate-600 dark:text-slate-400">{req.reason}</span>
                      </div>
                    )}

                    {hasDoc && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedDocId(req.documentId || req.identityDocument?.id || "doc");
                            setSelectedDocName(req.documentName || "Identity Document");
                            setIsPreviewOpen(true);
                          }}
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{t.previewDoc}</span>
                          <Eye className="w-3 h-3 ms-1" />
                        </button>
                        <button
                          onClick={() => {
                            downloadUserFile({
                              documentId: req.documentId || req.identityDocument?.id || "doc",
                              fileName: req.documentName || "Identity_Document.pdf",
                              mimeType: "application/pdf"
                            });
                          }}
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title={isAr ? "تنزيل الوثيقة" : "Download Document"}
                        >
                          <Download className="w-3 h-3" />
                          <span>{isAr ? "تنزيل" : "Download"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => {
                        setActiveRequest(req);
                        setActionType("approve");
                      }}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{t.approveBtn}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveRequest(req);
                        setActionType("reject");
                      }}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t.rejectBtn}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {recoveryRequests.length === 0 && (
          <div 
            className={`p-12 text-center rounded-xl border flex flex-col items-center justify-center gap-2 ${
              theme === "dark" ? "bg-[#090D16]/90 border-slate-800/80" : "bg-white border-slate-200"
            }`}
          >
            <CheckCircle className="w-10 h-10 text-emerald-500" />
            <div className="text-sm font-semibold">{t.noRequests}</div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {activeRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div 
            className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl transition-all ${
              theme === "dark" ? "bg-[#0B0F19] border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold">
              {actionType === "approve" ? t.confirmApproveTitle : t.confirmRejectTitle}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {activeRequest.email}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {isAr ? "ملاحظات القرار الإداري" : "Admin Notes"}
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder={isAr ? "ملاحظات إضافية للمستخدم..." : "Notes..."}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border bg-transparent outline-hidden"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setActiveRequest(null);
                  setActionType(null);
                }}
                disabled={processing}
                type="button"
                className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleExecute}
                disabled={processing}
                type="button"
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
                  actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {processing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.confirm}</span>
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
