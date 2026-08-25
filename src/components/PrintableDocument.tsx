import React from "react";
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
  includeSignatureBlock = true,
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

  // Render Header Component (Pure White #FFFFFF background, clean high-contrast borders)
  const renderHeader = () => {
    if (!includeHeader) return null;

    if (headerStyle === "centered") {
      return (
        <div className="print-header-content w-full bg-white border-b-2 border-slate-300 pb-4 mb-4 select-none text-center" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
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
              <span className="font-extrabold text-sm text-slate-950 block">{companyName}</span>
              {departmentName && (
                <span className="text-[8pt] text-slate-600 font-semibold block">{departmentName}</span>
              )}
            </div>
          </div>

          <h1 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight">
            {lang === "ar" ? "تقرير الذاكرة المؤسسية وسجل القرارات" : "Institutional Memory & Decision Intelligence Report"}
          </h1>

          <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[8pt] text-slate-600 font-mono">
            <div className="flex items-center gap-4">
              <span><strong>{lang === "ar" ? "المرجع:" : "REF:"}</strong> {documentRef}</span>
              <span><strong>{lang === "ar" ? "التاريخ:" : "DATE:"}</strong> {dateVal}</span>
            </div>
            <div className="flex items-center gap-1 font-mono font-bold text-slate-700">
              <span className="page-number-target"></span>
            </div>
          </div>
        </div>
      );
    }

    if (headerStyle === "letterhead") {
      return (
        <div className="print-header-content w-full bg-white border-b-4 border-slate-900 pb-3 mb-4 select-none" dir={isRtl ? "rtl" : "ltr"}>
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
            <span>{dateVal}</span>
            <span className="page-number-target font-bold"></span>
          </div>
        </div>
      );
    }

    // Standard Header (Default)
    return (
      <div className="print-header-content w-full bg-white border-b-2 border-slate-300 pb-3 mb-4 select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between gap-4 pb-2">
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

        {/* Bottom meta row with dynamic page numbering hook */}
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
            <span className="page-number-target font-bold text-slate-700"></span>
          </div>
        </div>
      </div>
    );
  };

  // Render Signature & Approval Block (Visible by default, no issuing entity)
  const renderSignatureBlock = () => {
    if (!includeSignatureBlock) return null;

    return (
      <div className="signature-block w-full mt-6 pt-4 border-t-2 border-slate-300 select-none break-inside-avoid" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
            <span className="text-[10pt] font-black text-slate-950 uppercase tracking-wide">
              {lang === "ar" ? "اعتماد وتوثيق التقرير الرسمي" : "OFFICIAL REPORT VALIDATION"}
            </span>
          </div>
          {includeVerificationSeal && (
            <div className="flex items-center gap-1 text-[8pt] text-slate-600 font-mono">
              <span>[ SECURE HASH: {documentRef.slice(-6)} ]</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 w-full text-[9pt]">
          {/* Column 1: Signature */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/70">
            <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
              {lang === "ar" ? "التوقيع والختم المعتمد" : "AUTHORIZED SIGNATURE"}
            </span>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[40px]">
              <div className="flex justify-center items-center h-9 w-full">
                {signatureImg ? (
                  <img 
                    src={signatureImg} 
                    alt="Signature" 
                    className="h-9 object-contain block" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className="text-[8.5pt] text-slate-400 font-bold italic">
                    {lang === "ar" ? "التوقيع اليدوي أو الرقمي هنا" : "Manual / Digital Signature"}
                  </span>
                )}
              </div>
              <div className="border-b border-slate-300 w-full"></div>
            </div>
          </div>

          {/* Column 2: Approval Date & Approver */}
          <div className="flex flex-col justify-between min-h-[100px] border border-slate-200 rounded-lg p-3 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <span className="text-[8pt] font-black uppercase text-slate-500 tracking-wider">
                {lang === "ar" ? "تاريخ الاعتماد والمصادقة" : "APPROVAL DATE & AUTH"}
              </span>
              {userName && (
                <span className="text-[7.5pt] text-slate-600 font-bold">
                  {userName}
                </span>
              )}
            </div>
            <div className="pt-2 border-t border-slate-200 w-full mt-auto flex flex-col justify-end min-h-[40px]">
              <div className="flex justify-center items-end pb-1 h-9 w-full">
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
      <footer className="print-document-footer w-full border-t border-slate-300 pt-3 mt-6 text-slate-500 text-[8pt] flex items-center justify-between select-none" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-slate-700">ZAKIR INTELLIGENCE</span>
          <span>•</span>
          <span>{documentRef}</span>
        </div>
        
        <div className="flex items-center gap-2 font-mono text-slate-600 font-semibold">
          <span className="page-number-target"></span>
        </div>
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

      {/* Table-based fragmentation layout for repeating headers across physical print pages */}
      <table className="print-layout-table w-full border-collapse">
        {includeHeader && (
          <thead className="print-layout-thead">
            <tr>
              <th className="font-normal text-start p-0 m-0 border-none bg-transparent">
                {renderHeader()}
              </th>
            </tr>
          </thead>
        )}

        <tbody className="print-layout-tbody">
          <tr>
            <td className="font-normal p-0 m-0 border-none bg-transparent">
              {/* Main Content: Memory Records */}
              <div className={`relative z-10 ${isPrinting ? "block w-full" : "flex-1"} ${columns === "2" ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}`}>
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

                    {/* Card Body Grid: Context & Causal */}
                    <div className={densityStyles.sectionGap}>
                      {m.description && (
                        <div className="text-slate-900">
                          <span className={`${densityStyles.sectionTitleSize} text-slate-500 block mb-1`}>
                            {lang === "ar" ? "الوصف والسياق" : "DESCRIPTION & CONTEXT"}
                          </span>
                          {isPrinting || !onUpdateMemoryField ? (
                            <p className={`${densityStyles.textSize} text-slate-900 whitespace-pre-wrap`}>{m.description}</p>
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => onUpdateMemoryField(m.id, "description", e.currentTarget.innerText || "")}
                              className={`${densityStyles.textSize} text-slate-900 whitespace-pre-wrap outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-1 hover:bg-slate-50`}
                            >
                              {m.description}
                            </div>
                          )}
                        </div>
                      )}

                      {m.decision && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityStyles.sectionTitleSize} text-slate-500 block mb-0.5`}>
                            {lang === "ar" ? "القرار المتخذ" : "DECISION"}
                          </span>
                          <p className={`${densityStyles.textSize} text-slate-800`}>{m.decision}</p>
                        </div>
                      )}

                      {includeCausal && m.causalFactors && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityStyles.sectionTitleSize} text-slate-500 block mb-0.5`}>
                            {lang === "ar" ? "العوامل السببية" : "CAUSAL FACTORS"}
                          </span>
                          <p className={`${densityStyles.textSize} text-slate-800`}>{m.causalFactors}</p>
                        </div>
                      )}

                      {includeOutcomes && m.outcomes && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityStyles.sectionTitleSize} text-slate-500 block mb-1`}>
                            {lang === "ar" ? "النتائج والآثار" : "OUTCOMES & IMPACT"}
                          </span>
                          <p className={`${densityStyles.textSize} text-slate-800`}>{m.outcomes}</p>
                        </div>
                      )}

                      {includeLessons && m.lessonsLearned && (
                        <div className={`lessons-box rounded-lg p-3 ${themeColors.lessonsBg} mt-2`}>
                          <span className={`${densityStyles.sectionTitleSize} ${themeColors.lessonsHeader} font-black block mb-1`}>
                            {lang === "ar" ? "الدروس المستفادة والتوجيهات" : "LESSONS LEARNED & GUIDANCE"}
                          </span>
                          <p className={`${densityStyles.textSize} text-slate-900 font-medium whitespace-pre-wrap`}>
                            {m.lessonsLearned}
                          </p>
                        </div>
                      )}

                      {includeAuthor && (m.authorName || m.authorEmail) && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[8pt] text-slate-500 font-mono">
                          <span>{lang === "ar" ? "الموثق:" : "Authored by:"} <strong>{m.authorName || m.authorEmail}</strong></span>
                          {includeTags && m.tags && m.tags.length > 0 && (
                            <span>{m.tags.map(t => `#${t}`).join(" ")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signature & Validation Section */}
              {renderSignatureBlock()}

              {/* Footer Section */}
              {renderFooter()}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
};
