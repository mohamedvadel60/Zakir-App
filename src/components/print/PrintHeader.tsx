import React from "react";
import { PrintSettingsState } from "./printTypes";
import { PrintLogo } from "./PrintLogo";

interface PrintHeaderProps {
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
}

/**
 * Institutional Print Header
 * Strict Source of Truth: Current Active Workspace / Organization Name.
 * Minimalist, compact height, professional typography, zero old fallbacks.
 */
export const PrintHeader: React.FC<PrintHeaderProps> = ({ settings, lang }) => {
  if (!settings.showHeader) return null;

  const isRtl = lang === "ar";

  const getSubtitle = () => {
    if (settings.reportTitle && settings.reportTitle.trim()) return settings.reportTitle;
    if (lang === "ar") return "تقرير الحوكمة والذاكرة المؤسسية الاستراتيجية";
    if (lang === "fr") return "Rapport de Gouvernance & Mémoire Institutionnelle";
    return "Strategic Governance & Institutional Memory Report";
  };

  const getRefLabel = () => {
    if (lang === "ar") return "المرجع:";
    if (lang === "fr") return "Réf :";
    return "Ref:";
  };

  const activeOrgName = (settings.companyName || "").trim();

  return (
    <header
      className="report-header zakir-print-header w-full pb-2 mb-3 bg-white text-slate-900 break-inside-avoid border-b border-slate-200"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      <div className="flex items-center justify-between gap-4 py-0.5">
        {/* Organization Name & Document Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {settings.companyLogoImg ? (
            <PrintLogo companyLogoImg={settings.companyLogoImg} size="sm" lang={lang} />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-slate-900 leading-tight tracking-tight truncate">
              {activeOrgName ? (
                activeOrgName
              ) : (
                <span className="text-slate-400 font-normal italic text-xs">
                  {lang === "ar" ? "جارٍ تحميل بيانات المؤسسة..." : "Loading organization..."}
                </span>
              )}
            </h1>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-tight truncate">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Reference Number & Issuance Date */}
        <div className="shrink-0 text-end flex flex-col items-end justify-center">
          <div className="text-[10px] font-mono text-slate-700 leading-tight">
            <span className="font-semibold text-slate-400">{getRefLabel()}</span>{" "}
            <span className="font-bold text-slate-900">
              {settings.docRefNumber || `ZKR-${new Date().getFullYear()}`}
            </span>
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 leading-tight">
            {new Date().toISOString().split("T")[0]}
          </div>
        </div>
      </div>
    </header>
  );
};

