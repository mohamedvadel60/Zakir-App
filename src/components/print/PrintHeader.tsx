import React from "react";
import { PrintSettingsState } from "./printTypes";
import { PrintLogo } from "./PrintLogo";

interface PrintHeaderProps {
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({ settings, lang }) => {
  if (!settings.showHeader) return null;

  const isRtl = lang === "ar";

  const getSubtitle = () => {
    if (settings.reportTitle) return settings.reportTitle;
    if (lang === "ar") return "تقرير الحوكمة والذاكرة المؤسسية الاستراتيجية";
    if (lang === "fr") return "Rapport de Gouvernance & Mémoire Institutionnelle";
    return "Strategic Governance & Institutional Memory Report";
  };

  const getRefLabel = () => {
    if (lang === "ar") return "المرجع:";
    if (lang === "fr") return "Réf :";
    return "Ref:";
  };

  return (
    <header
      className="report-header zakir-print-header w-full pb-3 mb-4 bg-white text-slate-900 break-inside-avoid border-b border-slate-200"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Organization & Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <PrintLogo companyLogoImg={settings.companyLogoImg} size="sm" lang={lang} />
          <div className="min-w-0">
            <h1 className="text-[14px] font-bold text-slate-900 leading-tight tracking-tight truncate">
              {settings.companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine")}
            </h1>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-snug truncate">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Ref Number & Date */}
        <div className="shrink-0 text-end flex flex-col items-end justify-center">
          <div className="text-[10px] font-mono text-slate-700">
            <span className="font-semibold text-slate-400">{getRefLabel()}</span>{" "}
            <span className="font-bold text-slate-900">{settings.docRefNumber || `ZKR-${new Date().getFullYear()}`}</span>
          </div>
          <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">
            {new Date().toISOString().split("T")[0]}
          </div>
        </div>
      </div>
    </header>
  );
};
