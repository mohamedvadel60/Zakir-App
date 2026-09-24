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
  Building2,
  Sparkles,
  ChevronRight,
  Globe,
  Award,
  Scale,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { AIResponse, AIResponseData } from "./AIResponse";

export { AIResponse };
export type { AIResponseData };

export interface StructuredAIReport {
  title?: string;
  advisorType?: "cognitive" | "administrative" | "unified" | "market" | "evolution";
  executiveSummary?: string;
  facts?: Array<{ title?: string; detail: string; category?: string }>;
  inferences?: Array<{ title?: string; detail: string }>;
  recommendations?: Array<{
    title?: string;
    detail: string;
    priority?: "Critical" | "High" | "Medium" | "Low";
    timeframe?: string;
  }>;
  risks?: Array<{ title: string; severity?: string; detail?: string }>;
  patterns?: string[];
  evidence?: Array<{ title: string; source?: string; detail?: string }>;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  rawSections?: Array<{ title: string; items: string[]; iconType?: string }>;
}

export interface ExecutiveReportFormatterProps {
  content: string | AIResponseData | StructuredAIReport | undefined | null;
  theme?: "dark" | "light";
  lang?: "ar" | "en" | "fr";
  variant?: "report" | "chat" | "card" | "inline";
  className?: string;
  showExecutiveHeader?: boolean;
  title?: string;
}

/**
 * Pre-processes and sanitizes raw AI outputs, removing prompt residues,
 * stray Markdown asterisks, unrendered brackets, raw JSON traces, and normalizing URLs/bidi text.
 * Strictly enforces ZERO emojis and zero raw Markdown leftovers.
 */
export function sanitizeAndCleanAIContent(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text.trim();

  // 1. Remove internal reasoning/thought tags and traces
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleaned = cleaned.replace(/\[SYSTEM_PROMPT[\s\S]*?\]/gi, "");
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"tool_call"[\s\S]*?\}\s*```/gi, "");
  cleaned = cleaned.replace(/```json[\s\S]*?```/gi, "");
  cleaned = cleaned.replace(/```[\s\S]*?```/gi, "");

  // 2. Remove all emojis (Strict Zero Emojis / Stars / Icons policy)
  cleaned = cleaned.replace(
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|⭐|🚀|💡|⚠️|🔥|✅|❌|📊|🤖|🎯|📌|🔹|🔸|⚡|✨|🛡️|🔍|📈|📉|📋/gu,
    ""
  );

  // 3. Remove stray or unbalanced Markdown formatting tokens
  cleaned = cleaned.replace(/\*{3,}/g, "**");
  cleaned = cleaned.replace(/^(\s*)\*\s*([^\*\n]+)\s*\*(\s*)$/gm, "$1$2$3");
  cleaned = cleaned.replace(/\{"analysisId":[\s\S]*?\}$/gi, "");

  return cleaned.trim();
}

/**
 * Clean a single line of text, stripping raw markdown symbols (**bold**, *item*, brackets, ticks).
 */
export function cleanRawTextLine(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[#\*\-\s•\d\.\)]+/, "")
    .trim();
}

/**
 * Highlights and wraps numbers, Latin terms, currencies, and technical acronyms
 * with unicode-bidi isolation to prevent RTL/LTR punctuation flipping in Arabic.
 */
export const FormattedBidiSpan: React.FC<{ text: string; isAr?: boolean }> = ({
  text,
  isAr = true,
}) => {
  if (!isAr || !text) return <span>{text}</span>;

  // Regex matches Latin acronyms/words, numbers with decimals/percentages/slashes
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

/**
 * Structured JSON-based parser to transform raw model text / JSON into a clean,
 * institutional domain schema.
 */
export function parseAIOutputToStructured(
  rawInput: string | AIResponseData | StructuredAIReport | null | undefined
): StructuredAIReport {
  if (!rawInput) return {};

  // Case 1: Already an object
  if (typeof rawInput === "object" && rawInput !== null) {
    const obj = rawInput as any;
    if (obj.facts || obj.inferences || obj.rawSections) {
      return obj as StructuredAIReport;
    }
    return {
      executiveSummary: obj.executiveSummary || obj.summary || "",
      facts: obj.findings?.map((f: any) => ({
        title: f.title,
        detail: f.description || f.evidence || "",
      })) || [],
      recommendations: obj.recommendations?.map((r: any) => ({
        title: typeof r === "string" ? cleanRawTextLine(r) : r.title,
        detail: typeof r === "string" ? r : r.description || r.actionable || "",
        priority: r.priority,
        timeframe: r.timeframe,
      })) || (obj.recommendationsList || []).map((r: any) => ({
        title: typeof r === "string" ? cleanRawTextLine(r) : r.title,
        detail: typeof r === "string" ? r : r.description || r.action || "",
      })),
      patterns: obj.detectedPatterns || [],
      sources: obj.sources || [],
    };
  }

  const text = typeof rawInput === "string" ? sanitizeAndCleanAIContent(rawInput) : "";
  if (!text) return {};

  // Case 2: Attempt parsing JSON string
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === "object" && parsed !== null) {
        return parseAIOutputToStructured(parsed);
      }
    }
  } catch {}

  // Case 3: Parse structured text sections (Facts, Inferences, Recommendations, etc.)
  const report: StructuredAIReport = {
    facts: [],
    inferences: [],
    recommendations: [],
    patterns: [],
    sources: [],
    rawSections: [],
  };

  const lines = text.split("\n");
  let currentSection = "summary";
  let currentTitle = "";
  let summaryParagraphs: string[] = [];
  let currentSectionItems: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine === "---") continue;

    // Detect Section Headers
    const isHeading =
      rawLine.startsWith("#") ||
      rawLine.startsWith("###") ||
      rawLine.includes("الحقيقة") ||
      rawLine.includes("الحقائق") ||
      rawLine.includes("Fact") ||
      rawLine.includes("الاستنتاج") ||
      rawLine.includes("Inference") ||
      rawLine.includes("التوصيات") ||
      rawLine.includes("Recommendation") ||
      rawLine.includes("المخاطر") ||
      rawLine.includes("الأنماط") ||
      rawLine.includes("الدروس");

    if (isHeading && (rawLine.startsWith("#") || rawLine.length < 80)) {
      const cleanH = cleanRawTextLine(rawLine);
      const lower = cleanH.toLowerCase();

      // Save previous section if it was a custom raw section
      if (currentSection === "custom" && currentSectionItems.length > 0) {
        report.rawSections?.push({
          title: currentTitle || "قسم تحليلي",
          items: [...currentSectionItems],
        });
        currentSectionItems = [];
      }

      if (lower.includes("حقيقة") || lower.includes("حقائق") || lower.includes("fact")) {
        currentSection = "facts";
      } else if (
        lower.includes("استنتاج") ||
        lower.includes("تحليل") ||
        lower.includes("inference")
      ) {
        currentSection = "inferences";
      } else if (
        lower.includes("توصي") ||
        lower.includes("ضوابط") ||
        lower.includes("إجراء") ||
        lower.includes("recommend")
      ) {
        currentSection = "recommendations";
      } else if (lower.includes("نمط") || lower.includes("أنماط") || lower.includes("pattern")) {
        currentSection = "patterns";
      } else if (
        lower.includes("مستشار") ||
        lower.includes("ملخص") ||
        lower.includes("تقرير") ||
        lower.includes("summary")
      ) {
        currentSection = "summary";
        if (cleanH.includes("المستشار الإداري")) report.advisorType = "administrative";
        else if (cleanH.includes("الموحد")) report.advisorType = "unified";
        else if (cleanH.includes("الإدراكي")) report.advisorType = "cognitive";
      } else {
        currentSection = "custom";
        currentTitle = cleanH;
      }
      continue;
    }

    // Process Content by Current Section
    if (currentSection === "summary") {
      summaryParagraphs.push(rawLine);
    } else if (currentSection === "facts") {
      const cleanItem = rawLine.replace(/^[\*\-\d\.\)]+\s*/, "").trim();
      if (cleanItem) {
        // Extract Title: Detail if present
        const matchColon = cleanItem.match(/^\*\*?([^\*:]+)\*\*?:\s*(.*)$/);
        if (matchColon) {
          report.facts?.push({
            title: cleanRawTextLine(matchColon[1]),
            detail: matchColon[2] || matchColon[1],
          });
        } else {
          report.facts?.push({
            detail: cleanItem,
          });
        }
      }
    } else if (currentSection === "inferences") {
      const cleanItem = rawLine.replace(/^[\*\-\d\.\)]+\s*/, "").trim();
      if (cleanItem) {
        report.inferences?.push({
          detail: cleanItem,
        });
      }
    } else if (currentSection === "recommendations") {
      const cleanItem = rawLine.replace(/^[\*\-\d\.\)]+\s*/, "").trim();
      if (cleanItem) {
        const matchColon = cleanItem.match(/^\*\*?([^\*:]+)\*\*?:\s*(.*)$/);
        if (matchColon) {
          report.recommendations?.push({
            title: cleanRawTextLine(matchColon[1]),
            detail: matchColon[2] || matchColon[1],
          });
        } else {
          report.recommendations?.push({
            detail: cleanItem,
          });
        }
      }
    } else if (currentSection === "patterns") {
      const cleanItem = rawLine.replace(/^[\*\-\d\.\)]+\s*/, "").trim();
      if (cleanItem) report.patterns?.push(cleanItem);
    } else if (currentSection === "custom") {
      const cleanItem = rawLine.replace(/^[\*\-\d\.\)]+\s*/, "").trim();
      if (cleanItem) currentSectionItems.push(cleanItem);
    }
  }

  if (currentSection === "custom" && currentSectionItems.length > 0) {
    report.rawSections?.push({
      title: currentTitle || "قسم تحليلي",
      items: currentSectionItems,
    });
  }

  report.executiveSummary = summaryParagraphs.join("\n\n");
  return report;
}

/**
 * Main Executive AI Report Formatter Component.
 * Transforms raw model output into an institutional, card-structured presentation.
 */
export const ExecutiveAIReportFormatter: React.FC<ExecutiveReportFormatterProps> = ({
  content,
  theme = "dark",
  lang = "ar",
  variant = "report",
  className = "",
  showExecutiveHeader = false,
  title,
}) => {
  const isDark = theme === "dark";
  const isAr = lang === "ar";

  const structured = useMemo(() => parseAIOutputToStructured(content), [content]);

  const hasFacts = structured.facts && structured.facts.length > 0;
  const hasInferences = structured.inferences && structured.inferences.length > 0;
  const hasRecs = structured.recommendations && structured.recommendations.length > 0;
  const hasPatterns = structured.patterns && structured.patterns.length > 0;
  const hasCustomSections = structured.rawSections && structured.rawSections.length > 0;
  const hasSummary = Boolean(structured.executiveSummary && structured.executiveSummary.trim().length > 0);

  if (!hasSummary && !hasFacts && !hasInferences && !hasRecs && !hasCustomSections) {
    return null;
  }

  // Inline variant for compact card rendering
  if (variant === "inline") {
    const rawText =
      typeof content === "string"
        ? cleanRawTextLine(content)
        : structured.executiveSummary || "";
    return (
      <span className={className}>
        <FormattedBidiSpan text={rawText} isAr={isAr} />
      </span>
    );
  }

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`executive-report-root space-y-4 ${isAr ? "text-right" : "text-left"} ${className}`}
    >
      {/* Optional Top Executive Header */}
      {showExecutiveHeader && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0075DE]/10 text-[#0075DE]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0075DE]">
                {title || (isAr ? "التقرير الاستراتيجي المؤسسي" : "Strategic Intelligence Report")}
              </h3>
              <p className="text-[10px] text-slate-400">
                {isAr ? "مستند إلى سجلات الذاكرة المؤسسية والبيانات المؤكدة" : "Grounded in verified institutional memory"}
              </p>
            </div>
          </div>
          {structured.advisorType && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20">
              {structured.advisorType === "administrative"
                ? isAr
                  ? "مستشار إداري"
                  : "Administrative Advisor"
                : structured.advisorType === "unified"
                ? isAr
                  ? "مستشار موحد"
                  : "Unified Advisor"
                : isAr
                ? "مستشار إدراكي"
                : "Cognitive Advisor"}
            </span>
          )}
        </div>
      )}

      {/* 1. Executive Summary Block */}
      {hasSummary && (
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark
              ? "bg-slate-900/50 border-slate-800/90 text-slate-200"
              : "bg-white border-slate-200 text-slate-800 shadow-xs"
          } ${isAr ? "border-r-4 border-r-[#0075DE]" : "border-l-4 border-l-[#0075DE]"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-[#0075DE]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {isAr ? "الملخص التنفيذي" : "Executive Summary"}
            </h4>
          </div>
          <div className="text-xs leading-relaxed space-y-2 text-slate-700 dark:text-slate-300">
            {structured.executiveSummary?.split("\n\n").map((para, pIdx) => (
              <p key={pIdx} className="m-0">
                <FormattedBidiSpan text={cleanRawTextLine(para)} isAr={isAr} />
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 2. Structured Facts Section (الحقائق المثبتة) */}
      {hasFacts && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500">
              <Database className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {isAr ? "1. الحقائق والوقائع المسجلة" : "1. Verified Facts"}
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {structured.facts?.map((f, fIdx) => (
              <div
                key={fIdx}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                  isDark
                    ? "bg-slate-900/40 border-slate-800/80 hover:border-emerald-500/30"
                    : "bg-emerald-50/30 border-emerald-100/80 text-slate-800 shadow-xs"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  {f.title && (
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      <FormattedBidiSpan text={cleanRawTextLine(f.title)} isAr={isAr} />
                    </div>
                  )}
                  <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <FormattedBidiSpan text={cleanRawTextLine(f.detail)} isAr={isAr} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Cognitive Inferences Section (الاستنتاجات الإدراكية) */}
      {hasInferences && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-blue-500/10 text-blue-500">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500">
              {isAr ? "2. الاستنتاجات الإدراكية والأثر" : "2. Cognitive Inferences"}
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {structured.inferences?.map((inf, iIdx) => (
              <div
                key={iIdx}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                  isDark
                    ? "bg-slate-900/40 border-slate-800/80 hover:border-blue-500/30"
                    : "bg-blue-50/30 border-blue-100/80 text-slate-800 shadow-xs"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <FormattedBidiSpan text={cleanRawTextLine(inf.detail)} isAr={isAr} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Actionable Recommendations Section (التوصيات الاستباقية) */}
      {hasRecs && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-[#0075DE]/10 text-[#0075DE]">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0075DE]">
              {isAr ? "3. التوصيات والضوابط الاستباقية" : "3. Actionable Recommendations"}
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {structured.recommendations?.map((r, rIdx) => (
              <div
                key={rIdx}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  isDark
                    ? "bg-slate-900/40 border-slate-800/80 hover:border-[#0075DE]/40"
                    : "bg-white border-slate-200 text-slate-800 shadow-xs hover:border-[#0075DE]/30"
                }`}
              >
                <div className="p-1 rounded-lg bg-[#0075DE]/10 text-[#0075DE] flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold px-1">{rIdx + 1}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  {r.title && (
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      <FormattedBidiSpan text={cleanRawTextLine(r.title)} isAr={isAr} />
                    </div>
                  )}
                  <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    <FormattedBidiSpan text={cleanRawTextLine(r.detail)} isAr={isAr} />
                  </div>
                  {r.timeframe && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      {isAr ? `الإطار الزمني: ${r.timeframe}` : `Timeframe: ${r.timeframe}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Detected Patterns */}
      {hasPatterns && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-purple-500/10 text-purple-500">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500">
              {isAr ? "الأنماط المؤسسية المكتشفة" : "Detected Patterns"}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {structured.patterns?.map((pat, pIdx) => (
              <div
                key={pIdx}
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  isDark
                    ? "bg-slate-900/30 border-slate-800 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <FormattedBidiSpan text={cleanRawTextLine(pat)} isAr={isAr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Custom Analytic Sections */}
      {hasCustomSections &&
        structured.rawSections?.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-2">
            <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider flex items-center gap-1.5">
              <ChevronRight className={`w-3.5 h-3.5 text-[#0075DE] ${isAr ? "rotate-180" : ""}`} />
              <span>{sec.title}</span>
            </h4>
            <div className="space-y-1.5">
              {sec.items.map((item, itIdx) => (
                <div
                  key={itIdx}
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    isDark
                      ? "bg-slate-900/30 border-slate-800 text-slate-300"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <FormattedBidiSpan text={cleanRawTextLine(item)} isAr={isAr} />
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

/**
 * Executive Clean Card for List Items (Risks, Opportunities, Trends, Recommendations)
 */
export const ExecutiveListItemCard: React.FC<{
  text: string;
  theme?: "dark" | "light";
  lang?: "ar" | "en" | "fr";
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: "blue" | "emerald" | "rose" | "amber";
  badge?: string;
  priority?: string;
  impact?: string;
}> = ({
  text,
  theme = "dark",
  lang = "ar",
  icon: Icon = FileText,
  accentColor = "blue",
  badge,
  priority,
  impact,
}) => {
  const isDark = theme === "dark";
  const isAr = lang === "ar";

  // Parse if string has "**Title:** Details" format
  const colonMatch = text.match(/^\s*\*\*?([^\*:]+)\*\*?:\s*(.*)$/);
  const title = colonMatch ? cleanRawTextLine(colonMatch[1]) : null;
  const detail = colonMatch ? cleanRawTextLine(colonMatch[2]) : cleanRawTextLine(text);

  const colorStyles = {
    blue: {
      bg: isDark
        ? "bg-slate-900/40 border-slate-800/80 hover:border-[#0075DE]/40"
        : "bg-white border-slate-200 shadow-xs hover:border-[#0075DE]/40",
      iconBg: "bg-[#0075DE]/10 text-[#0075DE]",
      dot: "bg-[#0075DE]",
    },
    emerald: {
      bg: isDark
        ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30"
        : "bg-emerald-50/40 border-emerald-100 shadow-xs hover:border-emerald-300",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      dot: "bg-emerald-500",
    },
    rose: {
      bg: isDark
        ? "bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30"
        : "bg-rose-50/40 border-rose-100 shadow-xs hover:border-rose-300",
      iconBg: "bg-rose-500/10 text-rose-500",
      dot: "bg-rose-500",
    },
    amber: {
      bg: isDark
        ? "bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30"
        : "bg-amber-50/40 border-amber-100 shadow-xs hover:border-amber-300",
      iconBg: "bg-amber-500/10 text-amber-500",
      dot: "bg-amber-500",
    },
  }[accentColor];

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`p-3.5 rounded-xl border transition-all ${colorStyles.bg} flex items-start gap-3`}
    >
      <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${colorStyles.iconBg}`}>
        {React.createElement(Icon, { className: "w-4 h-4" })}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h5 className="text-xs font-bold text-slate-900 dark:text-white">
              <FormattedBidiSpan text={title} isAr={isAr} />
            </h5>
          ) : null}

          {badge && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400">
              {badge}
            </span>
          )}
          {priority && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                priority === "Critical"
                  ? "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                  : "bg-amber-500/15 text-amber-500"
              }`}
            >
              {priority}
            </span>
          )}
        </div>

        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <FormattedBidiSpan text={detail} isAr={isAr} />
        </div>

        {impact && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px] text-emerald-500 font-medium">
            {isAr ? `الأثر المتوقع: ${impact}` : `Expected Impact: ${impact}`}
          </div>
        )}
      </div>
    </div>
  );
};
