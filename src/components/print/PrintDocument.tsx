import React, { useMemo } from "react";
import { Memory } from "../../types";
import { PrintSettingsState, PrintDiagnostics } from "./printTypes";
import { PrintHeader } from "./PrintHeader";
import { PrintFooter } from "./PrintFooter";
import { PrintSignature } from "./PrintSignature";
import { sanitizeText } from "./printSanitizer";

interface PrintDocumentProps {
  memories: Memory[];
  settings: PrintSettingsState;
  lang: "ar" | "en" | "fr";
  onExcludeMemory?: (memoryId: string) => void;
  isPrinting?: boolean;
  onDiagnosticsUpdate?: (diag: PrintDiagnostics) => void;
  pageIndex?: number;
  totalPages?: number;
}

export function chunkMemories(memories: Memory[], density: string): Memory[][] {
  if (!memories || memories.length === 0) return [[]];
  const chunkSize = density === "compact" ? 3 : density === "spacious" ? 1 : 2;
  const chunks: Memory[][] = [];
  for (let i = 0; i < memories.length; i += chunkSize) {
    chunks.push(memories.slice(i, i + chunkSize));
  }
  return chunks;
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  memories,
  settings,
  lang,
  onExcludeMemory,
  isPrinting = false,
  onDiagnosticsUpdate,
  pageIndex = 0,
  totalPages,
}) => {
  const isRtl = lang === "ar";

  // MANDATORY MEMORY DEDUPLICATION USING AUTHORITATIVE memory.id
  const normalizedMemories = useMemo(() => {
    if (!memories || memories.length === 0) return [];
    const map = new Map<string, Memory>();
    for (const m of memories) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [memories]);

  // Report diagnostics (Safeguarded against infinite re-renders)
  const prevDiagRef = React.useRef<{ selectedCount: number; uniqueCount: number; renderedCount: number } | null>(null);

  React.useEffect(() => {
    if (onDiagnosticsUpdate) {
      const selectedCount = memories ? memories.length : 0;
      const uniqueCount = normalizedMemories.length;
      const renderedCount = normalizedMemories.length;

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
  }, [memories?.length, normalizedMemories.length, onDiagnosticsUpdate]);

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
        cardPadding: "20px 24px",
        cardMarginBottom: "20px",
        sectionGap: "16px",
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

  if (normalizedMemories.length === 0) {
    return (
      <div className="w-full p-12 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl my-8">
        <p className="text-sm font-bold text-slate-500">
          {lang === "ar"
            ? "لا توجد ذكريات أو قرارات محددة للطباعة حالياً."
            : lang === "fr"
            ? "Aucun souvenir ou décision sélectionné pour l'impression."
            : "No memories selected for printing."}
        </p>
      </div>
    );
  }

  // Determine if this specific page instance is first or last page
  const calculatedTotalPages = totalPages || Math.max(1, chunkMemories(normalizedMemories, settings.density).length);
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === calculatedTotalPages - 1;

  return (
    <div
      className="zakir-print-document-content w-full h-auto min-h-full bg-white text-slate-900 flex flex-col justify-between overflow-visible"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
        fontSize: `${baseFontSize}px`,
        lineHeight: metrics.lineHeight,
      }}
    >
      <div>
        {/* Institutional Header (Shown on first page or all pages if enabled) */}
        {(isFirstPage || settings.showHeader) && (
          <PrintHeader settings={settings} lang={lang} />
        )}

        {/* Memory Cards Flow Container */}
        <main className="my-2" style={{ display: "flex", flexDirection: "column", gap: metrics.cardMarginBottom }}>
          {normalizedMemories.map((m, index) => {
            const cleanTitle = sanitizeText(m.title, lang);
            const cleanDesc = sanitizeText(m.description, lang);
            const cleanDecision = sanitizeText(m.decision, lang);
            const cleanCausal = sanitizeText(m.causalFactors, lang);
            const cleanOutcomes = sanitizeText(m.outcomes, lang);
            const cleanLessons = sanitizeText(m.lessonsLearned, lang);

            return (
              <article
                key={m.id}
                data-memory-id={m.id}
                className="zakir-print-memory-card border border-slate-300 rounded-lg bg-white shadow-xs relative break-inside-avoid print:shadow-none print:border-slate-300"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  padding: metrics.cardPadding,
                  marginBottom: metrics.cardMarginBottom,
                  lineHeight: metrics.lineHeight,
                }}
              >
                {/* Exclusion Button (Screen preview only) */}
                {onExcludeMemory && !isPrinting && (
                  <button
                    type="button"
                    onClick={() => onExcludeMemory(m.id)}
                    className="no-print absolute top-2.5 end-2.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                    title={lang === "ar" ? "استبعاد هذه الذكرى من التقرير" : "Exclude memory from report"}
                  >
                    ✕
                  </button>
                )}

                {/* Header: Title, Category, Risk Level */}
                <div
                  className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 break-inside-avoid"
                  style={{ marginBottom: metrics.sectionGap }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-400 uppercase" style={{ fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}>
                        #{index + 1}
                      </span>
                      <span className="font-black text-[#0075DE] bg-blue-50 px-2 py-0.5 rounded border border-blue-200" style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.85))}px` }}>
                        {m.category}
                      </span>
                      <span className="font-mono text-slate-400" style={{ fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}>
                        {new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-900 leading-snug" style={{ fontSize: `${Math.round(baseFontSize * 1.2)}px` }}>
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

                {/* Main Description */}
                {cleanDesc && (
                  <div
                    className="text-slate-800 font-medium whitespace-pre-line"
                    style={{ fontSize: `${baseFontSize}px`, lineHeight: metrics.lineHeight, marginBottom: metrics.sectionGap }}
                  >
                    {cleanDesc}
                  </div>
                )}

                {/* Core Strategic Decision */}
                {cleanDecision && (
                  <div
                    className="decision-box bg-slate-50 border-s-4 border-[#0075DE] rounded-e-lg break-inside-avoid"
                    style={{ padding: metrics.innerPadding, marginBottom: metrics.sectionGap }}
                  >
                    <strong className="block font-extrabold text-[#0075DE] mb-0.5" style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}>
                      {lang === "ar" ? "القرار الاستراتيجي المعتمد:" : "Approved Strategic Decision:"}
                    </strong>
                    <p className="text-slate-900 font-semibold whitespace-pre-line" style={{ fontSize: `${baseFontSize}px`, lineHeight: metrics.lineHeight }}>
                      {cleanDecision}
                    </p>
                  </div>
                )}

                {/* Causal Factors */}
                {settings.showCausalFactors && cleanCausal && (
                  <div style={{ marginBottom: metrics.sectionGap }}>
                    <span className="font-bold text-slate-700 block mb-1" style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}>
                      {lang === "ar" ? "المسببات والعوامل المباشرة:" : "Causal Factors & Root Causes:"}
                    </span>
                    <p
                      className="text-slate-700 bg-slate-50 rounded border border-slate-200"
                      style={{ padding: metrics.innerPadding, fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`, lineHeight: metrics.lineHeight }}
                    >
                      {cleanCausal}
                    </p>
                  </div>
                )}

                {/* Outcomes */}
                {settings.showOutcomes && cleanOutcomes && (
                  <div style={{ marginBottom: metrics.sectionGap }}>
                    <span className="font-bold text-slate-700 block mb-1" style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}>
                      {lang === "ar" ? "النتائج والأثر المترتب:" : "Direct Outcomes & Impact:"}
                    </span>
                    <p
                      className="text-slate-700 bg-slate-50 rounded border border-slate-200"
                      style={{ padding: metrics.innerPadding, fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`, lineHeight: metrics.lineHeight }}
                    >
                      {cleanOutcomes}
                    </p>
                  </div>
                )}

                {/* Lessons Learned */}
                {settings.showLessonsLearned && cleanLessons && (
                  <div style={{ marginBottom: metrics.sectionGap }}>
                    <span className="font-bold text-emerald-900 block mb-1" style={{ fontSize: `${Math.max(10, Math.round(baseFontSize * 0.88))}px` }}>
                      {lang === "ar" ? "الدروس المستفادة للتطوير المستقبلي:" : "Key Lessons & Actionable Insights:"}
                    </span>
                    <p
                      className="text-emerald-950 bg-emerald-50/70 rounded border border-emerald-200 font-medium"
                      style={{ padding: metrics.innerPadding, fontSize: `${Math.max(10, Math.round(baseFontSize * 0.92))}px`, lineHeight: metrics.lineHeight }}
                    >
                      {cleanLessons}
                    </p>
                  </div>
                )}

                {/* Footer Metadata & Tags */}
                <div
                  className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 flex-wrap gap-2"
                  style={{ marginTop: metrics.sectionGap, fontSize: `${Math.max(9, Math.round(baseFontSize * 0.77))}px` }}
                >
                  {/* Author & Role */}
                  {settings.showMetadata && (
                    <div className="flex items-center gap-1">
                      <span>{lang === "ar" ? "المسجل:" : "Logged by:"}</span>
                      <strong className="text-slate-800">{m.authorName || m.authorEmail}</strong>
                      <span className="text-slate-400">({m.authorRole})</span>
                    </div>
                  )}

                  {/* Tags */}
                  {settings.showTags && m.tags && m.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap ms-auto">
                      {m.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono border border-slate-200"
                          style={{ fontSize: `${Math.max(8, Math.round(baseFontSize * 0.7))}px` }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </main>
      </div>

      <div>
        {/* Official Signature Section (On last page or if enabled) */}
        {isLastPage && settings.showSignature && (
          <PrintSignature settings={settings} lang={lang} />
        )}

        {/* Institutional Footer (On last page or all pages) */}
        {(isLastPage || settings.showFooter) && (
          <PrintFooter settings={settings} lang={lang} />
        )}
      </div>
    </div>
  );
};
