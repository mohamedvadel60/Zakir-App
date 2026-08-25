import React from "react";
import { ShieldCheck } from "lucide-react";
import { Memory } from "../types";
import { ZakirLogo } from "./ZakirLogo";

export interface PrintableDocumentProps {
  memories: Memory[];
  lang: "en" | "ar" | "fr";
  companyName: string;
  departmentName?: string;
  documentRef: string;
  userName?: string;
  displayDate: string;
  
  // Customization props
  density?: "compact" | "standard" | "spacious";
  columns?: "1" | "2";
  fontSize?: "small" | "medium" | "large";
  pageSize?: "A4" | "A3" | "A5" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  lineSpacing?: number;
  pageMargins?: number;
  customFontScale?: number;
  documentTheme?: "blue" | "slate" | "emerald" | "rose";
  
  // Section visibility toggles
  includeHeader?: boolean;
  includeFooter?: boolean;
  includeCausal?: boolean;
  includeOutcomes?: boolean;
  includeLessons?: boolean;
  includeAuthor?: boolean;
  includeTags?: boolean;
  includeSignatureBlock?: boolean;
  includeVerificationSeal?: boolean;
  
  // Branding & Watermark
  headerStyle?: "standard" | "centered" | "letterhead";
  logoSize?: "small" | "medium" | "large";
  companyLogoImg?: string | null;
  signatureImg?: string | null;
  watermarkText?: string;
  includeCompanyInWatermark?: boolean;
  includeDateInWatermark?: boolean;
  
  // Live editing handlers
  isPrinting?: boolean;
  onUpdateMemoryField?: (id: string, field: keyof Memory, value: any) => void;
  onExcludeMemory?: (id: string) => void;
}

export const PrintableDocument: React.FC<PrintableDocumentProps> = ({
  memories,
  lang,
  companyName,
  departmentName,
  documentRef,
  userName,
  displayDate,
  
  density = "standard",
  columns = "1",
  pageSize = "A4",
  orientation = "portrait",
  lineSpacing = 1.2,
  pageMargins = 15,
  customFontScale = 100,
  documentTheme = "blue",
  
  includeHeader = true,
  includeFooter = true,
  includeCausal = true,
  includeOutcomes = true,
  includeLessons = true,
  includeAuthor = true,
  includeTags = true,
  includeSignatureBlock = false,
  includeVerificationSeal = true,
  
  headerStyle = "standard",
  logoSize = "medium",
  companyLogoImg,
  signatureImg,
  watermarkText,
  includeCompanyInWatermark = true,
  includeDateInWatermark = true,
  
  isPrinting = false,
  onUpdateMemoryField,
  onExcludeMemory,
}) => {
  const isRtl = lang === "ar";
  const dateVal = displayDate || new Date().toLocaleDateString(isRtl ? "ar-SA" : "en-US");

  // Dynamic Theme Colors
  const themeColors = {
    blue: {
      accent: "#0075DE",
      badge: "bg-blue-50 text-blue-900 border-blue-200",
      lessonsBg: "bg-blue-50/70 border-blue-200",
      lessonsHeader: "text-blue-900",
      marker: "bg-blue-600",
      highlightText: "text-blue-900",
      borderAccent: "border-blue-500",
    },
    slate: {
      accent: "#334155",
      badge: "bg-slate-100 text-slate-900 border-slate-300",
      lessonsBg: "bg-slate-100/80 border-slate-300",
      lessonsHeader: "text-slate-900",
      marker: "bg-slate-700",
      highlightText: "text-slate-900",
      borderAccent: "border-slate-700",
    },
    emerald: {
      accent: "#059669",
      badge: "bg-emerald-50 text-emerald-900 border-emerald-200",
      lessonsBg: "bg-emerald-50/70 border-emerald-200",
      lessonsHeader: "text-emerald-900",
      marker: "bg-emerald-600",
      highlightText: "text-emerald-900",
      borderAccent: "border-emerald-500",
    },
    rose: {
      accent: "#e11d48",
      badge: "bg-rose-50 text-rose-900 border-rose-200",
      lessonsBg: "bg-rose-50/70 border-rose-200",
      lessonsHeader: "text-rose-900",
      marker: "bg-rose-600",
      highlightText: "text-rose-900",
      borderAccent: "border-rose-500",
    }
  }[documentTheme];

  // Spacing & Typography Styles based on density
  const densityStyles = {
    compact: {
      cardPadding: "p-3.5 sm:p-4",
      cardMargin: "mb-3",
      sectionGap: "space-y-2",
      headerPadding: "pb-2 mb-2",
      titleSize: "text-sm font-black text-slate-950",
      sectionTitleSize: "text-[8.5pt] font-black uppercase tracking-wider",
      textSize: "text-xs text-slate-900 leading-normal",
      badgeText: "text-[7.5pt] font-black px-2 py-0.5 rounded border"
    },
    standard: {
      cardPadding: "p-5 sm:p-6",
      cardMargin: "mb-4",
      sectionGap: "space-y-3",
      headerPadding: "pb-2.5 mb-3",
      titleSize: "text-base font-black text-slate-950",
      sectionTitleSize: "text-[9pt] font-black uppercase tracking-wider",
      textSize: "text-sm text-slate-900 leading-relaxed",
      badgeText: "text-[8pt] font-black px-2.5 py-0.5 rounded border"
    },
    spacious: {
      cardPadding: "p-6 sm:p-8",
      cardMargin: "mb-6",
      sectionGap: "space-y-4",
      headerPadding: "pb-3.5 mb-4",
      titleSize: "text-lg font-black text-slate-950",
      sectionTitleSize: "text-[10pt] font-black uppercase tracking-wider",
      textSize: "text-base text-slate-900 leading-relaxed",
      badgeText: "text-[8.5pt] font-black px-3 py-1 rounded border"
    }
  }[density];

  const logoHeightPx = logoSize === "small" ? 32 : logoSize === "large" ? 56 : 44;

  // Render Header Component
  const renderHeader = () => {
    if (!includeHeader) return null;

    if (headerStyle === "centered") {
      return (
        <header className="print-header-container w-full border-b-2 border-slate-300 pb-4 mb-6 select-none text-center" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex flex-col items-center justify-center gap-2 mb-3">
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo max-h-12 object-contain" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <ZakirLogo theme="light" size="md" lang={lang} />
            )}
            <div className="text-center">
              <span className="font-extrabold text-sm text-slate-900 block">{companyName}</span>
              {departmentName && (
                <span className="text-[8pt] text-slate-600 font-semibold block">{departmentName}</span>
              )}
            </div>
          </div>

          <h1 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight">
            {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
          </h1>

          <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-center gap-6 text-[8pt] text-slate-600 font-mono">
            <span><strong>{lang === "ar" ? "المرجع:" : "REF:"}</strong> {documentRef}</span>
            <span><strong>{lang === "ar" ? "التاريخ:" : "DATE:"}</strong> {dateVal}</span>
            {userName && <span><strong>{lang === "ar" ? "المسؤول:" : "BY:"}</strong> {userName}</span>}
          </div>
        </header>
      );
    }

    if (headerStyle === "letterhead") {
      return (
        <header className="print-header-container w-full border-b-4 border-slate-900 pb-3 mb-6 select-none" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">{companyName}</h2>
              {departmentName && <p className="text-[8pt] text-slate-600 font-semibold">{departmentName}</p>}
            </div>
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo max-h-12 object-contain" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <ZakirLogo theme="light" size="sm" lang={lang} />
            )}
          </div>
          <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[8pt] text-slate-700 font-mono">
            <span>{documentRef}</span>
            <span className="font-bold text-slate-950 uppercase">{lang === "ar" ? "سجل توثيق رسمي" : "OFFICIAL RECORD"}</span>
            <span>{dateVal}</span>
          </div>
        </header>
      );
    }

    // Standard Header (Default)
    return (
      <header className="print-header-container w-full border-b-2 border-slate-300 pb-3 mb-5 select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-4 pb-2.5">
          <div className="flex items-center gap-3">
            {companyLogoImg ? (
              <img 
                src={companyLogoImg} 
                alt="Company Logo" 
                className="print-logo object-contain rounded" 
                style={{ maxHeight: `${logoHeightPx}px` }}
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="flex items-center gap-2">
                <ZakirLogo theme="light" size={logoSize === "small" ? "sm" : logoSize === "large" ? "lg" : "md"} lang={lang} />
              </div>
            )}
            <div className="leading-tight">
              <span className="font-extrabold text-xs sm:text-sm text-slate-950 block">{companyName}</span>
              {departmentName && (
                <span className="text-[8pt] text-slate-600 font-medium block">{departmentName}</span>
              )}
            </div>
          </div>

          <div className="text-end">
            <h1 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight">
              {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
            </h1>
            <p className="text-[7.5pt] text-slate-500 font-medium mt-0.5">
              {lang === "ar" ? "وثيقة رسمية معتمدة" : "Official Audited Intelligence Document"}
            </p>
          </div>
        </div>

        {/* Bottom meta row */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8pt] text-slate-600 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "رقم المرجع:" : "DOC ID:"}</span>
            <span className="font-bold text-slate-900">{documentRef}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "التاريخ:" : "DATE:"}</span>
              <span className="font-semibold text-slate-900">{dateVal}</span>
            </div>
            {userName && (
              <div className="flex items-center gap-1">
                <span className="font-bold uppercase text-slate-500">{lang === "ar" ? "المسؤول:" : "LOGGED BY:"}</span>
                <span className="font-semibold text-slate-900 font-sans">{userName}</span>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  };

  // Render Signature Block
  const renderSignatureBlock = () => {
    if (!includeSignatureBlock) return null;

    return (
      <div className="signature-block mt-8 pt-5 border-t-2 border-slate-300 relative z-10 text-right rtl:text-right print-page-break-avoid" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${themeColors.marker}`}></div>
            <span className="text-[9pt] font-black uppercase text-slate-900 tracking-wider">
              {lang === "ar" ? "اعتماد وتوقيع التقرير الرسمي" : "OFFICIAL APPROVAL & SIGNATURE PANEL"}
            </span>
          </div>
          {includeVerificationSeal && (
            <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[8pt] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "معتمد وموثق رقمياً" : "Digitally Verified & Sealed"}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6 w-full text-[9pt]">
          {/* Column 1: Executive Information */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "الجهة المصدرة" : "ISSUING ENTITY"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto">
              <div className="text-[9pt] font-black text-slate-950 leading-tight">
                {companyName}
              </div>
              {departmentName && (
                <div className="text-[8pt] text-slate-600 font-bold uppercase mt-0.5">
                  {departmentName}
                </div>
              )}
              <div className="text-[8pt] text-slate-600 font-semibold mt-1">
                <span>{lang === "ar" ? "الممثل: " : "Representative: "}</span>
                <span className="text-slate-900 font-bold">{userName}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Signature */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "التوقيع والختم المعتمد" : "AUTHORIZED SIGNATURE"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[45px]">
              <div className="flex justify-center items-end pb-1 h-10 w-full">
                {signatureImg ? (
                  <img 
                    src={signatureImg} 
                    alt="Signature" 
                    className="h-10 object-contain block" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[8.5pt] text-slate-400 font-bold italic">
                    {lang === "ar" ? "توقيع معتمد" : "Authorized"}
                  </span>
                )}
              </div>
              <div className="border-b border-slate-300 w-full"></div>
            </div>
          </div>

          {/* Column 3: Approval Date */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "تاريخ الاعتماد" : "APPROVAL DATE"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[45px]">
              <div className="flex justify-center items-end pb-1 h-10 w-full">
                <span className="text-[9.5pt] font-black text-slate-950 font-mono leading-none">
                  {dateVal}
                </span>
              </div>
              <div className="border-b border-slate-300 w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Document Footer
  const renderFooter = () => {
    if (!includeFooter) return null;

    return (
      <footer className="print-document-footer mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[8pt] text-slate-600 font-mono relative z-10 print-page-break-avoid" dir={isRtl ? "rtl" : "ltr"}>
        <span>{companyName}</span>
        <span className="text-center font-bold text-slate-500">
          {lang === "ar" ? "سجل ذاكرة مؤسسية رسمي — سري ومحمي" : "Strictly Confidential Institutional Memory Record"}
        </span>
        <span>{documentRef}</span>
      </footer>
    );
  };

  return (
    <article
      className={`print-document bg-white text-slate-900 relative ${isPrinting ? "border-none shadow-none rounded-none block w-full" : "shadow-2xl border border-slate-300 rounded-sm flex flex-col justify-start"}`}
      style={{
        padding: `${pageMargins}mm`,
        boxSizing: "border-box",
        lineHeight: lineSpacing,
        fontSize: `${customFontScale}%`,
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Optional Confidentiality Watermark */}
      {watermarkText && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
          <div className="text-slate-300/35 font-black tracking-widest uppercase -rotate-45 text-center px-6 border-8 border-slate-300/25 rounded-3xl py-8 flex flex-col items-center gap-2 max-w-[85%]">
            <span className="text-4xl sm:text-5xl md:text-6xl font-black leading-none">
              {watermarkText}
            </span>
            {(includeCompanyInWatermark || includeDateInWatermark) && (
              <div className="text-[11px] sm:text-xs font-bold flex flex-col items-center gap-0.5 pt-1.5 border-t border-slate-300/30 w-full mt-1.5 opacity-85 font-sans">
                {includeCompanyInWatermark && (
                  <span>{companyName}</span>
                )}
                {includeDateInWatermark && displayDate && (
                  <span className="font-mono">{displayDate}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Header (Starts immediately on Page 1) */}
      {renderHeader()}

      {/* Main Content: Memory Records */}
      <main className={`relative z-10 ${isPrinting ? "block w-full" : "flex-1"} ${columns === "2" ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}`}>
        {memories.map((m) => (
          <div 
            key={m.id}
            className={`memory-card-item bg-white border-2 border-slate-300 rounded-xl text-slate-950 shadow-sm ${densityStyles.cardMargin} ${densityStyles.cardPadding} text-right rtl:text-right group relative hover:border-blue-400 hover:shadow-md transition-all duration-200`}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Exclude memory card button (Preview only, removed during print) */}
            {onExcludeMemory && !isPrinting && (
              <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={() => onExcludeMemory(m.id)}
                  className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                  title={lang === "ar" ? "استبعاد من التقرير" : "Exclude from report"}
                >
                  ✕ {lang === "ar" ? "استبعاد" : "Exclude"}
                </button>
              </div>
            )}

            {/* Card Header: Badges & Record Number */}
            <div className={`memory-card-header print-heading-group ${densityStyles.headerPadding}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className={`${densityStyles.badgeText} uppercase ${themeColors.badge}`}>
                    {m.category}
                  </span>
                  <span className={`${densityStyles.badgeText} uppercase ${
                    m.riskLevel === "Critical" 
                      ? "bg-rose-100 text-rose-950 border-rose-300 font-black" 
                      : m.riskLevel === "High"
                      ? "bg-amber-100 text-amber-950 border-amber-300 font-bold"
                      : m.riskLevel === "Medium"
                      ? "bg-blue-100 text-blue-950 border-blue-300"
                      : "bg-slate-200 text-slate-900 border-slate-300"
                  }`}>
                    {m.riskLevel}
                  </span>
                </div>
                <span className="text-[8.5pt] text-slate-600 font-mono font-extrabold">
                  #{m.id.slice(0, 8).toUpperCase()} • {new Date(m.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US")}
                </span>
              </div>

              {isPrinting || !onUpdateMemoryField ? (
                <div className={`w-full bg-transparent text-slate-950 font-black ${densityStyles.titleSize}`}>
                  {m.title}
                </div>
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMemoryField(m.id, "title", e.currentTarget.innerText || "")}
                  className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-950 transition-all ${densityStyles.titleSize}`}
                >
                  {m.title}
                </div>
              )}
            </div>

            {/* Content Sections */}
            <div className={densityStyles.sectionGap}>
              {/* Narrative & Decision */}
              <div>
                <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                  {lang === "ar" ? "سرد الحدث والموقف" : "Event Narrative"}
                </h4>
                {isPrinting || !onUpdateMemoryField ? (
                  <div className={`print-paragraph w-full bg-transparent text-slate-900 whitespace-pre-wrap break-words ${densityStyles.textSize}`}>
                    {m.description}
                  </div>
                ) : (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onUpdateMemoryField(m.id, "description", e.currentTarget.innerText || "")}
                    className={`print-paragraph w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-900 transition-all whitespace-pre-wrap break-words ${densityStyles.textSize}`}
                  >
                    {m.description}
                  </div>
                )}
              </div>

              <div>
                <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                  {lang === "ar" ? "القرار المتخذ" : "Decision Taken"}
                </h4>
                {isPrinting || !onUpdateMemoryField ? (
                  <div className={`print-paragraph w-full bg-transparent text-slate-900 whitespace-pre-wrap break-words ${densityStyles.textSize}`}>
                    {m.decision}
                  </div>
                ) : (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onUpdateMemoryField(m.id, "decision", e.currentTarget.innerText || "")}
                    className={`print-paragraph w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-900 transition-all whitespace-pre-wrap break-words ${densityStyles.textSize}`}
                  >
                    {m.decision}
                  </div>
                )}
              </div>

              {/* Causal Factors */}
              {includeCausal && m.causalFactors && (
                <div>
                  <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                    {lang === "ar" ? "العوامل المسببة والتحليل الجذري" : "Causal Factors & Root Cause"}
                  </h4>
                  {isPrinting || !onUpdateMemoryField ? (
                    <div className={`print-paragraph w-full bg-transparent text-slate-900 whitespace-pre-wrap break-words ${densityStyles.textSize}`}>
                      {m.causalFactors}
                    </div>
                  ) : (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => onUpdateMemoryField(m.id, "causalFactors", e.currentTarget.innerText || "")}
                      className={`print-paragraph w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-900 transition-all whitespace-pre-wrap break-words ${densityStyles.textSize}`}
                    >
                      {m.causalFactors}
                    </div>
                  )}
                </div>
              )}

              {/* Outcomes */}
              {includeOutcomes && m.outcomes && (
                <div>
                  <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.highlightText} mb-1`}>
                    {lang === "ar" ? "النتائج والأثر المترتب" : "Outcomes & Impact"}
                  </h4>
                  {isPrinting || !onUpdateMemoryField ? (
                    <div className={`print-paragraph w-full bg-transparent text-slate-900 whitespace-pre-wrap break-words ${densityStyles.textSize}`}>
                      {m.outcomes}
                    </div>
                  ) : (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => onUpdateMemoryField(m.id, "outcomes", e.currentTarget.innerText || "")}
                      className={`print-paragraph w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-900 transition-all whitespace-pre-wrap break-words ${densityStyles.textSize}`}
                    >
                      {m.outcomes}
                    </div>
                  )}
                </div>
              )}

              {/* Lessons Learned Highlight Box */}
              {includeLessons && m.lessonsLearned && (
                <div className={`lessons-box rounded-lg border-2 p-3 sm:p-4 ${themeColors.lessonsBg} print-page-break-avoid`}>
                  <h4 className={`${densityStyles.sectionTitleSize} ${themeColors.lessonsHeader} mb-1`}>
                    {lang === "ar" ? "الدروس المستفادة والتوجيهات المستقبلية" : "Lessons Learned & Guidelines"}
                  </h4>
                  {isPrinting || !onUpdateMemoryField ? (
                    <div className={`print-paragraph w-full bg-transparent text-slate-950 font-bold whitespace-pre-wrap break-words ${densityStyles.textSize}`}>
                      {m.lessonsLearned}
                    </div>
                  ) : (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => onUpdateMemoryField(m.id, "lessonsLearned", e.currentTarget.innerText || "")}
                      className={`print-paragraph w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100/70 focus:bg-blue-50/30 text-slate-950 font-bold transition-all whitespace-pre-wrap break-words ${densityStyles.textSize}`}
                    >
                      {m.lessonsLearned}
                    </div>
                  )}
                </div>
              )}

              {/* Record Footer: Author & Tags */}
              {(includeAuthor || (includeTags && m.tags && m.tags.length > 0)) && (
                <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-slate-200 text-slate-600 text-[8pt] font-semibold">
                  {includeAuthor && (
                    <div className="flex items-center gap-1">
                      <span>{lang === "ar" ? "المسؤول عن التوثيق: " : "Logged by: "}</span>
                      <span className="text-slate-900 font-extrabold">{userName}</span>
                    </div>
                  )}
                  {includeTags && m.tags && m.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <span>{lang === "ar" ? "الوسوم: " : "Tags: "}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {m.tags.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 font-mono text-[7pt] font-bold">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Executive Signature Block */}
      {renderSignatureBlock()}

      {/* Document Footer */}
      {renderFooter()}
    </article>
  );
};
