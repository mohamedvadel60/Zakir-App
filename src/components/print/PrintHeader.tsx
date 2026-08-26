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

  const getReportTypeLabel = () => {
    if (lang === "ar") return "تقرير مخرجات ومعارف الذاكرة المؤسسية";
    if (lang === "fr") return "Rapport Officiel de Mémoire Institutionnelle";
    return "Institutional Knowledge & Memory Report";
  };

  const getOfficialBadgeLabel = () => {
    if (lang === "ar") return "وثيقة رسمية معتمدة";
    if (lang === "fr") return "Document Officiel";
    return "Official Certified Document";
  };

  return (
    <header
      className="zakir-print-header w-full pb-4 mb-6 border-b-2 border-slate-200 text-slate-900 bg-white break-inside-avoid"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left / Right Logo & Entity Info */}
        <div className="flex items-center gap-3">
          <PrintLogo companyLogoImg={settings.companyLogoImg} size="md" lang={lang} />
          <div>
            <h1 className="text-base font-black text-slate-900 leading-tight">
              {settings.companyName || (lang === "ar" ? "ذاكر للهندسة والمعرفة المؤسسية" : "Zakir Knowledge Engine")}
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {settings.departmentName || (lang === "ar" ? "إدارة الحوكمة والمخاطر والقرارات الاستراتيجية" : "Governance, Risk & Strategy Division")}
            </p>
          </div>
        </div>

        {/* Reference & Document Metadata Badge */}
        <div className="text-end shrink-0">
          <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 text-[10px] font-extrabold text-slate-700 rounded uppercase tracking-wider mb-1">
            {getOfficialBadgeLabel()}
          </span>
          <div className="text-[11px] font-mono text-slate-600 font-bold">
            Ref: {settings.docRefNumber || `ZKR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
            {new Date().toLocaleDateString(lang === "ar" ? "ar-SA" : lang === "fr" ? "fr-FR" : "en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Primary Report Title Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-[#0075DE] tracking-tight">
          {settings.reportTitle || getReportTypeLabel()}
        </h2>
        {settings.authorName && (
          <span className="text-[11px] font-medium text-slate-500">
            {lang === "ar" ? "المعد بواسطة:" : lang === "fr" ? "Rédigé par :" : "Prepared by:"}{" "}
            <strong className="text-slate-800">{settings.authorName}</strong>
          </span>
        )}
      </div>

      {/* Decorative Accent Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-[#0075DE] via-[#0db4d7] to-[#f3ba1a] mt-2 rounded-full" />
    </header>
  );
};
