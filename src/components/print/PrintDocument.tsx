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
}

export const PrintDocument: React.FC<PrintDocumentProps> = ({
  memories,
  settings,
  lang,
  onExcludeMemory,
  isPrinting = false,
  onDiagnosticsUpdate,
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

  // Report diagnostics
  React.useEffect(() => {
    if (onDiagnosticsUpdate) {
      onDiagnosticsUpdate({
        selectedCount: memories ? memories.length : 0,
        uniqueCount: normalizedMemories.length,
        renderedCount: normalizedMemories.length,
      });
    }
  }, [memories, normalizedMemories, onDiagnosticsUpdate]);

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

  const getDensitySpacing = () => {
    if (settings.density === "compact") return "space-y-4";
    if (settings.density === "spacious") return "space-y-8";
    return "space-y-6";
  };

  const getFontSizeClass = () => {
    if (settings.fontSize === "small") return "text-xs";
    if (settings.fontSize === "large") return "text-base";
    return "text-sm";
  };

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

  return (
    <div
      className={`zakir-print-document-content w-full bg-white text-slate-900 ${getFontSizeClass()}`}
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
      }}
    >
      {/* Institutional Header */}
      <PrintHeader settings={settings} lang={lang} />

      {/* Memory Cards Flow Container */}
      <main className={`${getDensitySpacing()} my-4`}>
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
              className="zakir-print-memory-card border border-slate-300 rounded-xl p-5 bg-white shadow-xs relative break-inside-auto print:shadow-none print:border-slate-300"
              style={{
                backgroundColor: "#ffffff",
                color: "#0f172a",
              }}
            >
              {/* Exclusion Button (Screen preview only) */}
              {onExcludeMemory && !isPrinting && (
                <button
                  type="button"
                  onClick={() => onExcludeMemory(m.id)}
                  className="no-print absolute top-3 end-3 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer"
                  title={lang === "ar" ? "استبعاد هذه الذكرى من التقرير" : "Exclude memory from report"}
                >
                  ✕
                </button>
              )}

              {/* Header: Title, Category, Risk Level */}
              <div className="flex items-start justify-between gap-3 mb-3 border-b border-slate-100 pb-2.5 break-inside-avoid">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-black text-[#0075DE] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {m.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {cleanTitle || m.title}
                  </h3>
                </div>

                {/* Risk Badge */}
                {settings.showRiskBadges && (
                  <span
                    className={`risk-badge px-2.5 py-1 rounded text-[10px] font-extrabold border shrink-0 ${getRiskBadgeColor(
                      m.riskLevel
                    )}`}
                  >
                    {getRiskLabel(m.riskLevel)}
                  </span>
                )}
              </div>

              {/* Main Description */}
              {cleanDesc && (
                <div className="text-slate-800 leading-relaxed font-medium mb-3 whitespace-pre-line text-[13px]">
                  {cleanDesc}
                </div>
              )}

              {/* Core Strategic Decision */}
              {cleanDecision && (
                <div className="decision-box mb-3 p-3.5 bg-slate-50 border-s-4 border-[#0075DE] rounded-e-lg break-inside-avoid">
                  <strong className="block text-xs font-extrabold text-[#0075DE] mb-1">
                    {lang === "ar" ? "القرار الاستراتيجي المعتمد:" : "Approved Strategic Decision:"}
                  </strong>
                  <p className="text-xs text-slate-900 font-semibold whitespace-pre-line leading-relaxed">
                    {cleanDecision}
                  </p>
                </div>
              )}

              {/* Causal Factors */}
              {settings.showCausalFactors && cleanCausal && (
                <div className="mb-3 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">
                    {lang === "ar" ? "المسببات والعوامل المباشرة:" : "Causal Factors & Root Causes:"}
                  </span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    {cleanCausal}
                  </p>
                </div>
              )}

              {/* Outcomes */}
              {settings.showOutcomes && cleanOutcomes && (
                <div className="mb-3 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">
                    {lang === "ar" ? "النتائج والأثر المترتب:" : "Direct Outcomes & Impact:"}
                  </span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    {cleanOutcomes}
                  </p>
                </div>
              )}

              {/* Lessons Learned */}
              {settings.showLessonsLearned && cleanLessons && (
                <div className="mb-3 text-xs">
                  <span className="font-bold text-emerald-900 block mb-1">
                    {lang === "ar" ? "الدروس المستفادة للتطوير المستقبلي:" : "Key Lessons & Actionable Insights:"}
                  </span>
                  <p className="text-emerald-950 bg-emerald-50/70 p-2.5 rounded border border-emerald-200 font-medium leading-relaxed">
                    {cleanLessons}
                  </p>
                </div>
              )}

              {/* Footer Metadata & Tags */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
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
                        className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-mono border border-slate-200"
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

      {/* Official Signature Section */}
      <PrintSignature settings={settings} lang={lang} />

      {/* Institutional Footer */}
      <PrintFooter settings={settings} lang={lang} />
    </div>
  );
};
