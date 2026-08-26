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
    if (lang === "ar") return "تقرير الإدارة والحوكمة الاستراتيجية ومخرجات الذاكرة المؤسسية";
    if (lang === "fr") return "Rapport de Gouvernance Stratégique et Mémoire Institutionnelle";
    return "Strategic Governance & Institutional Memory Report";
  };

  const getOfficialBadgeLabel = () => {
    if (lang === "ar") return "وثيقة رسمية معتمدة";
    if (lang === "fr") return "Document Officiel Certifié";
    return "Official Approved Document";
  };

  const getRefLabel = () => {
    if (lang === "ar") return "المرجع:";
    if (lang === "fr") return "Réf :";
    return "Ref:";
  };

  const getDateLabel = () => {
    if (lang === "ar") return "التاريخ:";
    if (lang === "fr") return "Date :";
    return "Date:";
  };

  const formattedDate = new Date().toLocaleDateString(
    lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <header
      className="report-header zakir-print-header w-full pb-3 mb-6 bg-white text-slate-900 break-inside-avoid"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
      }}
    >
      <div className="flex items-start justify-between gap-6">
        {/* Right Side (RTL) / Left Side (LTR): Logo + Organization Name + Subtitle */}
        <div className="header-right flex items-center gap-3.5 min-w-0 flex-1">
          <PrintLogo companyLogoImg={settings.companyLogoImg} size="md" lang={lang} />
          <div className="org-info min-w-0">
            <h2 className="org-name text-base font-black text-slate-900 leading-tight tracking-tight truncate">
              {settings.companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine")}
            </h2>
            <p className="doc-subtitle text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Left Side (RTL) / Right Side (LTR): Ref, Date, Approved Badge */}
        <div className="header-left shrink-0 text-end flex flex-col items-end gap-1">
          <div className="meta-badge inline-flex items-center px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-[#0075DE] text-[10px] font-black rounded-full uppercase tracking-wider">
            {getOfficialBadgeLabel()}
          </div>
          <div className="meta-item text-[11px] font-mono text-slate-700 mt-1">
            <strong className="font-bold text-slate-900">{getRefLabel()}</strong>{" "}
            <span>{settings.docRefNumber || `ZKR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`}</span>
          </div>
          <div className="meta-item text-[10px] text-slate-500 font-medium">
            <strong className="font-bold text-slate-700">{getDateLabel()}</strong>{" "}
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Elegant Separator Line */}
      <div className="h-1 w-full bg-[#0075DE] mt-4 rounded-full" />
    </header>
  );
};
