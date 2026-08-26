import React from "react";
import { PrintSettingsState } from "./printTypes";

interface PrintFooterProps {
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
}

export const PrintFooter: React.FC<PrintFooterProps> = ({ settings, lang }) => {
  if (!settings.showFooter) return null;

  const isRtl = lang === "ar";

  const getConfidentialText = () => {
    if (lang === "ar") return "مستند رسمي محمي - للاستخدام الداخلي والمصرح به فقط | محرك ذاكر للذاكرة المؤسسية";
    if (lang === "fr") return "Document Confidentiel - Utilisation Interne Uniquement | Moteur de Mémoire Zakir";
    return "Confidential Institutional Record - Authorized Internal Use Only | Zakir Knowledge Engine";
  };

  return (
    <footer
      className="zakir-print-footer w-full pt-3 mt-8 border-t border-slate-200 text-slate-500 text-[10px] bg-white break-inside-avoid"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#64748b",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Confidentiality Notice */}
        <div className="font-semibold text-slate-500 tracking-wide">
          {getConfidentialText()}
        </div>

        {/* Dynamic CSS Print Page Counter Target */}
        <div className="font-mono font-bold text-slate-600 print-page-counter">
          {/* Managed via @media print CSS counter(page) */}
          <span className="print-only-inline">
            {lang === "ar" ? "صفحة " : "Page "}
            <span className="page-number-placeholder" />
          </span>
        </div>
      </div>
    </footer>
  );
};
