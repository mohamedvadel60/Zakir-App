import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  Search,
  Globe,
  AlertTriangle,
  Compass,
  CheckCircle2,
  ShieldAlert,
  Building2,
  Layers,
  ArrowRight,
  ExternalLink,
  History,
  FileText,
  RefreshCw,
  BarChart3,
  Award,
  Zap,
  Info,
  Scale,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Database,
  Sliders,
  Maximize2,
  Printer,
  XCircle,
} from "lucide-react";
import {
  ExecutiveAIReportFormatter,
  ExecutiveListItemCard,
  FormattedBidiSpan,
  cleanRawTextLine,
} from "./ExecutiveAIReportFormatter";
import type {
  MarketIntelligenceData,
  MarketEvidenceItem,
  MarketCompetitorProfile,
  CountryComparisonDimension,
  MarketStrategicAction,
} from "../types.js";

interface MarketIntelligenceViewProps {
  theme: "dark" | "light";
  lang: "ar" | "en" | "fr";
  currentUser: any;
  currentWorkspace?: any;
  memories?: any[];
  riskAlerts?: any[];
  files?: any[];
  authenticatedFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export const MarketIntelligenceView: React.FC<MarketIntelligenceViewProps> = ({
  theme,
  lang,
  currentUser,
  currentWorkspace,
  memories = [],
  riskAlerts = [],
  files = [],
  authenticatedFetch,
}) => {
  const isAr = lang === "ar";
  const workspaceId = currentWorkspace?.id || "default";
  const userId = currentUser?.id || "usr_anon";

  // Form Inputs
  const [topic, setTopic] = useState("");
  const [industry, setIndustry] = useState("Financial Services");
  const [customIndustry, setCustomIndustry] = useState("");
  const [countriesInput, setCountriesInput] = useState("");
  const [focus, setFocus] = useState<string>("all");
  const [competitorsInput, setCompetitorsInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Execution State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result & History State
  const [currentResult, setCurrentResult] = useState<MarketIntelligenceData | null>(null);
  const [historyList, setHistoryList] = useState<Array<any>>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Quick prompt presets for common market queries
  const presets = [
    {
      title: isAr ? "مقارنة السوق المصرفي والمالي" : "Banking & Financial Comparison",
      topic: isAr ? "تحليل ومقارنة السياسة النقدية وسوق الخدمات المالية والشمول المالي" : "Comparative financial services and monetary policy analysis",
      industry: "Financial Services",
      countries: isAr ? "موريتانيا، الجزائر، المغرب" : "Mauritania, Algeria, Morocco",
      focus: "comparison",
    },
    {
      title: isAr ? "سلاسل الإمداد والشحن والجمارك" : "Logistics & Supply Chain",
      topic: isAr ? "تحليل كفاءة الموانئ، المعابر الحدودية، والتخليص الجمركي وتكاليف النقل" : "Port efficiency, cross-border freight corridors, and customs clearance",
      industry: "Supply Chain & Shipping",
      countries: isAr ? "موريتانيا، الجزائر" : "Mauritania, Algeria",
      focus: "supply_chain",
    },
    {
      title: isAr ? "فرص التوسع والتجارة الإقليمية" : "Regional Trade & Expansion",
      topic: isAr ? "استكشاف فرص دخول السوق وتصدير المنتجات المحلية ومعوقات التبادل التجاري" : "Market entry opportunities, tariff structures, and export barriers",
      industry: "Global Trade",
      countries: isAr ? "موريتانيا" : "Mauritania",
      focus: "opportunities",
    },
    {
      title: isAr ? "المشهد التنافسي والبدائل" : "Competitor Landscape",
      topic: isAr ? "اكتشاف اللاعبين الرئيسيين، فجوات السوق، والتموضع التنافسي للأسعار" : "Key player mapping, market gaps, and pricing positioning",
      industry: "Technology & Software",
      countries: isAr ? "موريتانيا، المغرب" : "Mauritania, Morocco",
      focus: "competitors",
    },
  ];

  // Stage steps description
  const analysisSteps = [
    isAr ? "فهم الاستفسار وتصنيف نطاق التحليل والسوق..." : "Classifying query intent and target market scope...",
    isAr ? "فحص سجلات الذاكرة والمخاطر المؤسسية الداخلية..." : "Auditing internal workspace memories and risk registers...",
    isAr ? "استرجاع المؤشرات الاقتصادية والبحث الخارجي..." : "Querying economic benchmarks and external research...",
    isAr ? "التحقق من البيئة التنظيمية والتنافسية ومسارات الإمداد..." : "Validating regulatory bodies, competitors, and supply corridors...",
    isAr ? "صياغة التقرير الاستراتيجي والتوصيات التنفيذية..." : "Synthesizing executive diagnostic and actionable roadmap...",
  ];

  // Load Latest Analysis for Active Workspace on Mount or Workspace Change (MANUAL-ONLY / NO AI)
  useEffect(() => {
    let isMounted = true;
    const fetchLatest = async () => {
      try {
        setErrorMsg(null);
        const res = await authenticatedFetch(
          `/api/market-intelligence/latest?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(userId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.hasPreviousAnalysis && data.result) {
            setCurrentResult(data.result);
          } else if (isMounted) {
            setCurrentResult(null);
          }
        }
      } catch (err) {
        console.warn("Could not fetch latest market intelligence:", err);
      }
    };

    const fetchHistory = async () => {
      try {
        const res = await authenticatedFetch(
          `/api/market-intelligence/history?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(userId)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.history)) {
            setHistoryList(data.history);
          }
        }
      } catch (err) {
        console.warn("Could not fetch market intelligence history:", err);
      }
    };

    fetchLatest();
    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, userId, authenticatedFetch]);

  // Run Market Analysis Trigger
  const handleRunAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisStage(0);

    // Progressive stage simulation during real backend execution
    const interval = setInterval(() => {
      setAnalysisStage((prev) => (prev < analysisSteps.length - 1 ? prev + 1 : prev));
    }, 1400);

    try {
      const finalIndustry = industry === "Other" ? customIndustry.trim() || "General" : industry;
      const parsedCountries = countriesInput
        .split(/[,،]+/)
        .map((c) => c.trim())
        .filter(Boolean);

      const payload = {
        topic: topic.trim(),
        industry: finalIndustry,
        context: countriesInput.trim(),
        countries: parsedCountries,
        focus: focus !== "all" ? focus : undefined,
        competitors: competitorsInput.trim() || undefined,
        lang,
        userId,
        workspaceId,
        memories,
        riskAlerts,
        files,
      };

      const res = await authenticatedFetch("/api/market-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data: MarketIntelligenceData = await res.json();
      setCurrentResult(data);

      // Refresh history list
      setHistoryList((prev) => [
        {
          analysisId: data.analysisId,
          createdAt: data.createdAt,
          topic: data.topic,
          industry: data.industry,
          countries: data.countries || [],
        },
        ...prev,
      ]);
    } catch (err: any) {
      console.error("Market analysis error:", err);
      setErrorMsg(err?.message || (isAr ? "حدث خطأ أثناء إجراء التحليل." : "An error occurred during analysis."));
    } finally {
      clearInterval(interval);
      setIsAnalyzing(false);
      setAnalysisStage(0);
    }
  };

  const applyPreset = (p: typeof presets[0]) => {
    setTopic(p.topic);
    setIndustry(p.industry);
    setCountriesInput(p.countries);
    setFocus(p.focus);
  };

  const renderPrintView = () => {
    window.print();
  };

  return (
    <div id="market-intelligence-view" className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-[#0075DE]/10 text-[#0075DE] border border-[#0075DE]/20 tracking-wider">
              {isAr ? "المحرك التحليلي الديناميكي" : "Dynamic Analytical Engine"}
            </span>
            <span className="text-xs text-slate-400 font-mono">v3.8 Multi-Source</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-[#0075DE]" />
            {isAr ? "ذكاء السوق والاستخبارات الاقتصادية" : "Market Intelligence Engine"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-1 max-w-2xl">
            {isAr
              ? "تشخيص الأسواق التنافسية، تحليل اللوائح وسلاسل الإمداد، وربط القرارات الاستراتيجية بالذاكرة المؤسسية لمنصة ذَكِرْ."
              : "Competitive landscape diagnostics, regulatory analysis, and evidence-grounded strategic foresight."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {historyList.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#0075DE]" />
              <span>{isAr ? `السجل (${historyList.length})` : `History (${historyList.length})`}</span>
            </button>
          )}

          {currentResult && (
            <button
              onClick={renderPrintView}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
              title={isAr ? "طباعة التقرير" : "Print Report"}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isAr ? "طباعة التقرير" : "Print Report"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Query Console Card */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          theme === "dark"
            ? "bg-slate-900/60 border-slate-800 shadow-xl shadow-black/20"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Search className="w-4 h-4 text-[#0075DE]" />
            {isAr ? "معايير واستفسار تحليل السوق" : "Market Analysis Parameters"}
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{isAr ? "قوالب سريعة:" : "Presets:"}</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-2 py-1 text-[11px] rounded-md border font-medium transition-colors cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-[#0075DE] hover:text-white"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:border-[#0075DE] hover:bg-blue-50"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleRunAnalysis} className="space-y-4">
          {/* Primary Topic / Question Input */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
              {isAr ? "موضوع التحليل أو السؤال الاستراتيجي *" : "Market Topic or Strategic Inquiry *"}
            </label>
            <textarea
              id="market-topic-input"
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isAr
                  ? "مثال: تحليل سوق الخدمات المصرفية ومخاطر تقلب أسعار الصرف، أو مقارنة كفاءة الموانئ والجمارك..."
                  : "e.g., Evaluate banking market liquidity and FX risks, or compare customs efficiency between countries..."
              }
              className={`w-full p-3 border rounded-xl text-xs focus:outline-none focus:border-[#0075DE] focus:ring-1 focus:ring-[#0075DE]/30 transition-all ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sector / Industry Selection */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? "القطاع الاقتصادي" : "Industry / Sector"}
              </label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  if (e.target.value !== "Other") setCustomIndustry("");
                }}
                className={`w-full h-11 px-3 border rounded-xl text-xs focus:outline-none focus:border-[#0075DE] ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <option value="Financial Services">{isAr ? "الخدمات المالية والمصرفية" : "Financial Services & Banking"}</option>
                <option value="Supply Chain & Shipping">{isAr ? "سلاسل الإمداد والشحن واللوجستيات" : "Supply Chain & Logistics"}</option>
                <option value="Global Trade">{isAr ? "التجارة الدولية والاستيراد والتصدير" : "Global Trade & Customs"}</option>
                <option value="Technology & Software">{isAr ? "التكنولوجيا والبرمجيات (SaaS)" : "Technology & Software"}</option>
                <option value="Mining & Energy">{isAr ? "التعدين والطاقة والمحروقات" : "Mining, Energy & Oil/Gas"}</option>
                <option value="Agriculture & Fisheries">{isAr ? "الزراعة والصيد والصناعات الغذائية" : "Agriculture, Fisheries & Food"}</option>
                <option value="Healthcare & Pharma">{isAr ? "الرعاية الصحية والأدوية" : "Healthcare & Pharma"}</option>
                <option value="Construction & Infrastructure">{isAr ? "البناء والمقاولات والبنية التحتية" : "Construction & Infrastructure"}</option>
                <option value="Retail & eCommerce">{isAr ? "تجارة التجزئة والتجارة الإلكترونية" : "Retail & eCommerce"}</option>
                <option value="Other">{isAr ? "أخرى (تحديد يدوي)" : "Other (Specify)"}</option>
              </select>

              {industry === "Other" && (
                <input
                  type="text"
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  placeholder={isAr ? "اكتب اسم القطاع هنا..." : "Enter custom industry..."}
                  className={`w-full h-10 mt-2 px-3 border rounded-lg text-xs focus:outline-none focus:border-[#0075DE] ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                  required
                />
              )}
            </div>

            {/* Target Countries / Region */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? "الدولة / الدول المستهدفة (للمقارنة)" : "Target Country / Countries"}
              </label>
              <input
                type="text"
                value={countriesInput}
                onChange={(e) => setCountriesInput(e.target.value)}
                placeholder={isAr ? "مثال: موريتانيا، الجزائر، المغرب" : "e.g. Mauritania, Algeria, Morocco"}
                className={`w-full h-11 px-3 border rounded-xl text-xs focus:outline-none focus:border-[#0075DE] ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400"
                }`}
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isAr ? "افصل بفاصلة للمقارنة بين عدة دول" : "Separate with commas to trigger country comparison"}
              </span>
            </div>

            {/* Strategic Focus */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                {isAr ? "محور التركيز التحليلي" : "Analytical Focus"}
              </label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className={`w-full h-11 px-3 border rounded-xl text-xs focus:outline-none focus:border-[#0075DE] ${
                  theme === "dark"
                    ? "bg-slate-950 border-slate-800 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <option value="all">{isAr ? "تشخيص شامل متعدد المحاور" : "Comprehensive (All Dimensions)"}</option>
                <option value="comparison">{isAr ? "مقارنة أسواق ودول متعددة" : "Cross-Country Comparison"}</option>
                <option value="competitors">{isAr ? "المشهد التنافسي والبدائل" : "Competitor Landscape & Gaps"}</option>
                <option value="risks">{isAr ? "المخاطر السوقية والتنظيمية" : "Market & Regulatory Risks"}</option>
                <option value="opportunities">{isAr ? "فرص الدخول والتوسع" : "Market Entry & Expansion"}</option>
                <option value="supply_chain">{isAr ? "سلاسل الإمداد واللوجستيات" : "Supply Chain & Trade"}</option>
                <option value="strategy">{isAr ? "الخيارات الاستراتيجية والتموضع" : "Strategic Options & Positioning"}</option>
              </select>
            </div>
          </div>

          {/* Advanced Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-[#0075DE] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? (isAr ? "إخفاء الخيارات المتقدمة" : "Hide Advanced Options") : (isAr ? "خيارات متقدمة (المنافسون المحدودون)" : "Advanced Options (Specific Competitors)")}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 p-4 rounded-xl border bg-slate-500/5 border-slate-500/10 space-y-2"
              >
                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  {isAr ? "منافسون محددون للتقصي عنهم (اختياري)" : "Target Competitors to Investigate (Optional)"}
                </label>
                <input
                  type="text"
                  value={competitorsInput}
                  onChange={(e) => setCompetitorsInput(e.target.value)}
                  placeholder={isAr ? "مثال: الشركة الوطنية أ، بنك ب، مؤسسة ج" : "e.g., Company A, Regional Bank B, Firm C"}
                  className={`w-full h-10 px-3 border rounded-lg text-xs focus:outline-none focus:border-[#0075DE] ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 text-white"
                      : "bg-white border-slate-200 text-slate-800"
                  }`}
                />
                <p className="text-[11px] text-slate-400">
                  {isAr
                    ? "إذا لم تُحدد منافسين، سيبحث المحرك عن اللاعبين الرئيسيين أو يعتمد على السجلات والبيانات المتاحة دون اختلاق."
                    : "If left blank, the engine will only report verified competitors from sources or internal logs."}
                </p>
              </motion.div>
            )}
          </div>

          {/* Execution Button */}
          <div className="pt-2">
            <button
              type="submit"
              id="market-run-btn"
              disabled={isAnalyzing || !topic.trim()}
              className="w-full h-12 bg-[#0075DE] hover:bg-[#005BAB] disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs md:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{analysisSteps[analysisStage]}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isAr ? "تشغيل محرك ذكاء السوق (بدء التحليل)" : "Run Market Intelligence Engine"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-500 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Analysis In Progress Indicator */}
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-2xl border text-center space-y-4 ${
            theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-2xl bg-[#0075DE]/10 text-[#0075DE] flex items-center justify-center animate-pulse">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isAr ? "جارٍ تشخيص السوق وجمع الأدلة وبناء الرؤية..." : "Diagnosing market, gathering evidence, and modeling foresight..."}
            </h3>
            <p className="text-xs text-[#0075DE] mt-1 font-medium">{analysisSteps[analysisStage]}</p>
          </div>
          <div className="w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#0075DE] h-full transition-all duration-700 ease-out"
              style={{ width: `${((analysisStage + 1) / analysisSteps.length) * 100}%` }}
            />
          </div>
        </motion.div>
      )}

      {/* Result Dashboard */}
      {currentResult && !isAnalyzing && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Metadata & Status Header Card */}
          <div
            className={`p-5 rounded-2xl border ${
              theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {currentResult.classification && (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0075DE]/15 text-[#0075DE] border border-[#0075DE]/30">
                    {currentResult.classification.intent}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-500/10 text-slate-400">
                  {currentResult.industry}
                </span>
                {currentResult.countries && currentResult.countries.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-500 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {currentResult.countries.join(" / ")}
                  </span>
                )}
                {currentResult.createdAt && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(currentResult.createdAt).toLocaleString(isAr ? "ar-EG" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </div>

              {/* Confidence Score Pill */}
              <div className="flex items-center gap-3">
                {currentResult.confidenceScore !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">{isAr ? "درجة الثقة:" : "Confidence:"}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        currentResult.confidenceScore >= 80
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : currentResult.confidenceScore >= 65
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}
                    >
                      {currentResult.confidenceScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* External Search Notice Banner if Quota Constrained */}
            {currentResult.externalSearchStatus === "BLOCKED_BY_QUOTA" && (
              <div className="mb-4 p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="font-bold">
                    {isAr ? "تنبيه شفافية البيانات الخارجية (قيود الحصة / Quota)" : "External Data Quota Notice"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {currentResult.externalSearchNotice ||
                      (isAr
                        ? "تعذر حاليًا الحصول على بيانات البحث الخارجي الحي بسبب قيود الحصة، وتم بناء التحليل بالاعتماد على البيانات والوثائق والسجلات المؤسسية المتاحة في مساحة العمل دون اختلاق مصادر أو بيانات وهمية."
                        : "Live search grounding was constrained by quota. Diagnostic was generated using verified internal workspace intelligence and established macroeconomic frameworks.")}
                  </p>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0075DE] flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {isAr ? "الملخص التنفيذي والتشخيص الاستراتيجي" : "Executive Market Diagnostic"}
              </h3>
              <ExecutiveAIReportFormatter
                content={currentResult.summary}
                theme={theme}
                lang={lang}
                variant="report"
              />
            </div>
          </div>

          {/* Market Attractiveness Banner (if available) */}
          {currentResult.marketAttractiveness && (
            <div
              className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-blue-50/50 border-blue-100 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0075DE]/10 text-[#0075DE] flex items-center justify-center font-black text-lg border border-[#0075DE]/20">
                  {currentResult.marketAttractiveness.score}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                      {isAr ? "مؤشر جاذبية السوق والاستثمار" : "Market Attractiveness Index"}
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#0075DE] text-white">
                      {currentResult.marketAttractiveness.rating}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                    <FormattedBidiSpan text={currentResult.marketAttractiveness.justification} isAr={isAr} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Country Comparison Matrix (if comparative) */}
          {currentResult.countryComparisons && currentResult.countryComparisons.length > 0 && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#0075DE]" />
                {isAr ? "مصفوفة المقارنة الإقليمية بين الأسواق" : "Cross-Country Market Comparison Matrix"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentResult.countryComparisons.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-2.5 ${
                      theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-[#0075DE]" />
                        <FormattedBidiSpan text={c.country} isAr={isAr} />
                      </span>
                      {c.attractivenessScore && (
                        <span className="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {c.attractivenessScore} / 10
                        </span>
                      )}
                    </div>

                    {c.marketSizeGrowth && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                          {isAr ? "النمو والحجم:" : "Growth & Size:"}
                        </span>
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                          <FormattedBidiSpan text={c.marketSizeGrowth} isAr={isAr} />
                        </div>
                      </div>
                    )}

                    {c.regulatoryEase && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                          {isAr ? "البيئة التنظيمية والرقابية:" : "Regulatory & Statutory:"}
                        </span>
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                          <FormattedBidiSpan text={c.regulatoryEase} isAr={isAr} />
                        </div>
                      </div>
                    )}

                    {c.logisticsInfrastructure && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                          {isAr ? "الموانئ واللوجستيات:" : "Logistics & Transport:"}
                        </span>
                        <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                          <FormattedBidiSpan text={c.logisticsInfrastructure} isAr={isAr} />
                        </div>
                      </div>
                    )}

                    {c.keyRisks && c.keyRisks.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-rose-500 uppercase block">
                          {isAr ? "أبرز المخاطر:" : "Key Risks:"}
                        </span>
                        <div className="mt-1 space-y-1">
                          {c.keyRisks.map((rk, rIdx) => (
                            <ExecutiveListItemCard
                              key={rIdx}
                              text={rk}
                              theme={theme}
                              lang={lang}
                              icon={AlertTriangle}
                              accentColor="rose"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Insight Grids: Risks, Opportunities, Market Dynamics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Market Dynamics & Trends */}
            {currentResult.trends && currentResult.trends.length > 0 && (
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <h4 className="text-xs font-bold text-[#0075DE] uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>{isAr ? `ديناميكيات واتجاهات السوق (${currentResult.trends.length})` : `Market Trends (${currentResult.trends.length})`}</span>
                </h4>
                <div className="space-y-2">
                  {currentResult.trends.map((tItem, idx) => (
                    <ExecutiveListItemCard
                      key={idx}
                      text={tItem}
                      theme={theme}
                      lang={lang}
                      icon={TrendingUp}
                      accentColor="blue"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Risks & Threats */}
            {currentResult.risks && currentResult.risks.length > 0 && (
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  theme === "dark" ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50/40 border-rose-100 shadow-sm"
                }`}
              >
                <h4 className="text-xs font-bold text-rose-500 uppercase flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{isAr ? `المخاطر والانكشافات السوقية (${currentResult.risks.length})` : `Market Risks (${currentResult.risks.length})`}</span>
                </h4>
                <div className="space-y-2">
                  {currentResult.risks.map((rItem, idx) => (
                    <ExecutiveListItemCard
                      key={idx}
                      text={rItem}
                      theme={theme}
                      lang={lang}
                      icon={AlertTriangle}
                      accentColor="rose"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {currentResult.opportunities && currentResult.opportunities.length > 0 && (
              <div
                className={`p-5 rounded-2xl border space-y-3 ${
                  theme === "dark" ? "bg-emerald-500/5 border-emerald-500/10" : "bg-emerald-50/40 border-emerald-100 shadow-sm"
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  <span>{isAr ? `فرص النمو والتوسع (${currentResult.opportunities.length})` : `Growth Opportunities (${currentResult.opportunities.length})`}</span>
                </h4>
                <div className="space-y-2">
                  {currentResult.opportunities.map((oItem, idx) => (
                    <ExecutiveListItemCard
                      key={idx}
                      text={oItem}
                      theme={theme}
                      lang={lang}
                      icon={Compass}
                      accentColor="emerald"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Competitor Landscape & Gaps (if present) */}
          {((currentResult.competitors && currentResult.competitors.length > 0) ||
            (currentResult.competitiveGaps && currentResult.competitiveGaps.length > 0)) && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0075DE]" />
                {isAr ? "المشهد التنافسي والفجوات السوقية" : "Competitor Landscape & Market Gaps"}
              </h3>

              {currentResult.competitors && currentResult.competitors.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentResult.competitors.map((comp, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          <FormattedBidiSpan text={comp.name} isAr={isAr} />
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded">
                          {comp.sourceType === "external_source"
                            ? (isAr ? "مصدر خارجي" : "External")
                            : (isAr ? "سجل داخلي" : "Internal")}
                        </span>
                      </div>
                      {comp.positioning && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                          <FormattedBidiSpan text={comp.positioning} isAr={isAr} />
                        </div>
                      )}
                      {comp.strengths && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-1">
                          <span className="font-semibold">{isAr ? "نقاط القوة: " : "Strengths: "}</span>
                          <FormattedBidiSpan text={comp.strengths.join("، ")} isAr={isAr} />
                        </div>
                      )}
                      {comp.weaknesses && (
                        <div className="text-[11px] text-rose-500">
                          <span className="font-semibold">{isAr ? "الفجوات / الضعف: " : "Weaknesses: "}</span>
                          <FormattedBidiSpan text={comp.weaknesses.join("، ")} isAr={isAr} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {currentResult.competitiveGaps && currentResult.competitiveGaps.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                    {isAr ? "فجوات السوق التي يمكن للمؤسسة استغلالها:" : "Addressable Competitive Voids:"}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {currentResult.competitiveGaps.map((gap, gIdx) => (
                      <span
                        key={gIdx}
                        className="px-2.5 py-1 text-xs rounded-lg border bg-blue-500/5 border-blue-500/20 text-[#0075DE] font-medium"
                      >
                        ✓ <FormattedBidiSpan text={gap} isAr={isAr} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Regulatory & Trade Environment */}
          {(currentResult.regulatoryEnvironment || currentResult.entryBarriers) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentResult.regulatoryEnvironment && currentResult.regulatoryEnvironment.length > 0 && (
                <div
                  className={`p-5 rounded-2xl border space-y-3 ${
                    theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>{isAr ? "البيئة التنظيمية والجهات الرقابية" : "Regulatory & Statutory Authorities"}</span>
                  </h4>
                  <div className="space-y-2">
                    {currentResult.regulatoryEnvironment.map((reg, idx) => (
                      <ExecutiveListItemCard
                        key={idx}
                        text={reg}
                        theme={theme}
                        lang={lang}
                        icon={ShieldAlert}
                        accentColor="amber"
                      />
                    ))}
                  </div>
                </div>
              )}

              {currentResult.entryBarriers && currentResult.entryBarriers.length > 0 && (
                <div
                  className={`p-5 rounded-2xl border space-y-3 ${
                    theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0075DE]" />
                    <span>{isAr ? "حواجز الدخول ومعوقات السوق" : "Market Entry Barriers"}</span>
                  </h4>
                  <div className="space-y-2">
                    {currentResult.entryBarriers.map((barr, idx) => (
                      <ExecutiveListItemCard
                        key={idx}
                        text={barr}
                        theme={theme}
                        lang={lang}
                        icon={Layers}
                        accentColor="blue"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Strategic Options & Recommended Actions */}
          {currentResult.recommendedActions && currentResult.recommendedActions.length > 0 && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                {isAr ? "الإجراءات العملية والتوصيات الاستراتيجية ذات الأولوية" : "Prioritized Strategic Actions"}
              </h3>

              <div className="space-y-3">
                {currentResult.recommendedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            action.priority === "Critical"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-blue-500/10 text-[#0075DE] border border-blue-500/20"
                          }`}
                        >
                          {action.priority}
                        </span>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                          <FormattedBidiSpan text={action.title} isAr={isAr} />
                        </h5>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <ExecutiveAIReportFormatter
                          content={action.description}
                          theme={theme}
                          lang={lang}
                          variant="inline"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-shrink-0">
                      {action.timeframe && (
                        <span className="bg-slate-500/10 px-2 py-0.5 rounded font-mono">
                          ⏱ <FormattedBidiSpan text={action.timeframe} isAr={isAr} />
                        </span>
                      )}
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-medium">
                        <FormattedBidiSpan text={action.expectedImpact} isAr={isAr} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Transparency: Internal vs External */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Internal Workspace Evidence */}
            <div
              className={`p-5 rounded-2xl border space-y-3 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0075DE]" />
                <span>
                  {isAr
                    ? `الأدلة والذاكرة الداخلية (${currentResult.internalEvidence?.length || 0})`
                    : `Internal Workspace Evidence (${currentResult.internalEvidence?.length || 0})`}
                </span>
              </h4>

              {currentResult.internalEvidence && currentResult.internalEvidence.length > 0 ? (
                <div className="space-y-2">
                  {currentResult.internalEvidence.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border bg-slate-500/5 border-slate-500/10 text-xs"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span><FormattedBidiSpan text={ev.title} isAr={isAr} /></span>
                        <span className="text-[10px] text-slate-400">{ev.confidence}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                        <FormattedBidiSpan text={ev.detail} isAr={isAr} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {isAr
                    ? "لم يتم العثور على سجلات سابقة في مساحة العمل مطابقة لمعايير هذا الاستفسار."
                    : "No specific past internal records found matching this inquiry."}
                </p>
              )}
            </div>

            {/* External Evidence & Sources */}
            <div
              className={`p-5 rounded-2xl border space-y-3 ${
                theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>
                  {isAr
                    ? `المصادر والبيانات الخارجية (${currentResult.externalSources?.length || 0})`
                    : `External Verified Sources (${currentResult.externalSources?.length || 0})`}
                </span>
              </h4>

              {currentResult.externalSources && currentResult.externalSources.length > 0 ? (
                <div className="space-y-2">
                  {currentResult.externalSources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg border bg-slate-500/5 border-slate-500/10 text-xs flex items-center justify-between hover:border-[#0075DE] transition-colors group block"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-[#0075DE] truncate max-w-[85%]">
                        <FormattedBidiSpan text={src.title} isAr={isAr} />
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0075DE]" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed">
                  {currentResult.externalSearchStatus === "BLOCKED_BY_QUOTA"
                    ? (isAr
                        ? "البحث الخارجي الحي مقيّد حاليًا بسبب قيود الحصة، ولم يتم اختلاق مصادر أو روابط غير حقيقية."
                        : "Live search was quota-constrained; speculative citations were rejected.")
                    : (isAr
                        ? "الاستفسار تمت معالجته بالاعتماد على الأطر الهيكلية المعتمدة."
                        : "Processed via structured intelligence frameworks.")}
                </p>
              )}

              {currentResult.uncertaintyNotes && currentResult.uncertaintyNotes.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    {isAr ? "نقاط عدم اليقين والملاحظات الميدانية:" : "Uncertainty & Field Notes:"}
                  </span>
                  <div className="space-y-1">
                    {currentResult.uncertaintyNotes.map((note, nIdx) => (
                      <div key={nIdx} className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <FormattedBidiSpan text={note} isAr={isAr} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-xl p-6 rounded-2xl border shadow-2xl max-h-[80vh] flex flex-col ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0075DE]" />
                  {isAr ? "سجل تحليلات السوق السابقة" : "Previous Market Analyses"}
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto py-4 space-y-2 flex-1">
                {historyList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={async () => {
                      try {
                        const res = await authenticatedFetch(
                          `/api/market-intelligence/latest?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(userId)}`
                        );
                        if (res.ok) {
                          const d = await res.json();
                          if (d.result) setCurrentResult(d.result);
                        }
                        setShowHistoryModal(false);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                      theme === "dark"
                        ? "bg-slate-950/60 border-slate-800 hover:border-[#0075DE]"
                        : "bg-slate-50 border-slate-200 hover:border-[#0075DE]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.topic}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{item.industry}</span>
                      {item.countries && item.countries.length > 0 && (
                        <span>• {item.countries.join(", ")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
