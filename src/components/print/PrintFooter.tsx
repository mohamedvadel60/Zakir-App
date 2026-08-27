import React from "react";
import { PrintSettingsState } from "./printTypes";

interface PrintFooterProps {
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  pageNumber?: number;
  totalPages?: number;
}

export const PrintFooter: React.FC<PrintFooterProps> = ({
  settings,
  lang,
  pageNumber = 1,
  totalPages = 1,
}) => {
  if (!settings.showFooter) return null;

  const isRtl = lang === "ar";

  const getConfidentialText = () => {
    if (lang === "ar") return "مستند رسمي محمي - للاستخدام الداخلي والمصرح به فقط | محرك Zakir للذاكرة المؤسسية";
    if (lang === "fr") return "Document Confidentiel - Utilisation Interne Uniquement | Moteur de Mémoire Zakir";
    return "Confidential Institutional Record - Authorized Internal Use Only | Zakir Knowledge Engine";
  };

  const getPageCounterText = () => {
    if (lang === "ar") {
      return `صفحة ${pageNumber} من ${totalPages}`;
    }
    if (lang === "fr") {
      return `Page ${pageNumber} sur ${totalPages}`;
    }
    return `Page ${pageNumber} of ${totalPages}`;
  };

  return (
    <footer
      className="zakir-print-footer w-full pt-2 border-t border-slate-300 text-slate-600 text-[10px] bg-white break-inside-avoid"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#475569",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Confidentiality Notice */}
        <div className="font-semibold text-slate-500 tracking-wide truncate max-w-[70%]">
          {getConfidentialText()}
        </div>

        {/* Dynamic High-Contrast Page Counter */}
        <div className="font-mono font-bold text-slate-800 text-[10px] shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-bold shadow-xs">
            {getPageCounterText()}
          </span>
        </div>
      </div>
    </footer>
  );
};

