import React, { useMemo } from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PrintDiagnostics } from "./printTypes";
import { PaginatedPage, PaginatedMemoryBlock, paginateMemories, validateContentContinuity } from "./printPagination";
import { PrintHeader } from "./PrintHeader";
import { PrintFooter } from "./PrintFooter";
import { PrintSignature } from "./PrintSignature";
import { sanitizeText } from "./printSanitizer";

export { paginateMemories, validateContentContinuity };
export type { PaginatedPage, PaginatedMemoryBlock };

interface PrintDocumentProps {
  pageData?: PaginatedPage;
  memories?: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  onExcludeMemory?: (memoryId: string) => void;
  isPrinting?: boolean;
  onDiagnosticsUpdate?: (diag: PrintDiagnostics) => void;
  pageIndex?: number;
  totalPages?: number;
}

export function chunkMemories(memories: Memory[], density: string, settings?: PrintSettingsState, lang?: "ar" | "en" | "fr"): Memory[][] {
  if (!memories || memories.length === 0) return [[]];
  const pages = paginateMemories(
    memories,
    settings || {
      paperSize: "A4",
      orientation: "portrait",
      margins: "normal",
      density: (density as any) || "comfortable",
      lineHeight: 1.55,
      headerStyle: "classic",
      showOuterBorder: true,
      outerBorderThickness: 2,
      outerBorderColor: "#0f172a",
      outerBorderRadius: 0,
      whiteMarginMm: 10,
      fontSize: 13,
      showHeader: true,
      showFooter: true,
      showSignature: true,
      showIssuingEntity: true,
      issuingEntityName: "",
      showMetadata: true,
      showCausalFactors: true,
      showOutcomes: true,
      showLessonsLearned: true,
      showTags: true,
      showRiskBadges: true,
      companyName: "",
      departmentName: "",
      reportTitle: "",
      docRefNumber: "",
      authorName: "",
      approverName: "",
      approvalDate: "",
      companyLogoImg: null,
      signatureImg: null,
      watermarkText: "",
      zoom: 1.0,
    },
    lang || "ar"
  );
  return pages.map((p) => p.blocks.map((b) => b.memory));
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  pageData,
  memories,
  settings,
  lang,
  onExcludeMemory,
  isPrinting = false,
  onDiagnosticsUpdate,
  pageIndex = 0,
  totalPages = 1,
}) => {
  const isRtl = lang === "ar";

  // Normalize fallback memories if pageData is not provided directly
  const normalizedMemories = useMemo(() => {
    if (pageData) return [];
    if (!memories || memories.length === 0) return [];
    const map = new Map<string, Memory>();
    for (const m of memories) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [pageData, memories]);

  // Construct or use authoritative PageData
  const activePage: PaginatedPage = useMemo(() => {
    if (pageData) return pageData;
    const computedPages = paginateMemories(normalizedMemories, settings, lang);
    return computedPages[pageIndex] || computedPages[0] || {
      pageIndex: 0,
      pageNumber: 1,
      totalPages: 1,
      showHeader: settings.showHeader,
      showFooter: settings.showFooter,
      showSignature: settings.showSignature,
      blocks: [],
    };
  }, [pageData, normalizedMemories, settings, lang, pageIndex]);

  // Report diagnostics safely
  const prevDiagRef = React.useRef<{ selectedCount: number; uniqueCount: number; renderedCount: number } | null>(null);

  React.useEffect(() => {
    if (onDiagnosticsUpdate) {
      const selectedCount = memories ? memories.length : activePage.blocks.length;
      const uniqueCount = selectedCount;
      const renderedCount = selectedCount;

      const prev = prevDiagRef.current;
      if (
        !prev ||
        prev.selectedCount !== selectedCount ||
        prev.uniqueCount !== uniqueCount ||
        prev.renderedCount !== renderedCount
      ) {
        prevDiagRef.current = { selectedCount, uniqueCount, renderedCount };
        onDiagnosticsUpdate({
          selectedCount,
          uniqueCount,
          renderedCount,
        });
      }
    }
  }, [memories?.length, activePage.blocks.length, onDiagnosticsUpdate]);

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
  };

  const getRiskLabel = (risk: string) => {
    if (lang === "ar") {
      if (risk === "Critical") return "حرج جداً";
      if (risk === "High") return "عالي المخاطر";
      if (risk === "Medium") return "متوسط";
      return "منخفض";
    }
    return risk;
  };

  const getDensityMetrics = () => {
    let lh = settings.lineHeight;
    if (!lh) {
      if (settings.density === "compact") lh = 1.3;
      else if (settings.density === "spacious") lh = 1.85;
      else lh = 1.55;
    }

    if (settings.density === "compact") {
      return {
        lineHeight: lh,
        cardPadding: "10px 14px",
        cardMarginBottom: "10px",
        sectionGap: "8px",
        innerPadding: "6px 10px",
      };
    }

    if (settings.density === "spacious") {
      return {
        lineHeight: lh,
        cardPadding: "18px 22px",
        cardMarginBottom: "18px",
        sectionGap: "14px",
        innerPadding: "12px 16px",
      };
    }

    // comfortable (default)
    return {
      lineHeight: lh,
      cardPadding: "14px 18px",
      cardMarginBottom: "14px",
      sectionGap: "12px",
      innerPadding: "8px 12px",
    };
  };

  const metrics = getDensityMetrics();
  const baseFontSize = typeof settings.fontSize === "number" ? settings.fontSize : 13;

  if (activePage.blocks.length === 0 && !activePage.showSignature && !activePage.showHeader) {
    return (
      <div className="w-full p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl my-4">
        <p className="text-xs font-bold text-slate-500">
          {lang === "ar"
            ? "لا توجد عناصر لعرضها في هذه الصفحة."
            : lang === "fr"
            ? "Aucun élément à afficher sur cette page."
            : "No items to display on this page."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="zakir-print-document-content w-full h-full min-h-full bg-white text-slate-900 flex flex-col justify-between box-border"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
        fontSize: `${baseFontSize}px`,
        lineHeight: metrics.lineHeight,
      }}
    >
      {/* 1. Institutional Header (Top) */}
      {activePage.showHeader && (
        <header className="zakir-print-header shrink-0 pb-1">
          <PrintHeader settings={settings} lang={lang} />
        </header>
      )}

      {/* 2. Main Content Flow Container (Starts strictly from Top, no centering) */}
      <main
        className="zakir-print-main-content flex-1 flex flex-col justify-start min-w-0 my-1 overflow-hidden"
        style={{ gap: metrics.cardMarginBottom }}
      >
        {activePage.blocks.map((block, blkIdx) => {
          const m = block.memory;
          const cleanTitle = sanitizeText(m.title, lang);
          const cleanDecision = sanitizeText(m.decision, lang);
          const cleanCausal = sanitizeText(m.causalFactors, lang);
          const cleanOutcomes = sanitizeText(m.outcomes, lang);
          const cleanLessons = sanitizeText(m.lessonsLearned, lang);

          // Determine description paragraphs to render
          const descParasToRender = (block.descriptionParagraphs && block.descriptionParagraphs.length > 0)
            ? block.descriptionParagraphs
            : (m.description && m.description.trim() ? [m.description.trim()] : []);

          return (
            <article
              key={`${m.id}-${block.isContinuation ? `cont-${block.continuationIndex || blkIdx}` : "main"}`}
              data-memory-id={m.id}
              className="zakir-print-memory-card border border-slate-300 rounded-lg bg-white shadow-xs relative break-inside-avoid print:shadow-none print:border-slate-300 shrink-0"
              style={{
                backgroundColor: "#ffffff",
                color: "#0f172a",
                padding: metrics.cardPadding,
                marginBottom: metrics.cardMarginBottom,
                lineHeight: metrics.lineHeight,
              }}
            >
              {/* Exclusion Button (Screen preview only on main block) */}
              {onExcludeMemory && !isPrinting && !block.isContinuation && (
                <button
                  type="button"
                  onClick={() => onExcludeMemory(m.id)}
                  className="no-print absolute top-2.5 end-2.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer z-10"
                  title={lang === "ar" ? "استبعاد هذه الذكرى من التقرير" : "Exclude memory from report"}
                >
                  ✕
                </button>
              )}

              {/* Header: Title, Category, Risk Level */}
              {block.showCardHeader && (
                <div
                  className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 break-inside-avoid"
                  style={{ marginBottom: metrics.sectionGap }}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-mono font-bold text-slate-400 uppercase"
                        style={{ fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}
                      >
                        #{block.memoryIndex + 1}
                      </span>
                      <span
                        className="font-black text-[#0075DE] bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.85))}px` }}
                      >
                        {m.category}
                      </span>
                      <span
                        className="font-mono text-slate-400"
                        style={{ fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}
                      >
                        {new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                      </span>

                      {block.isContinuation && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {lang === "ar" ? `(تابع - الجزء ${(block.continuationIndex || 1) + 1})` : `(Continued - Part ${(block.continuationIndex || 1) + 1})`}
                        </span>
                      )}
                    </div>
                    <h3
                      className="font-black text-slate-900 leading-snug break-words"
                      style={{ fontSize: `${Math.round(baseFontSize * 1.2)}px` }}
                    >
                      {cleanTitle || m.title}
                    </h3>
                  </div>

                  {/* Risk Badge */}
                  {settings.showRiskBadges && (
                    <span
                      className={`risk-badge px-2 py-0.5 rounded font-extrabold border shrink-0 ${getRiskBadgeColor(
                        m.riskLevel
                      )}`}
                      style={{ fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}
                    >
                      {getRiskLabel(m.riskLevel)}
                    </span>
                  )}
                </div>
              )}

              {/* Main Description Paragraphs (Rendered continuously with Zero Loss) */}
              {descParasToRender.length > 0 && (
                <div
                  className="text-slate-800 font-medium space-y-2"
                  style={{
                    fontSize: `${baseFontSize}px`,
                    lineHeight: metrics.lineHeight,
                    marginBottom: metrics.sectionGap,
                  }}
                >
                  {descParasToRender.map((pText, pIdx) => {
                    const cleanP = sanitizeText(pText, lang);
                    if (!cleanP) return null;
                    return (
                      <p key={pIdx} className="whitespace-pre-line leading-relaxed">
                        {cleanP}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Core Strategic Decision */}
              {block.showDecision && cleanDecision && (
                <div
                  className="decision-box bg-slate-50 border-s-4 border-[#0075DE] rounded-e-lg break-inside-avoid"
                  style={{ padding: metrics.innerPadding, marginBottom: metrics.sectionGap }}
                >
                  <strong
                    className="block font-extrabold text-[#0075DE] mb-0.5"
                    style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}
                  >
                    {lang === "ar" ? "القرار الاستراتيجي المعتمد:" : "Approved Strategic Decision:"}
                  </strong>
                  <p
                    className="text-slate-900 font-semibold whitespace-pre-line"
                    style={{ fontSize: `${baseFontSize}px`, lineHeight: metrics.lineHeight }}
                  >
                    {cleanDecision}
                  </p>
                </div>
              )}

              {/* Causal Factors */}
              {block.showCausalFactors && settings.showCausalFactors && cleanCausal && (
                <div style={{ marginBottom: metrics.sectionGap }}>
                  <span
                    className="font-bold text-slate-700 block mb-1"
                    style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}
                  >
                    {lang === "ar" ? "المسببات والعوامل المباشرة:" : "Causal Factors & Root Causes:"}
                  </span>
                  <p
                    className="text-slate-700 bg-slate-50 rounded border border-slate-200 whitespace-pre-line"
                    style={{
                      padding: metrics.innerPadding,
                      fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`,
                      lineHeight: metrics.lineHeight,
                    }}
                  >
                    {cleanCausal}
                  </p>
                </div>
              )}

              {/* Outcomes */}
              {block.showOutcomes && settings.showOutcomes && cleanOutcomes && (
                <div style={{ marginBottom: metrics.sectionGap }}>
                  <span
                    className="font-bold text-slate-700 block mb-1"
                    style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}
                  >
                    {lang === "ar" ? "النتائج والأثر المترتب:" : "Direct Outcomes & Impact:"}
                  </span>
                  <p
                    className="text-slate-700 bg-slate-50 rounded border border-slate-200 whitespace-pre-line"
                    style={{
                      padding: metrics.innerPadding,
                      fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`,
                      lineHeight: metrics.lineHeight,
                    }}
                  >
                    {cleanOutcomes}
                  </p>
                </div>
              )}

              {/* Lessons Learned */}
              {block.showLessonsLearned && settings.showLessonsLearned && cleanLessons && (
                <div style={{ marginBottom: metrics.sectionGap }}>
                  <span
                    className="font-bold text-emerald-900 block mb-1"
                    style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}
                  >
                    {lang === "ar" ? "الدروس المستفادة للتطوير المستقبلي:" : "Key Lessons & Actionable Insights:"}
                  </span>
                  <p
                    className="text-emerald-950 bg-emerald-50/70 rounded border border-emerald-200 font-medium whitespace-pre-line"
                    style={{
                      padding: metrics.innerPadding,
                      fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`,
                      lineHeight: metrics.lineHeight,
                    }}
                  >
                    {cleanLessons}
                  </p>
                </div>
              )}

              {/* Footer Metadata & Tags */}
              {block.showMetadataAndTags && (
                <div
                  className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 flex-wrap gap-2"
                  style={{
                    marginTop: metrics.sectionGap,
                    fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px`,
                  }}
                >
                  {/* Author & Role */}
                  {settings.showMetadata && (
                    <div className="flex items-center gap-1">
                      <span>{lang === "ar" ? "المسجل:" : "Logged by:"}</span>
                      <strong className="text-slate-800">{m.authorName || m.authorEmail}</strong>
                      {m.authorRole && <span className="text-slate-400">({m.authorRole})</span>}
                    </div>
                  )}

                  {/* Tags */}
                  {settings.showTags && m.tags && m.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap ms-auto">
                      {m.tags.map((tag, tIdx) => (
                        <span
                          key={tag || tIdx}
                          className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono border border-slate-200"
                          style={{ fontSize: `${Math.max(8, Math.round(baseFontSize * 0.7))}px` }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {/* Official Approval & Certification Section (Placed cleanly in content flow) */}
        {activePage.showSignature && (
          <div className="shrink-0 mt-2">
            <PrintSignature
              settings={settings}
              lang={lang}
              isStandalonePage={activePage.blocks.length === 0}
            />
          </div>
        )}
      </main>

      {/* 3. Institutional Footer with Real Dynamic Page Counter (Pinned to bottom via mt-auto) */}
      {activePage.showFooter && (
        <footer className="zakir-print-footer shrink-0 mt-auto pt-1.5">
          <PrintFooter
            settings={settings}
            lang={lang}
            pageNumber={activePage.pageNumber}
            totalPages={activePage.totalPages}
          />
        </footer>
      )}
    </div>
  );
};
