import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, RefreshCw, AlertCircle, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { fetchFileAsBlob, downloadUserFile, detectMimeType } from "../lib/fileViewerUtils.js";

interface DocumentPreviewModalProps {
  documentId: string | null;
  fileName?: string;
  category?: string;
  fileUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  lang?: "ar" | "en" | "fr";
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  documentId,
  fileName = "document",
  category,
  fileUrl,
  isOpen,
  onClose,
  lang = "ar",
}) => {
  const isAr = lang === "ar";
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [textContent, setTextContent] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (!documentId && !fileUrl)) {
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setTextContent(null);
      setError(null);
      setZoom(1);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setTextContent(null);
    setZoom(1);

    const target = (documentId || fileUrl || "").trim();

    fetchFileAsBlob({ documentId: target, fileUrl: target, fileName })
      .then(async ({ blob, mime }) => {
        if (!isMounted) return;
        const detectedMime = mime || detectMimeType(fileName, blob.type);
        setMimeType(detectedMime.toLowerCase());

        // If plain text / csv / json, extract text content for embedded rendering
        if (
          detectedMime.includes("text/") ||
          detectedMime.includes("json") ||
          detectedMime.includes("csv")
        ) {
          try {
            const text = await blob.text();
            if (isMounted) setTextContent(text);
          } catch (e) {}
        }

        const objectUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setBlobUrl(objectUrl);
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Document preview loading error:", err);
        setError(
          err.message ||
            (isAr
              ? "تعذر تحميل المستند. يرجى التحقق من صلاحيات الوصول."
              : "Failed to load document. Please verify access permissions.")
        );
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
  }, [isOpen, documentId, fileUrl]);

  if (!isOpen) return null;

  const isPdf = mimeType.includes("pdf");
  const isImage =
    mimeType.includes("image") ||
    mimeType.includes("png") ||
    mimeType.includes("jpeg") ||
    mimeType.includes("jpg") ||
    mimeType.includes("webp") ||
    mimeType.includes("gif") ||
    mimeType.includes("svg");
  const isText = Boolean(textContent !== null);

  const handleDownload = () => {
    downloadUserFile({
      fileName,
      documentId: documentId || undefined,
      fileUrl: blobUrl || fileUrl || undefined,
      mimeType
    });
  };

  const handleOpenInTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    }
  };

  return (
    <AnimatePresence>
      <div key="doc-preview-backdrop" className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
        <motion.div
          key="doc-preview-modal-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
          dir={isAr ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/95">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-white truncate">
                  {fileName}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {category && (
                    <span>
                      {category === "company" || category === "Company"
                        ? isAr ? "مستند المنشأة" : "Company Document"
                        : category === "Verification"
                        ? isAr ? "وثيقة توثيق رسمية" : "Official Verification Document"
                        : category}
                    </span>
                  )}
                  {mimeType && (
                    <>
                      <span>•</span>
                      <span className="uppercase text-[10px] text-slate-500">{mimeType.split("/").pop()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isImage && blobUrl && !loading && !error && (
                <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                    className="p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-slate-700 transition-colors"
                    title={isAr ? "تكبير" : "Zoom In"}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
                    className="p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-slate-700 transition-colors"
                    title={isAr ? "تصغير" : "Zoom Out"}
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="p-1.5 text-slate-300 hover:text-white rounded-md hover:bg-slate-700 transition-colors"
                    title={isAr ? "إعادة ضبط الحجم" : "Reset Zoom"}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {blobUrl && (
                <button
                  onClick={handleOpenInTab}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={isAr ? "فتح في نافذة جديدة" : "Open in new tab"}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              {blobUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isAr ? "تنزيل الملف" : "Download"}</span>
                </button>
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
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] bg-slate-950/70">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm font-medium">
                  {isAr ? "جاري تحميل المستند بأمان..." : "Loading authenticated document..."}
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
                    src={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                    title={fileName}
                    className="w-full h-[72vh] rounded-xl border border-slate-800 bg-white"
                  />
                ) : isImage ? (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                    <img
                      src={blobUrl}
                      alt={fileName}
                      style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
                      className="max-w-full max-h-[72vh] object-contain rounded-xl border border-slate-800 shadow-xl select-none"
                    />
                  </div>
                ) : isText ? (
                  <div className="w-full h-[72vh] overflow-auto p-4 rounded-xl border border-slate-800 bg-slate-900 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                    {textContent}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-base">{fileName}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {isAr
                          ? "المعاينة المباشرة غير مدعومة لهذا النوع من الملفات داخل المتصفح. يمكنك تنزيل الملف لفتحه."
                          : "Direct inline preview is not supported for this file type. Please download the file to view it."}
                      </p>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isAr ? "تنزيل الملف الأصلي" : "Download Original File"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
