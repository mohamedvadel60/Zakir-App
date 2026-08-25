import React from "react";
import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { PrintHeader } from "./PrintHeader";
import { PrintFooter } from "./PrintFooter";
import { PrintSignature } from "./PrintSignature";

interface PrintDocumentProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "en" | "ar" | "fr";
  isPrinting?: boolean;
  pageIndex?: number;
  totalPages?: number;
  onUpdateMemoryField?: (id: string, field: keyof Memory, value: any) => void;
  onExcludeMemory?: (id: string) => void;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  memories,
  settings,
  lang,
  isPrinting = false,
  pageIndex,
  totalPages,
  onUpdateMemoryField,
  onExcludeMemory,
}) => {
  const isRtl = lang === "ar";

  // Density styles mapping
  const densityConfig = {
    compact: {
      cardPadding: "p-3.5 sm:p-4",
      cardMargin: "mb-3",
      sectionGap: "space-y-2",
      headerPadding: "pb-2 mb-2",
      titleSize: "text-sm font-extrabold text-slate-950",
      sectionTitleSize: "text-[8pt] font-black uppercase tracking-wider text-slate-500",
      textSize: "text-xs text-slate-900 leading-normal",
      badgeText: "text-[7.5pt] font-black px-2 py-0.5 rounded border",
    },
    standard: {
      cardPadding: "p-4 sm:p-5",
      cardMargin: "mb-4",
      sectionGap: "space-y-3",
      headerPadding: "pb-2.5 mb-3",
      titleSize: "text-base font-black text-slate-950",
      sectionTitleSize: "text-[8.5pt] font-black uppercase tracking-wider text-slate-500",
      textSize: "text-sm text-slate-900 leading-relaxed",
      badgeText: "text-[8pt] font-black px-2.5 py-0.5 rounded border",
    },
    spacious: {
      cardPadding: "p-5 sm:p-6",
      cardMargin: "mb-5",
      sectionGap: "space-y-4",
      headerPadding: "pb-3 mb-4",
      titleSize: "text-lg font-black text-slate-950",
      sectionTitleSize: "text-[9pt] font-black uppercase tracking-wider text-slate-500",
      textSize: "text-base text-slate-900 leading-relaxed",
      badgeText: "text-[8.5pt] font-black px-3 py-1 rounded border",
    },
  }[settings.density || "standard"];

  return (
    <article
      className={`zakir-print-document bg-white text-slate-900 relative ${
        isPrinting
          ? "border-none shadow-none rounded-none block w-full"
          : "w-full h-full flex flex-col justify-start"
      }`}
      style={{
        lineHeight: settings.lineSpacing || 1.2,
        fontSize: `${settings.fontScale || 100}%`,
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Optional Confidentiality Watermark */}
      {settings.watermark && settings.watermark !== "none" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
          <div className="text-slate-300/40 font-black tracking-widest uppercase -rotate-45 text-center px-6 border-8 border-slate-300/30 rounded-3xl py-8 flex flex-col items-center gap-2 max-w-[85%]">
            <span className="text-3xl sm:text-4xl md:text-5xl font-black leading-none">
              {settings.watermark === "confidential"
                ? "STRICTLY CONFIDENTIAL"
                : settings.watermark === "internal"
                ? "INTERNAL USE ONLY"
                : "OFFICIAL RECORD"}
            </span>
            <div className="text-[10px] sm:text-xs font-bold flex flex-col items-center gap-0.5 pt-1.5 border-t border-slate-300/40 w-full mt-1.5 opacity-85 font-sans">
              <span>{settings.companyName}</span>
              {settings.displayDate && <span className="font-mono">{settings.displayDate}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Main Print Layout Container */}
      <table className="zakir-print-table w-full border-collapse">
        {settings.includeHeader && (
          <thead className="zakir-print-thead">
            <tr>
              <th className="font-normal text-start p-0 m-0 border-none bg-white">
                <PrintHeader
                  companyName={settings.companyName}
                  departmentName={settings.departmentName}
                  documentRef={settings.documentRef}
                  displayDate={settings.displayDate}
                  lang={lang}
                  headerStyle={settings.headerStyle}
                  logoSize={settings.logoSize}
                  companyLogoImg={settings.companyLogoImg}
                  pageNumberText={pageIndex && totalPages ? `${lang === "ar" ? "الصفحة" : "Page"} ${pageIndex} / ${totalPages}` : undefined}
                />
              </th>
            </tr>
          </thead>
        )}

        <tbody className="zakir-print-tbody">
          <tr>
            <td className="font-normal p-0 m-0 border-none bg-white">
              {/* Memory Records List */}
              <div
                className={`relative z-10 ${
                  isPrinting ? "block w-full" : "flex-1"
                } ${
                  settings.columns === "2"
                    ? "grid grid-cols-2 gap-4 items-start"
                    : "space-y-4"
                }`}
              >
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className={`zakir-card-item bg-white border border-slate-300 rounded-lg text-slate-950 shadow-none ${densityConfig.cardMargin} ${densityConfig.cardPadding} group relative hover:border-slate-400 transition-colors`}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    {/* Exclude memory card button (Preview only) */}
                    {onExcludeMemory && !isPrinting && (
                      <div className="no-print absolute top-3 ltr:right-3 rtl:left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onExcludeMemory(m.id)}
                          className="p-1 px-2 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title={lang === "ar" ? "استبعاد من التقرير" : "Exclude from report"}
                        >
                          ✕ {lang === "ar" ? "استبعاد" : "Exclude"}
                        </button>
                      </div>
                    )}

                    {/* Card Header: Badges & Record Number */}
                    <div className={`zakir-card-header ${densityConfig.headerPadding} border-b border-slate-200 pb-2 mb-2`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`${densityConfig.badgeText} uppercase bg-slate-100 text-slate-800 border-slate-300`}>
                            {m.category}
                          </span>
                          <span
                            className={`${densityConfig.badgeText} uppercase ${
                              m.riskLevel === "Critical"
                                ? "bg-rose-100 text-rose-950 border-rose-300 font-black"
                                : m.riskLevel === "High"
                                ? "bg-amber-100 text-amber-950 border-amber-300 font-bold"
                                : m.riskLevel === "Medium"
                                ? "bg-blue-100 text-blue-950 border-blue-300"
                                : "bg-slate-100 text-slate-800 border-slate-300"
                            }`}
                          >
                            {m.riskLevel}
                          </span>
                        </div>
                        <span className="text-[8pt] text-slate-600 font-mono font-bold">
                          #{m.id.slice(0, 8).toUpperCase()} • {new Date(m.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US")}
                        </span>
                      </div>

                      {/* Record Title */}
                      {isPrinting || !onUpdateMemoryField ? (
                        <h3 className={`w-full bg-transparent text-slate-950 font-black ${densityConfig.titleSize}`}>
                          {m.title}
                        </h3>
                      ) : (
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => onUpdateMemoryField(m.id, "title", e.currentTarget.innerText || "")}
                          className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-0.5 hover:bg-slate-100 text-slate-950 transition-colors ${densityConfig.titleSize}`}
                        >
                          {m.title}
                        </div>
                      )}
                    </div>

                    {/* Card Body: Description, Decision, Causal, Outcomes, Lessons */}
                    <div className={densityConfig.sectionGap}>
                      {m.description && (
                        <div>
                          <span className={`${densityConfig.sectionTitleSize} block mb-0.5`}>
                            {lang === "ar" ? "الوصف والسياق" : lang === "fr" ? "DESCRIPTION & CONTEXTE" : "DESCRIPTION & CONTEXT"}
                          </span>
                          {isPrinting || !onUpdateMemoryField ? (
                            <p className={`${densityConfig.textSize} text-slate-900 whitespace-pre-wrap zakir-break-auto`}>
                              {m.description}
                            </p>
                          ) : (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => onUpdateMemoryField(m.id, "description", e.currentTarget.innerText || "")}
                              className={`${densityConfig.textSize} text-slate-900 whitespace-pre-wrap outline-none focus:ring-1 focus:ring-blue-500/40 rounded p-1 hover:bg-slate-50 zakir-break-auto`}
                            >
                              {m.description}
                            </div>
                          )}
                        </div>
                      )}

                      {m.decision && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityConfig.sectionTitleSize} block mb-0.5`}>
                            {lang === "ar" ? "القرار المتخذ" : lang === "fr" ? "DÉCISION" : "DECISION RECORD"}
                          </span>
                          <p className={`${densityConfig.textSize} text-slate-800 whitespace-pre-wrap zakir-break-auto`}>
                            {m.decision}
                          </p>
                        </div>
                      )}

                      {settings.includeCausal && m.causalFactors && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityConfig.sectionTitleSize} block mb-0.5`}>
                            {lang === "ar" ? "العوامل السببية" : lang === "fr" ? "FACTEURS CAUSAUX" : "CAUSAL FACTORS"}
                          </span>
                          <p className={`${densityConfig.textSize} text-slate-800 whitespace-pre-wrap zakir-break-auto`}>
                            {m.causalFactors}
                          </p>
                        </div>
                      )}

                      {settings.includeOutcomes && m.outcomes && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className={`${densityConfig.sectionTitleSize} block mb-0.5`}>
                            {lang === "ar" ? "النتائج والأثر" : lang === "fr" ? "RÉSULTATS & IMPACT" : "OUTCOMES & IMPACT"}
                          </span>
                          <p className={`${densityConfig.textSize} text-slate-800 whitespace-pre-wrap zakir-break-auto`}>
                            {m.outcomes}
                          </p>
                        </div>
                      )}

                      {settings.includeLessons && m.lessonsLearned && (
                        <div className="zakir-break-avoid rounded p-3 bg-slate-50 border border-slate-200 mt-2">
                          <span className={`${densityConfig.sectionTitleSize} text-slate-700 font-black block mb-1`}>
                            {lang === "ar" ? "الدروس المستفادة والتوجيهات" : lang === "fr" ? "LEÇONS ET RECOMMANDATIONS" : "LESSONS LEARNED & GUIDANCE"}
                          </span>
                          <p className={`${densityConfig.textSize} text-slate-900 font-medium whitespace-pre-wrap zakir-break-auto`}>
                            {m.lessonsLearned}
                          </p>
                        </div>
                      )}

                      {settings.includeAuthor && (m.authorName || m.authorEmail) && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[8pt] text-slate-500 font-mono">
                          <span>
                            {lang === "ar" ? "الموثق:" : "Authored by:"} <strong>{m.authorName || m.authorEmail}</strong>
                          </span>
                          {settings.includeTags && m.tags && m.tags.length > 0 && (
                            <span>{m.tags.map((t) => `#${t}`).join(" ")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Signature Block */}
              <PrintSignature
                isVisible={settings.includeSignatureBlock}
                lang={lang}
                displayDate={settings.displayDate}
                userName={settings.userName}
                documentRef={settings.documentRef}
                signatureImg={settings.signatureImg}
                includeVerificationSeal={settings.includeVerificationSeal}
              />

              {/* Footer */}
              {settings.includeFooter && (
                <PrintFooter
                  documentRef={settings.documentRef}
                  lang={lang}
                  pageIndex={pageIndex}
                  totalPages={totalPages}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
};
