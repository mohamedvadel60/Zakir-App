import React, { useMemo } from "react";
import {
  FileText,
  ShieldAlert,
  Compass,
  CheckCircle,
  TrendingUp,
  ExternalLink,
  Layers,
  Info,
  AlertCircle,
  RefreshCw,
  Building2,
  Sparkles,
  ChevronRight,
  Database,
  BarChart2,
} from "lucide-react";

export interface AIResponseData {
  executiveSummary?: string;
  summary?: string;
  keyInsights?: string[];
  findings?: Array<{
    title: string;
    description?: string;
    evidence?: string;
    severity?: "Critical" | "High" | "Medium" | "Low";
  }>;
  detectedPatterns?: string[];
  evidence?: Array<{
    id?: string;
    title: string;
    type?: string;
    source?: string;
    detail?: string;
  }>;
  diagnosis?: {
    title?: string;
    description?: string;
    causalFactors?: string[];
    strategicImplications?: string[];
  };
  recommendations?: Array<{
    title: string;
    description?: string;
    priority?: "Critical" | "High" | "Medium" | "Low";
    timeframe?: string;
    actionable?: string;
  }>;
  recommendationsList?: any[];
  risksList?: any[];
  opportunitiesList?: any[];
  forecastsList?: any[];
  priorities?: any[];
  strategicOptions?: any[];
  confidenceLevel?: string;
  confidenceScore?: number;
  uncertaintyNotes?: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
}

export interface AIResponseProps {
  data?: AIResponseData | string | null;
  text?: string | null;
  theme?: "dark" | "light";
  lang?: "ar" | "en" | "fr";
  variant?: "full" | "chat" | "card" | "compact";
  isLoading?: boolean;
  error?: string | boolean | null;
  onRetry?: () => void;
  showExecutiveHeader?: boolean;
  title?: string;
  className?: string;
}

/**
 * Strips all raw Markdown syntax (#, ##, **, *, ---, emojis) from raw AI text strings
 */
export function sanitizeAIText(text: string | null | undefined): string {
  if (!text) return "";
  let cleaned = text.trim();

  // Remove internal reasoning/thought tags
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleaned = cleaned.replace(/\[SYSTEM_PROMPT[\s\S]*?\]/gi, "");
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, "");
  cleaned = cleaned.replace(/```[\s\S]*?```/gi, "");

  // Remove all emojis (Part 7: No emojis, stars, rockets, robots)
  cleaned = cleaned.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|⭐|🚀|💡|⚠️|🔥|✅|❌|📊|🤖|🎯|📌|🔹|🔸|⚡|✨|🛡️/gu,
    ""
  );

  // Normalize Markdown syntax into clean plain text for UI rendering
  cleaned = cleaned.replace(/^#{1,6}\s*/gm, ""); // strip headings #
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1"); // strip bold **
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1"); // strip italic *
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1"); // strip code ticks
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, ""); // strip bullet list symbols
  cleaned = cleaned.replace(/^[0-9]+\.\s+/gm, ""); // strip numbered list prefixes
  cleaned = cleaned.replace(/^>\s+/gm, ""); // strip blockquote symbols
  cleaned = cleaned.replace(/^---$/gm, ""); // strip horizontal rules

  return cleaned.trim();
}

/**
 * Formats Bidi text (numbers, Latin codes, currency) safely in Arabic RTL
 */
export const BidiText: React.FC<{ text: string; isAr?: boolean }> = ({
  text,
  isAr = true,
}) => {
  if (!isAr || !text) return <span>{text}</span>;
  const parts = text.split(/([A-Za-z0-9\-_./%]+(?:\s*[A-Za-z0-9\-_./%]+)*)/);
  return (
    <span>
      {parts.map((part, idx) => {
        const isLatinOrNumeric = /^[A-Za-z0-9\-_./%]+$/.test(part.trim());
        if (isLatinOrNumeric && part.trim().length > 0) {
          return (
            <span
              key={idx}
              dir="ltr"
              className="inline-block font-sans font-medium px-0.5"
              style={{ unicodeBidi: "isolate" }}
            >
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
};

export const AIResponse: React.FC<AIResponseProps> = ({
  data,
  text,
  theme = "dark",
  lang = "ar",
  variant = "full",
  isLoading = false,
  error = null,
  onRetry,
  showExecutiveHeader = false,
  title,
  className = "",
}) => {
  const isDark = theme === "dark";
  const isAr = lang === "ar";

  // Loading State
  if (isLoading) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`p-6 rounded-2xl border transition-all ${
          isDark
            ? "bg-slate-900/40 border-slate-800"
            : "bg-white border-slate-200 shadow-sm"
        } ${className}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#0075DE]/10 text-[#0075DE] animate-pulse">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider">
              {isAr ? "محرك التحليل الإدراكي" : "Organizational Intelligence Engine"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 animate-pulse">
              {isAr
                ? "جارٍ تحليل بيانات المؤسسة ونمذجة المؤشرات السببية..."
                : "Analyzing organizational data and modeling causal factors..."}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-800/40 dark:bg-slate-800/60 rounded-md w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-800/30 dark:bg-slate-800/40 rounded-md w-full animate-pulse" />
          <div className="h-4 bg-slate-800/30 dark:bg-slate-800/40 rounded-md w-5/6 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error State (Institutional Error Handling without exposing secrets/stack traces)
  if (error) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`p-5 rounded-2xl border ${
          isDark
            ? "bg-slate-900/40 border-slate-800"
            : "bg-slate-50 border-slate-200"
        } ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400 mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-200 dark:text-slate-100">
              {isAr
                ? "تعذر إتمام التحليل الاستراتيجي حالياً"
                : "AI Analysis Unavailable"}
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {isAr
                ? "لم تتمكن منصة ذَكِرْ من إتمام هذا التحليل في الوقت الحالي. يرجى إعادة المحاولة."
                : "ZAKIR could not complete this analysis at the moment. Please try again."}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0075DE] hover:bg-[#0062BD] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isAr ? "إعادة المحاولة" : "Try Again"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Parse structured data or convert raw text
  const structured: AIResponseData = useMemo(() => {
    if (typeof data === "object" && data !== null) {
      return data as AIResponseData;
    }
    const rawString = text || (typeof data === "string" ? data : "");
    if (!rawString) return {};

    // Check if rawString is JSON
    try {
      const clean = rawString.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as AIResponseData;
      }
    } catch {}

    // Fallback: raw text converted to structured object
    return {
      executiveSummary: sanitizeAIText(rawString),
    };
  }, [data, text]);

  const execSummary = structured.executiveSummary || structured.summary || "";
  const keyInsights = structured.keyInsights || [];
  const detectedPatterns = structured.detectedPatterns || [];
  const recommendations =
    structured.recommendationsList || structured.recommendations || [];
  const risks = structured.risksList || [];
  const opportunities = structured.opportunitiesList || [];
  const confidence = structured.confidenceLevel || (structured.confidenceScore ? `${structured.confidenceScore}%` : null);
  const sources = structured.sources || [];

  if (!execSummary && keyInsights.length === 0 && recommendations.length === 0) {
    return null;
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`space-y-4 ${isAr ? "text-right" : "text-left"} ${className}`}
    >
      {/* Optional Executive Header */}
      {showExecutiveHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0075DE]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0075DE]">
              {title ||
                (isAr
                  ? "مخرجات التحليل المؤسسي"
                  : "Institutional Intelligence Output")}
            </h3>
          </div>
          {confidence && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
              {isAr ? `درجة الثقة: ${confidence}` : `Confidence: ${confidence}`}
            </span>
          )}
        </div>
      )}

      {/* Executive Summary Block */}
      {execSummary && (
        <div
          className={`p-4 rounded-xl border ${
            isDark
              ? "bg-slate-900/40 border-slate-800/80"
              : "bg-white border-slate-200 shadow-xs"
          } ${isAr ? "border-r-4 border-r-[#0075DE]" : "border-l-4 border-l-[#0075DE]"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0075DE]" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {isAr ? "الملخص التنفيذي" : "Executive Summary"}
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            <BidiText text={execSummary} isAr={isAr} />
          </p>
        </div>
      )}

      {/* Key Findings & Insights */}
      {keyInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#0075DE]" />
            <span>{isAr ? "النتائج والاستنتاجات الرئيسية" : "Key Findings"}</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {keyInsights.map((ki, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs leading-relaxed ${
                  isDark
                    ? "bg-slate-900/30 border-slate-800 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <BidiText text={sanitizeAIText(ki)} isAr={isAr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detected Causal Patterns */}
      {detectedPatterns.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>{isAr ? "الأنماط والروابط السببية" : "Causal Patterns"}</span>
          </h4>
          <div className="space-y-2">
            {detectedPatterns.map((pat, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs ${
                  isDark
                    ? "bg-blue-950/20 border-blue-900/40 text-slate-300"
                    : "bg-blue-50/50 border-blue-200 text-slate-800"
                }`}
              >
                <BidiText text={sanitizeAIText(pat)} isAr={isAr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks List */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>{isAr ? "المخاطر والانكشافات المحتملة" : "Identified Risks"}</span>
          </h4>
          <div className="space-y-2">
            {risks.map((item: any, idx: number) => {
              const rTitle = typeof item === "string" ? item : item.title || "";
              const rDetail = typeof item === "string" ? "" : item.details || item.description || "";
              const rSev = typeof item === "string" ? null : item.severity || item.priority;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start gap-3 ${
                    isDark
                      ? "bg-rose-950/10 border-rose-900/30 text-slate-300"
                      : "bg-rose-50/30 border-rose-200 text-slate-800"
                  }`}
                >
                  <div className="p-1 rounded bg-rose-500/10 text-rose-500 flex-shrink-0 mt-0.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-slate-100 dark:text-white">
                        <BidiText text={sanitizeAIText(rTitle)} isAr={isAr} />
                      </h5>
                      {rSev && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {rSev}
                        </span>
                      )}
                    </div>
                    {rDetail && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <BidiText text={sanitizeAIText(rDetail)} isAr={isAr} />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations List */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-[#0075DE]" />
            <span>{isAr ? "التوصيات والإجراءات التنفيذية" : "Recommendations"}</span>
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec: any, idx: number) => {
              const titleStr = typeof rec === "string" ? rec : rec.title || "";
              const detailStr = typeof rec === "string" ? "" : rec.details || rec.actionable || rec.description || "";
              const prio = typeof rec === "string" ? null : rec.priority;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start gap-3 ${
                    isDark
                      ? "bg-slate-900/40 border-slate-800"
                      : "bg-white border-slate-200 shadow-xs"
                  }`}
                >
                  <div className="p-1 rounded bg-[#0075DE]/10 text-[#0075DE] flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        <BidiText text={sanitizeAIText(titleStr)} isAr={isAr} />
                      </h5>
                      {prio && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
                          {prio}
                        </span>
                      )}
                    </div>
                    {detailStr && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <BidiText text={sanitizeAIText(detailStr)} isAr={isAr} />
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* External Grounding Sources */}
      {sources.length > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 text-[#0075DE]" />
            <span>{isAr ? "المصادر الموثوقة" : "Sources"}</span>
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0075DE]/10 hover:bg-[#0075DE]/20 text-[#0075DE] text-[11px] font-bold border border-[#0075DE]/20 transition-colors no-underline"
              >
                <span>{src.title}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
