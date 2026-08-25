import React from "react";
import { HeaderStyle } from "./printTypes";
import { PrintLogo } from "./PrintLogo";

interface PrintHeaderProps {
  companyName: string;
  departmentName?: string;
  documentRef: string;
  displayDate: string;
  lang: "en" | "ar" | "fr";
  headerStyle?: HeaderStyle;
  logoSize?: "small" | "medium" | "large";
  companyLogoImg?: string | null;
  pageNumberText?: string; // Optional page number text for preview e.g. "Page 1 of 5"
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
  companyName,
  departmentName,
  documentRef,
  displayDate,
  lang,
  headerStyle = "standard",
  logoSize = "medium",
  companyLogoImg,
  pageNumberText,
}) => {
  const isRtl = lang === "ar";
  const dateVal = displayDate || new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US");

  const reportTitle = lang === "ar" 
    ? "تقرير الذاكرة المؤسسية وسجل القرارات" 
    : lang === "fr" 
    ? "Rapport d'Intelligence et de Mémoire Décisionnelle" 
    : "Institutional Memory & Decision Intelligence Report";

  const subTitleText = lang === "ar" 
    ? "وثيقة رسمية معتمدة" 
    : lang === "fr" 
    ? "Document Officiel Approuvé" 
    : "Official Audited Document";

  if (headerStyle === "centered") {
    return (
      <header className="zakir-heading-group w-full bg-white border-b-2 border-slate-300 pb-4 mb-5 text-center select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center justify-center gap-2 mb-3">
          <PrintLogo companyLogoImg={companyLogoImg} logoSize={logoSize} lang={lang} />
          <div className="text-center">
            <span className="font-extrabold text-sm text-slate-950 block tracking-tight">{companyName}</span>
            {departmentName && (
              <span className="text-[8.5pt] text-slate-600 font-semibold block mt-0.5">{departmentName}</span>
            )}
          </div>
        </div>

        <h1 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight">
          {reportTitle}
        </h1>

        <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[8.5pt] text-slate-600 font-mono px-1">
          <div className="flex items-center gap-4">
            <span><strong>{lang === "ar" ? "المرجع:" : "REF:"}</strong> {documentRef}</span>
            <span><strong>{lang === "ar" ? "التاريخ:" : "DATE:"}</strong> {dateVal}</span>
          </div>
          <div className="font-bold text-slate-700">
            {pageNumberText ? (
              <span>{pageNumberText}</span>
            ) : (
              <span className="zakir-page-counter-label zakir-page-number-target"></span>
            )}
          </div>
        </div>
      </header>
    );
  }

  if (headerStyle === "letterhead") {
    return (
      <header className="zakir-heading-group w-full bg-white border-b-4 border-slate-900 pb-3 mb-5 select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-4 pb-2">
          <div>
            <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">{companyName}</h2>
            {departmentName && <p className="text-[8.5pt] text-slate-600 font-semibold mt-0.5">{departmentName}</p>}
          </div>
          <PrintLogo companyLogoImg={companyLogoImg} logoSize={logoSize} lang={lang} />
        </div>
        <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[8.5pt] text-slate-700 font-mono">
          <span>{documentRef}</span>
          <span>{dateVal}</span>
          <span className="font-bold">
            {pageNumberText ? (
              <span>{pageNumberText}</span>
            ) : (
              <span className="zakir-page-counter-label zakir-page-number-target"></span>
            )}
          </span>
        </div>
      </header>
    );
  }

  // Standard Header (Default)
  return (
    <header className="zakir-heading-group w-full bg-white pb-3 mb-5 select-none" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-3">
          <PrintLogo companyLogoImg={companyLogoImg} logoSize={logoSize} lang={lang} />
          <div className="leading-tight">
            <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">{companyName}</span>
            {departmentName && (
              <span className="text-[8.5pt] text-slate-600 font-medium block mt-0.5">{departmentName}</span>
            )}
          </div>
        </div>

        <div className="text-end">
          <h1 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight flex items-center justify-end gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
            {reportTitle}
          </h1>
          <p className="text-[7.5pt] text-slate-500 font-medium mt-0.5">
            {subTitleText}
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8.5pt] text-slate-600 font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "المرجع:" : "REF:"}</span>
          <span className="font-bold text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-300 shadow-2xs border-s-2 border-s-blue-600">{documentRef}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "التاريخ:" : "DATE:"}</span>
            <span className="font-semibold text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-300 shadow-2xs">{dateVal}</span>
          </div>
          <div className="font-bold text-slate-700">
            {pageNumberText ? (
              <span>{pageNumberText}</span>
            ) : (
              <span className="zakir-page-counter-label zakir-page-number-target"></span>
            )}
          </div>
        </div>
      </div>
      <div className="w-full h-[2px] bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 mt-2.5 rounded-full"></div>
    </header>
  );
};
