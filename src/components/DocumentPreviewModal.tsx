import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, RefreshCw, AlertCircle } from "lucide-react";
import { authenticatedFetch } from "../lib/apiUtils.js";
import { dataUrlToBlob } from "../lib/fileViewerUtils.js";

interface DocumentPreviewModalProps {
  documentId: string | null;
  fileName?: string;
  category?: string;
  isOpen: boolean;
  onClose: () => void;
  lang?: "ar" | "en";
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  documentId,
  fileName = "document",
  category,
  isOpen,
  onClose,
  lang = "ar",
}) => {
  const isAr = lang === "ar";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) {
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const target = documentId.trim();

    // 1. Data URL / Base64
    if (target.startsWith("data:")) {
      const { blob, mime } = dataUrlToBlob(target);
      if (blob.size > 0) {
        const objectUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setMimeType(mime.toLowerCase());
          setBlobUrl(objectUrl);
          setLoading(false);
        }
      } else {
        if (isMounted) {
          setError(isAr ? "تعذر قراءة بيانات الملف." : "Invalid document data.");
          setLoading(false);
        }
      }
      return;
    }

    // 2. Blob URL
    if (target.startsWith("blob:")) {
      setBlobUrl(target);
      const ext = fileName.split(".").pop()?.toLowerCase();
      if (ext === "pdf") setMimeType("application/pdf");
      else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) setMimeType(`image/${ext === "jpg" ? "jpeg" : ext}`);
      setLoading(false);
      return;
    }

    // 3. External HTTP/HTTPS Direct URL (e.g. Firebase Storage)
    if (target.startsWith("http://") || target.startsWith("https://")) {
      fetch(target)
        .then(async (res) => {
          if (!isMounted) return;
          if (!res.ok) throw new Error("HTTP error " + res.status);
          const detectedMime = res.headers.get("content-type") || "application/pdf";
          setMimeType(detectedMime.toLowerCase());
          const blob = await res.blob();
          if (!isMounted) return;
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.warn("Direct fetch error for preview, attempting API proxy:", err);
          // Fallback if target contains fileId or can be proxied
          const fileId = target.split("/").pop()?.split("?")[0] || target;
          authenticatedFetch(`/api/auth/verification-document/${encodeURIComponent(fileId)}`)
            .then(async (res) => {
              if (!isMounted) return;
              if (!res.ok) throw new Error("Proxy error " + res.status);
              const detectedMime = res.headers.get("content-type") || "application/pdf";
              setMimeType(detectedMime.toLowerCase());
              const blob = await res.blob();
              if (!isMounted) return;
              const objectUrl = URL.createObjectURL(blob);
              setBlobUrl(objectUrl);
            })
            .catch((proxyErr) => {
              if (!isMounted) return;
              setError(isAr ? "تعذر معاينة الملف الحسابي." : "Error loading document.");
            })
            .finally(() => {
              if (isMounted) setLoading(false);
            });
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
      return;
    }

    // 4. Document ID -> Call authenticated backend endpoint
    authenticatedFetch(`/api/auth/verification-document/${encodeURIComponent(target)}`)
      .then(async (res) => {
        if (!isMounted) return;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.userFriendlyMessage ||
              errData.error ||
              errData.message ||
              (isAr
                ? "تعذر تحميل المستند. يرجى التحقق من صلاحيات الحساب."
                : "Failed to load document. Please check permissions.")
          );
        }
        const detectedMime = res.headers.get("content-type") || "application/pdf";
        setMimeType(detectedMime.toLowerCase());

        const blob = await res.blob();
        if (!isMounted) return;
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Document preview error:", err);
        setError(err.message || (isAr ? "حدث خطأ أثناء تحميل الوثيقة." : "Error loading document."));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const isPdf = mimeType.includes("pdf");
  const isImage =
    mimeType.includes("image") ||
    mimeType.includes("png") ||
    mimeType.includes("jpeg") ||
    mimeType.includes("jpg") ||
    mimeType.includes("webp") ||
    mimeType.includes("gif");

  return (
    <AnimatePresence>
      <div key="doc-preview-backdrop" className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
        <motion.div
          key="doc-preview-modal-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                  {fileName}
                </h3>
                {category && (
                  <p className="text-xs text-slate-400">
                    {category === "company"
                      ? isAr ? "مستند المنشأة" : "Company Document"
                      : isAr ? "مستند شخصي" : "Personal Document"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {blobUrl && (
                <a
                  href={blobUrl}
                  download={fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isAr ? "تحميل" : "Download"}</span>
                </a>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={isAr ? "إغلاق" : "Close"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px] bg-slate-950/60">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium">
                  {isAr ? "جاري جلب المستند الآمن والمصادقة..." : "Loading authenticated document..."}
                </span>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center gap-3 max-w-md text-center py-10 px-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-rose-300">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                  }}
                  className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                >
                  {isAr ? "إعادة المحاولة" : "Try Again"}
                </button>
              </div>
            )}

            {!loading && !error && blobUrl && (
              <div className="w-full h-full flex items-center justify-center overflow-auto">
                {isPdf ? (
                  <iframe
                    src={blobUrl}
                    title={fileName}
                    className="w-full h-[68vh] rounded-xl border border-slate-800 bg-white"
                  />
                ) : isImage ? (
                  <img
                    src={blobUrl}
                    alt={fileName}
                    className="max-w-full max-h-[72vh] object-contain rounded-xl border border-slate-800 shadow-lg"
                  />
                ) : (
                  <iframe
                    src={blobUrl}
                    title={fileName}
                    className="w-full h-[68vh] rounded-xl border border-slate-800"
                  />
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
