import React, { useMemo } from "react";
import Markdown from "react-markdown";
import {
  ExternalLink,
  ShieldAlert,
  Compass,
  CheckCircle,
  TrendingUp,
  FileText,
  Sparkles,
  Info,
  Scale,
  Building2,
  ChevronRight,
  Globe,
  Layers,
  Award,
} from "lucide-react";

interface ExecutiveReportFormatterProps {
  content: string | undefined | null;
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
 */
export function sanitizeAndCleanAIContent(text: string | null | undefined): string {
  if (!text) return "";

  let cleaned = text.trim();

  // 1. Remove internal reasoning/thought tags and traces
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleaned = cleaned.replace(/\[SYSTEM_PROMPT[\s\S]*?\]/gi, "");
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"tool_call"[\s\S]*?\}\s*```/gi, "");

  // 2. Remove broken or stray markdown asterisks that fail to form proper pairs
  // Normalize triple asterisks to standard bold
  cleaned = cleaned.replace(/\*{3,}/g, "**");

  // Fix unbalanced single/double asterisks at line boundaries
  cleaned = cleaned.replace(/^(\s*)\*\s*([^\*\n]+)\s*\*(\s*)$/gm, "$1$2$3");

  // Clean raw brackets around headers
  cleaned = cleaned.replace(/^#+\s*\[(.*?)\]\s*$/gm, "### $1");

  // Remove trailing internal metadata or JSON fragments at the very end of messages
  cleaned = cleaned.replace(/\{"analysisId":[\s\S]*?\}$/gi, "");

  return cleaned.trim();
}

/**
 * Clean a single line of text (e.g. for badges, titles, table cells, or lists)
 * completely removing raw markdown symbols (**bold**, *item*, brackets).
 */
export function cleanRawTextLine(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[#\*\-\s•]+/, "")
    .trim();
}

/**
 * Highlights and wraps numbers, Latin terms, currencies, and technical acronyms
 * with unicode-bidi isolation to prevent RTL/LTR punctuation flipping in Arabic.
 */
export const FormattedBidiSpan: React.FC<{ text: string; isAr?: boolean }> = ({ text, isAr = true }) => {
  if (!isAr || !text) return <span>{text}</span>;

  // Regex matches Latin acronyms/words, numbers with decimals/percentages/slashes, currencies (e.g. BCM, MRU, 4.5%, 7.8/10, GTA, API)
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
 * Main Executive AI Report Formatter Component
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

  const sanitizedContent = useMemo(() => sanitizeAndCleanAIContent(content), [content]);

  if (!sanitizedContent) {
    return null;
  }

  // Section icon resolver
  const getSectionIcon = (headingText: string) => {
    const lower = headingText.toLowerCase();
    if (lower.includes("نطاق") || lower.includes("بيئة") || lower.includes("scope") || lower.includes("macro")) {
      return <Globe className="w-4 h-4 text-[#0075DE]" />;
    }
    if (lower.includes("ديناميك") || lower.includes("طلب") || lower.includes("dynamic") || lower.includes("trend")) {
      return <TrendingUp className="w-4 h-4 text-blue-500" />;
    }
    if (lower.includes("أدلة") || lower.includes("ذاكرة") || lower.includes("evidence") || lower.includes("memory")) {
      return <Layers className="w-4 h-4 text-emerald-500" />;
    }
    if (lower.includes("بحث") || lower.includes("search") || lower.includes("حصة") || lower.includes("quota")) {
      return <Info className="w-4 h-4 text-amber-500" />;
    }
    if (lower.includes("خطر") || lower.includes("مخاطر") || lower.includes("risk") || lower.includes("threat")) {
      return <ShieldAlert className="w-4 h-4 text-rose-500" />;
    }
    if (lower.includes("فرص") || lower.includes("opportunity") || lower.includes("growth")) {
      return <Compass className="w-4 h-4 text-emerald-500" />;
    }
    if (lower.includes("توصي") || lower.includes("إجراء") || lower.includes("recommend") || lower.includes("action")) {
      return <CheckCircle className="w-4 h-4 text-[#0075DE]" />;
    }
    return <FileText className="w-4 h-4 text-[#0075DE]" />;
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`executive-ai-report-container ${isAr ? "text-right" : "text-left"} ${className}`}
    >
      {showExecutiveHeader && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <Sparkles className="w-4 h-4 text-[#0075DE]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0075DE]">
            {title || (isAr ? "التقرير التنفيذي الاستراتيجي" : "Executive Intelligence Report")}
          </h3>
        </div>
      )}

      <div className={`prose-container max-w-none text-xs leading-relaxed ${
        isDark ? "text-slate-200" : "text-slate-800"
      }`}>
        <Markdown
          components={{
            // Headers
            h1: ({ children }) => (
              <div className="my-4 pt-2 pb-1.5 border-b border-[#0075DE]/20 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0075DE] flex-shrink-0" />
                <h1 className="text-sm md:text-base font-black text-[#0075DE] tracking-tight m-0">
                  {children}
                </h1>
              </div>
            ),
            h2: ({ children }) => (
              <div className="my-3 pt-2 pb-1 flex items-center gap-2 border-b border-slate-200/40 dark:border-slate-800/40">
                <Sparkles className="w-4 h-4 text-[#0075DE] flex-shrink-0" />
                <h2 className="text-xs md:text-sm font-bold text-[#0075DE] m-0">
                  {children}
                </h2>
              </div>
            ),
            h3: ({ children }) => {
              const textContent = String(children || "");
              const icon = getSectionIcon(textContent);
              return (
                <div className={`my-3.5 p-2.5 rounded-xl border flex items-center gap-2.5 ${
                  isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50 border-slate-200 shadow-xs"
                }`}>
                  <div className="p-1 rounded-lg bg-[#0075DE]/10 text-[#0075DE]">
                    {icon}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white m-0">
                    {children}
                  </h3>
                </div>
              );
            },
            h4: ({ children }) => (
              <h4 className="text-xs font-bold text-[#0075DE] mt-3 mb-1 flex items-center gap-1.5">
                <ChevronRight className={`w-3.5 h-3.5 text-[#0075DE] ${isAr ? "rotate-180" : ""}`} />
                <span>{children}</span>
              </h4>
            ),

            // Paragraphs
            p: ({ children }) => (
              <p className={`mb-3 last:mb-0 text-xs leading-relaxed ${
                isDark ? "text-slate-300" : "text-slate-700"
              }`}>
                {children}
              </p>
            ),

            // Strong / Bold Text
            strong: ({ children }) => (
              <strong className={`font-bold ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}>
                {children}
              </strong>
            ),

            // Unordered Lists
            ul: ({ children }) => (
              <ul className={`my-2.5 space-y-2 ${isAr ? "pr-1" : "pl-1"} list-none`}>
                {children}
              </ul>
            ),

            // Ordered Lists
            ol: ({ children }) => (
              <ol className={`my-2.5 space-y-2 ${isAr ? "pr-1" : "pl-1"} list-none counter-reset-item`}>
                {children}
              </ol>
            ),

            // List Items
            li: ({ children, node }) => {
              return (
                <li className="flex items-start gap-2.5 text-xs text-slate-300 dark:text-slate-200 leading-relaxed group">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0075DE] mt-2 flex-shrink-0 group-hover:scale-125 transition-transform" />
                  <div className="flex-1 min-w-0">
                    {children}
                  </div>
                </li>
              );
            },

            // Blockquotes
            blockquote: ({ children }) => (
              <div className={`my-3 p-3.5 rounded-xl border ${
                isAr ? "border-r-4 border-r-[#0075DE]" : "border-l-4 border-l-[#0075DE]"
              } ${
                isDark ? "bg-[#0075DE]/5 border-slate-800" : "bg-blue-50/50 border-blue-100"
              }`}>
                <div className="text-xs italic text-slate-700 dark:text-slate-300">
                  {children}
                </div>
              </div>
            ),

            // Links (Clean Badges instead of raw long URLs)
            a: ({ href, children }) => {
              let domain = "";
              try {
                if (href) {
                  const u = new URL(href);
                  domain = u.hostname.replace(/^www\./, "");
                }
              } catch {
                domain = String(children || "link");
              }

              const label = typeof children === "string" && children !== href ? children : domain || "المصدر";

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-md bg-[#0075DE]/10 hover:bg-[#0075DE]/20 text-[#0075DE] text-[11px] font-bold border border-[#0075DE]/20 transition-colors no-underline"
                >
                  <span>{label}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              );
            },

            // Tables
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-right border-collapse">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className={`${isDark ? "bg-slate-900/80 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}>
                {children}
              </tbody>
            ),
            tr: ({ children }) => (
              <tr className={`transition-colors ${isDark ? "hover:bg-slate-900/40" : "hover:bg-slate-50"}`}>
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                {children}
              </td>
            ),

            // Inline Code & Code Blocks
            code: ({ children, className }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <div className="my-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto" dir="ltr">
                    <code>{children}</code>
                  </div>
                );
              }
              return (
                <code className="px-1.5 py-0.5 rounded bg-slate-500/10 text-[#0075DE] font-mono text-[11px] border border-slate-500/20" dir="ltr">
                  {children}
                </code>
              );
            },
          }}
        >
          {sanitizedContent}
        </Markdown>
      </div>
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
  const detail = colonMatch ? colonMatch[2] : text;

  const colorStyles = {
    blue: {
      bg: isDark ? "bg-slate-900/40 border-slate-800/80 hover:border-[#0075DE]/40" : "bg-white border-slate-200 shadow-xs hover:border-[#0075DE]/40",
      iconBg: "bg-[#0075DE]/10 text-[#0075DE]",
      dot: "bg-[#0075DE]",
    },
    emerald: {
      bg: isDark ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30" : "bg-emerald-50/40 border-emerald-100 shadow-xs hover:border-emerald-300",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      dot: "bg-emerald-500",
    },
    rose: {
      bg: isDark ? "bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30" : "bg-rose-50/40 border-rose-100 shadow-xs hover:border-rose-300",
      iconBg: "bg-rose-500/10 text-rose-500",
      dot: "bg-rose-500",
    },
    amber: {
      bg: isDark ? "bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30" : "bg-amber-50/40 border-amber-100 shadow-xs hover:border-amber-300",
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
        <Icon className="w-4 h-4" />
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
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              priority === "Critical" ? "bg-rose-500/15 text-rose-500 border border-rose-500/20" : "bg-amber-500/15 text-amber-500"
            }`}>
              {priority}
            </span>
          )}
        </div>

        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <ExecutiveAIReportFormatter
            content={detail}
            theme={theme}
            lang={lang}
            variant="inline"
          />
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
