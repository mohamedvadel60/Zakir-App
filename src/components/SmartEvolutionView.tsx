import React, { useState } from "react";
import {
  ExecutiveAIReportFormatter,
  ExecutiveListItemCard,
  FormattedBidiSpan,
  cleanRawTextLine,
} from "./ExecutiveAIReportFormatter";
import {
  Brain,
  RefreshCw,
  FileText,
  ShieldAlert,
  Compass,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Search,
  Lock,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import type { SmartEvolutionData } from "../types";

interface SmartEvolutionViewProps {
  smartData: SmartEvolutionData | null;
  isSmartAnalyzing: boolean;
  runSmartAnalysis: () => Promise<void>;
  memories: any[];
  riskAlerts: any[];
  lang: "ar" | "en" | "fr";
  theme: "dark" | "light";
  workspaceName?: string;
}

export const SmartEvolutionView: React.FC<SmartEvolutionViewProps> = ({
  smartData,
  isSmartAnalyzing,
  runSmartAnalysis,
  memories,
  riskAlerts,
  lang,
  theme,
  workspaceName,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    "predictions" | "recommendations" | "opportunities" | "risks" | "evidence"
  >("recommendations");

  const isDark = theme === "dark";

  // 1. Loading State
  if (isSmartAnalyzing) {
    return (
      <div
        id="smart-evolution-loading"
        className={`p-12 rounded-2xl border text-center transition-all ${
          isDark
            ? "bg-slate-900/40 border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-sm"
        }`}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#0075DE]/10 flex items-center justify-center text-[#0075DE]">
          <RefreshCw className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-black mb-2">
          {lang === "ar"
            ? "جارٍ تحليل بيانات المؤسسة وبناء التطور الإدراكي..."
            : lang === "fr"
              ? "Analyse des données de l'organisation et construction de l'évolution cognitive..."
              : "Analyzing organizational data and building cognitive evolution..."}
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
          {lang === "ar"
            ? "يتم الآن فحص سجلات الذاكرة المؤسسية وتنبيهات المخاطر ومحتوى الوثائق وإجراء التدقيق الحوكمي المبني على الأدلة الحقيقية."
            : "Auditing institutional memories, active risk alerts, document contents, and applying administrative governance cross-checks based on verified evidence."}
        </p>
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#0075DE]/5 border border-[#0075DE]/20 text-[11px] text-[#0075DE] font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>
            {lang === "ar"
              ? "عزل تام لمساحة العمل • مقاومة الهلوسة • عدم الحفظ التلقائي للحقائق"
              : "Strict Workspace Isolation • Zero Hallucination • No Unsolicited Facts Saved"}
          </span>
        </div>
      </div>
    );
  }

  // 2. Empty State (When no previous analysis exists in this workspace)
  if (!smartData) {
    return (
      <div id="smart-evolution-empty" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              {lang === "ar"
                ? "التطور الذكي الاستراتيجي"
                : lang === "fr"
                  ? "Évolution Intelligente Stratégique"
                  : "Strategic Smart Evolution"}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {lang === "ar"
                ? "تحليل يدوي للأدلة المؤسسية ومسارات اتخاذ القرار"
                : "Manual, evidence-based analysis of organizational precedent and risk postures"}
            </p>
          </div>
        </div>

        <div
          className={`p-10 rounded-2xl border text-center transition-all ${
            isDark
              ? "bg-slate-900/30 border-slate-800"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#0075DE]/10 flex items-center justify-center text-[#0075DE]">
            <Brain className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold mb-2">
            {lang === "ar"
              ? "لم يتم إجراء تحليل تطور ذكي بعد لمساحة العمل هذه"
              : lang === "fr"
                ? "Aucune analyse d'évolution intelligente enregistrée pour cet espace"
                : "No smart evolution analysis has been run yet for this workspace"}
          </h2>

          <p className="text-xs text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
            {lang === "ar"
              ? "يعمل قسم التطور الذكي كمنظومة استشارية استراتيجية يتم تشغيلها يدوياً بالكامل. لا يتم إطلاق أي تحليل ذكاء اصطناعي أو بحث خارجي تلقائياً عند فتح القسم للحفاظ على حوكمة الاستهلاك وموثوقية البيانات."
              : "The Smart Evolution module operates strictly on manual execution. No AI models or external searches run automatically upon opening to preserve data hygiene and operational governance."}
          </p>

          {/* Current Workspace Data Readiness Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8 text-right">
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900/60 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <FileText className="w-4 h-4 text-[#0075DE]" />
                <span className="text-lg font-black">{memories.length}</span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                {lang === "ar" ? "الذاكرات المسجلة" : "Logged Memories"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {lang === "ar"
                  ? "جاهزة للربط السببي"
                  : "Ready for causal audit"}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900/60 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span className="text-lg font-black">
                  {
                    riskAlerts.filter(
                      (r) =>
                        r.status === "Active" ||
                        r.status === "نشط" ||
                        r.status === "actif",
                    ).length
                  }
                </span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                {lang === "ar" ? "المخاطر النشطة" : "Active Risk Alerts"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {lang === "ar"
                  ? "جاهزة لمطابقة السياسات"
                  : "Ready for policy cross-check"}
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900/60 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Search className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-500">
                  {lang === "ar" ? "مشروط" : "On-Demand"}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-300">
                {lang === "ar" ? "البحث الخارجي" : "External Search"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {lang === "ar"
                  ? "يعمل فقط عند الحاجة الحقيقية"
                  : "Only triggered if required"}
              </div>
            </div>
          </div>

          <button
            id="run-smart-evolution-btn"
            onClick={runSmartAnalysis}
            className="h-12 px-8 bg-[#0075DE] hover:bg-[#005BAB] text-white font-extrabold text-sm rounded-xl inline-flex items-center gap-2.5 shadow-lg shadow-[#0075DE]/20 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Brain className="w-5 h-5" />
            <span>
              {lang === "ar"
                ? "تشغيل التطور الذكي"
                : lang === "fr"
                  ? "Lancer l'Évolution Intelligente"
                  : "Run Smart Evolution"}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Populated State (Active or Cached Analysis Results)
  return (
    <div id="smart-evolution-view" className="space-y-6">
      {/* Top Header & Re-run Trigger */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight">
              {lang === "ar"
                ? "التطور الذكي الاستراتيجي"
                : lang === "fr"
                  ? "Évolution Intelligente Stratégique"
                  : "Strategic Smart Evolution"}
            </h1>
            {smartData.analysisId && (
              <span className="px-2.5 py-1 rounded-md bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20 text-[10px] font-mono font-bold">
                {smartData.analysisId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            {smartData.createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {new Date(smartData.createdAt).toLocaleDateString(
                    lang === "ar" ? "ar-SA" : "en-US",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                    },
                  )}
                </span>
              </span>
            )}
            {smartData.confidenceLevel && (
              <span className="flex items-center gap-1 text-emerald-500 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {lang === "ar" ? "مستوى الثقة: " : "Confidence: "}
                  {smartData.confidenceLevel}
                </span>
              </span>
            )}
          </div>
        </div>

        <button
          id="rerun-smart-evolution-btn"
          onClick={runSmartAnalysis}
          disabled={isSmartAnalyzing}
          className="h-10 px-5 bg-[#0075DE] hover:bg-[#005BAB] disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>
            {lang === "ar"
              ? "إعادة تشغيل التطور الذكي"
              : lang === "fr"
                ? "Relancer l'Évolution Intelligente"
                : "Re-run Smart Evolution"}
          </span>
        </button>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: lang === "ar" ? "ذكريات تم تحليلها" : "Memories Analyzed",
            value: smartData.analyzedMemories ?? memories.length,
            icon: FileText,
            color: "text-[#0075DE]",
            bg: "bg-[#0075DE]/10",
          },
          {
            label: lang === "ar" ? "مخاطر تم تشخيصها" : "Identified Risks",
            value: smartData.identifiedRisks ?? riskAlerts.length,
            icon: ShieldAlert,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: lang === "ar" ? "ملفات ووثائق مقروءة" : "Documents Audited",
            value: smartData.analyzedFilesCount ?? 0,
            icon: Layers,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: lang === "ar" ? "توصيات تنفيذية" : "Actionable Recs",
            value: smartData.recommendationsList?.length ?? 0,
            icon: CheckCircle,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
        ].map((item, idx) => {
          return (
            <div
              key={idx}
              className={`p-4 rounded-xl text-center border transition-all ${
                isDark
                  ? "bg-slate-900/40 border-slate-800/80"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div
                className={`p-2 rounded-lg inline-flex mb-2 ${item.bg} ${item.color}`}
              >
                {item.icon && React.createElement(item.icon, { className: "w-4 h-4" })}
              </div>
              <div
                className={`text-2xl font-black ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {item.value}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Executive Summary */}
      <div
        className={`p-6 rounded-2xl border ${
          isDark
            ? "bg-slate-900/30 border-slate-800/80"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[#0075DE]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0075DE]">
            {lang === "ar" ? "الملخص التنفيذي الاستراتيجي" : "Executive Summary"}
          </h3>
        </div>
        <ExecutiveAIReportFormatter
          content={smartData.executiveSummary}
          theme={theme}
          lang={lang}
          variant="report"
        />

        {/* Key Insights & Detected Patterns */}
        {((smartData.keyInsights && smartData.keyInsights.length > 0) ||
          (smartData.detectedPatterns &&
            smartData.detectedPatterns.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-800/40">
            {smartData.keyInsights && smartData.keyInsights.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {lang === "ar" ? "الاستنتاجات المحورية" : "Key Insights"}
                  </span>
                </h4>
                <div className="space-y-2">
                  {smartData.keyInsights.map((ki, i) => (
                    <ExecutiveListItemCard
                      key={i}
                      text={ki}
                      theme={theme}
                      lang={lang}
                      icon={Sparkles}
                      accentColor="amber"
                    />
                  ))}
                </div>
              </div>
            )}

            {smartData.detectedPatterns &&
              smartData.detectedPatterns.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      {lang === "ar"
                        ? "الأنماط السببية المرصودة"
                        : "Detected Patterns"}
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {smartData.detectedPatterns.map((dp, i) => (
                      <ExecutiveListItemCard
                        key={i}
                        text={dp}
                        theme={theme}
                        lang={lang}
                        icon={TrendingUp}
                        accentColor="blue"
                      />
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Strategic Options & Priorities */}
      {((smartData.priorities && smartData.priorities.length > 0) ||
        (smartData.strategicOptions &&
          smartData.strategicOptions.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Priorities */}
          {smartData.priorities && smartData.priorities.length > 0 && (
            <div
              className={`p-5 rounded-xl border ${
                isDark
                  ? "bg-slate-900/20 border-slate-800/80"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider mb-3">
                {lang === "ar" ? "الأولويات الموصى بها" : "Strategic Priorities"}
              </h4>
              <div className="space-y-3">
                {smartData.priorities.map((p, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      isDark
                        ? "bg-slate-900/60 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-[#0075DE]/20 text-[#0075DE] font-bold text-[10px] flex items-center justify-center">
                        {p.rank || i + 1}
                      </span>
                      <h5 className="text-xs font-bold">
                        <FormattedBidiSpan text={p.title} isAr={lang === "ar"} />
                      </h5>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      <ExecutiveAIReportFormatter
                        content={p.rationale}
                        theme={theme}
                        lang={lang}
                        variant="inline"
                      />
                    </div>
                    {p.expectedImpact && (
                      <div className="mt-2 text-[10px] text-emerald-500 font-medium">
                        {lang === "ar" ? "الأثر: " : "Impact: "}
                        <FormattedBidiSpan text={p.expectedImpact} isAr={lang === "ar"} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic Options */}
          {smartData.strategicOptions &&
            smartData.strategicOptions.length > 0 && (
              <div
                className={`p-5 rounded-xl border ${
                  isDark
                    ? "bg-slate-900/20 border-slate-800/80"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3">
                  {lang === "ar" ? "الخيارات الاستراتيجية" : "Strategic Options"}
                </h4>
                <div className="space-y-3">
                  {smartData.strategicOptions.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        isDark
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h5 className="text-xs font-bold text-blue-400">
                          <FormattedBidiSpan text={opt.title} isAr={lang === "ar"} />
                        </h5>
                        {opt.timeframe && (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                            {opt.timeframe}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        <ExecutiveAIReportFormatter
                          content={opt.details}
                          theme={theme}
                          lang={lang}
                          variant="inline"
                        />
                      </div>
                      {opt.evidence && (
                        <div className="mt-1.5 text-[10px] text-slate-400 font-serif">
                          {lang === "ar" ? "الدليل: " : "Evidence: "}
                          <FormattedBidiSpan text={opt.evidence} isAr={lang === "ar"} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Diagnostic Subtabs */}
      <div className="space-y-4">
        <div
          className={`flex border-b overflow-x-auto gap-2 ${
            isDark ? "border-slate-800/60" : "border-slate-200"
          }`}
        >
          {[
            {
              id: "recommendations",
              label:
                lang === "ar"
                  ? "التوصيات التنفيذية"
                  : "Executive Recommendations",
              count: smartData.recommendationsList?.length,
            },
            {
              id: "risks",
              label: lang === "ar" ? "المخاطر المشخصة" : "Diagnosed Risks",
              count: smartData.risksList?.length,
            },
            {
              id: "predictions",
              label:
                lang === "ar"
                  ? "التوقعات الاستباقية"
                  : "Predictive Forecasts",
              count: smartData.forecastsList?.length,
            },
            {
              id: "opportunities",
              label:
                lang === "ar"
                  ? "الفرص التطويرية"
                  : "Strategic Opportunities",
              count: smartData.opportunitiesList?.length,
            },
            {
              id: "evidence",
              label:
                lang === "ar"
                  ? "طبقة الأدلة والتدقيق"
                  : "Evidence & Audit Layer",
              count:
                (smartData.supportingEvidence?.length || 0) +
                (smartData.externalSources?.length || 0),
            },
          ].map((subTab) => (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`h-11 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                activeSubTab === subTab.id
                  ? "border-[#0075DE] text-[#0075DE]"
                  : isDark
                    ? "border-transparent text-slate-400 hover:text-white"
                    : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <span>{subTab.label}</span>
              {typeof subTab.count === "number" && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                  {subTab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab 1: Recommendations */}
        {activeSubTab === "recommendations" && (
          <div className="space-y-3">
            {(smartData.recommendationsList || []).map((r, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-xl transition-all ${
                  isDark
                    ? "bg-slate-900/20 border-slate-800/60"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h4 className="text-xs font-bold text-emerald-500">
                    <FormattedBidiSpan text={r.title} isAr={lang === "ar"} />
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">
                      {r.priority}
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">
                      {r.actionable}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed mt-1">
                  <ExecutiveAIReportFormatter
                    content={r.details}
                    theme={theme}
                    lang={lang}
                    variant="inline"
                  />
                </div>
                {r.evidence && (
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-[#0075DE]" />
                    <span>{lang === "ar" ? "الأساس الدليلي: " : "Evidence Base: "}</span>
                    <FormattedBidiSpan text={r.evidence} isAr={lang === "ar"} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Risks */}
        {activeSubTab === "risks" && (
          <div className="space-y-3">
            {(smartData.risksList || []).map((ri, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-xl transition-all ${
                  isDark
                    ? "bg-slate-900/20 border-slate-800/60"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h4 className="text-xs font-bold text-rose-500">
                    <FormattedBidiSpan text={ri.title} isAr={lang === "ar"} />
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">
                      {ri.severity}
                    </span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold">
                      {ri.probability}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed mt-1">
                  <ExecutiveAIReportFormatter
                    content={ri.details}
                    theme={theme}
                    lang={lang}
                    variant="inline"
                  />
                </div>
                {ri.evidence && (
                  <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                    <span>{lang === "ar" ? "الدليل المسجل: " : "Logged Evidence: "}</span>
                    <FormattedBidiSpan text={ri.evidence} isAr={lang === "ar"} />
                  </div>
                )}
                {ri.uncertainty && (
                  <div className="mt-1 text-[10px] text-amber-500/90 flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-amber-500" />
                    <span>{lang === "ar" ? "محددات اليقين: " : "Uncertainty Notes: "}</span>
                    <FormattedBidiSpan text={ri.uncertainty} isAr={lang === "ar"} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Predictions */}
        {activeSubTab === "predictions" && (
          <div className="space-y-3">
            {(smartData.forecastsList || []).map((p, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-xl transition-all ${
                  isDark
                    ? "bg-slate-900/20 border-slate-800/60"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h4 className="text-xs font-bold text-[#0075DE]">
                    <FormattedBidiSpan text={p.title} isAr={lang === "ar"} />
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-[#0075DE]/10 text-[#0075DE] px-2 py-0.5 rounded font-bold">
                      {p.timeframe}
                    </span>
                    <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-bold">
                      {p.impact}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed mt-1">
                  <ExecutiveAIReportFormatter
                    content={p.details}
                    theme={theme}
                    lang={lang}
                    variant="inline"
                  />
                </div>
                {p.evidence && (
                  <div className="mt-2 text-[10px] text-slate-500">
                    {lang === "ar" ? "الأساس: " : "Basis: "}
                    <FormattedBidiSpan text={p.evidence} isAr={lang === "ar"} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Opportunities */}
        {activeSubTab === "opportunities" && (
          <div className="space-y-3">
            {(smartData.opportunitiesList || []).map((o, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-xl transition-all ${
                  isDark
                    ? "bg-slate-900/20 border-slate-800/60"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h4 className="text-xs font-bold text-blue-500">
                    <FormattedBidiSpan text={o.title} isAr={lang === "ar"} />
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-bold">
                      {o.feasibility}
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">
                      {o.benefit}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed mt-1">
                  <ExecutiveAIReportFormatter
                    content={o.details}
                    theme={theme}
                    lang={lang}
                    variant="inline"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 5: Evidence & Audit Layer */}
        {activeSubTab === "evidence" && (
          <div className="space-y-5">
            {/* Supporting Evidence Logs */}
            <div
              className={`p-5 rounded-xl border ${
                isDark
                  ? "bg-slate-900/30 border-slate-800/80"
                  : "bg-white border-slate-200"
              }`}
            >
              <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>
                  {lang === "ar"
                    ? "الأدلة والوقائع المؤسسية المعتمدة"
                    : "Verified Supporting Evidence"}
                </span>
              </h4>
              <div className="space-y-2">
                {(smartData.supportingEvidence || []).map((ev, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border text-xs ${
                      isDark
                        ? "bg-slate-900/60 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-200">
                        {ev.source}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {ev.type}
                      </span>
                    </div>
                    {ev.snippet && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {ev.snippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* File Extraction Audit */}
            {smartData.fileExtractionStatus &&
              smartData.fileExtractionStatus.length > 0 && (
                <div
                  className={`p-5 rounded-xl border ${
                    isDark
                      ? "bg-slate-900/30 border-slate-800/80"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>
                      {lang === "ar"
                        ? "تدقيق استخراج محتوى الملفات"
                        : "File Content Extraction Audit"}
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {smartData.fileExtractionStatus.map((f, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                          isDark
                            ? "bg-slate-900/60 border-slate-800"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div>
                          <span className="font-bold">{f.fileName}</span>
                          {f.summary && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {f.summary}
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            f.status === "read"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }`}
                        >
                          {f.status === "read"
                            ? lang === "ar"
                              ? "تمت قراءة المحتوى"
                              : "Content Read"
                            : lang === "ar"
                              ? "غير متاح نصياً"
                              : "Text Unavailable"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Administrative Advisor Cross-Check Review */}
            {smartData.administrativeAdvisorReview && (
              <div
                className={`p-5 rounded-xl border ${
                  isDark
                    ? "bg-slate-900/30 border-slate-800/80"
                    : "bg-white border-slate-200"
                }`}
              >
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {lang === "ar"
                      ? "مراجعة المستشار الإداري والحوكمي"
                      : "Administrative Advisor Governance Review"}
                  </span>
                </h4>
                <div className="mb-3">
                  <ExecutiveAIReportFormatter
                    content={smartData.administrativeAdvisorReview.governanceNotes}
                    theme={theme}
                    lang={lang}
                    variant="report"
                  />
                </div>

                {smartData.administrativeAdvisorReview.recommendedPolicyControls
                  .length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                      ضوابط السياسات الموصى بها:
                    </h5>
                    <ul className="space-y-1">
                      {smartData.administrativeAdvisorReview.recommendedPolicyControls.map(
                        (ctrl, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-300 flex items-start gap-2"
                          >
                            <span className="text-emerald-500">•</span>
                            <span>{ctrl}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* External Search Evidence & Grounding */}
            <div
              className={`p-5 rounded-xl border ${
                isDark
                  ? "bg-slate-900/30 border-slate-800/80"
                  : "bg-white border-slate-200"
              }`}
            >
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                <span>
                  {lang === "ar"
                    ? "استقصاء البحث الخارجي والإنترنت"
                    : "External Web Search Grounding"}
                </span>
              </h4>

              {smartData.externalSearchUsed &&
              smartData.externalSources &&
              smartData.externalSources.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-emerald-400 font-bold mb-2">
                    تم إجراء بحث حقيقي عبر Google Search وتوثيق المصادر التالية:
                  </div>
                  {smartData.externalSources.map((src, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-xs ${
                        isDark
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0075DE]">
                          {src.title}
                        </span>
                        {src.url && (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0075DE] hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <span>زيارة المصدر</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {src.snippet && (
                        <p className="text-[11px] text-slate-400 mt-1 font-serif">
                          {src.snippet}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {smartData.externalSearchStatus === "NOT_REQUIRED"
                    ? "لم يتطلب التحليل استقصاءً خارجياً نظراً لكفاية المعطيات الداخلية الموثقة في مساحة العمل."
                    : smartData.externalSearchStatus ||
                      "لم يتم إجراء بحث خارجي أو تعذر الوصول المباشر نظراً لحدود الحصة، وتم الاعتماد حصرياً على السجلات المؤسسية المعتمدة."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Uncertainty & Limitations Disclosure */}
      {smartData.uncertaintyNotes && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            isDark
              ? "bg-slate-900/20 border-amber-900/40 text-slate-400"
              : "bg-amber-50/50 border-amber-200 text-slate-600"
          }`}
        >
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-amber-500">
              {lang === "ar"
                ? "إفصاح المنهجية وحدود اليقين: "
                : "Methodology & Uncertainty Disclosure: "}
            </span>
            <span>{smartData.uncertaintyNotes}</span>
          </div>
        </div>
      )}
    </div>
  );
};
