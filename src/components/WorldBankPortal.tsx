import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Database,
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  BarChart2,
  PieChart,
  AreaChart as AreaIcon,
  LineChart as LineIcon,
  BarChart2 as BarIcon,
  Layers,
  Zap,
  Info,
  ChevronRight,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
  Building2,
  Share2,
  Download,
  GitMerge,
  Cpu,
  FileText
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';
import { Memory, User } from '../types';

export interface WorldBankPortalProps {
  theme: "light" | "dark" | "custom";
  lang: "ar" | "en" | "fr";
  currentUser: User | null;
  memories: Memory[];
  wbCountry: string;
  setWbCountry: (country: string) => void;
  wbIndicator: string;
  setWbIndicator: (indicator: string) => void;
  wbStartYear: number;
  setWbStartYear: (year: number) => void;
  wbEndYear: number;
  setWbEndYear: (year: number) => void;
  wbData: any[];
  wbLoading: boolean;
  wbCausalAnalysis: string;
  wbIsAnalyzing: boolean;
  runWorldBankCausalAnalysis: (e?: React.MouseEvent) => Promise<void>;
  importWorldBankToMemory: (e?: React.MouseEvent) => Promise<void>;
  wbImportSuccessMsg: string;
  setWbImportSuccessMsg: (msg: string) => void;
  wbImportErrorMsg: string;
  setWbImportErrorMsg: (msg: string) => void;
  wbImporting: boolean;
  renderTextWithLinks: (text: string) => React.ReactNode;
  wbError?: {
    message: string;
    statusCode?: number;
    attemptedUrl?: string;
    isFallback?: boolean;
    technicalDetails?: string;
    timestamp?: string;
    latencyMs?: number;
  } | null;
  wbSourceInfo?: "live" | "fallback" | "direct";
  retryFetch?: () => void;
  loadBenchmarkFallback?: () => void;
}

// Country metadata definition
export interface CountryMeta {
  code: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  region: "north_africa" | "gcc" | "levant" | "horn_africa" | "global";
  incomeLevel: "High" | "Upper-Middle" | "Lower-Middle" | "Low";
  flag: string;
}

export const COUNTRIES_LIST: CountryMeta[] = [
  { code: "MR", nameAr: "موريتانيا", nameEn: "Mauritania", nameFr: "Mauritanie", region: "north_africa", incomeLevel: "Lower-Middle", flag: "🇲🇷" },
  { code: "EG", nameAr: "مصر", nameEn: "Egypt", nameFr: "Égypte", region: "levant", incomeLevel: "Lower-Middle", flag: "🇪🇬" },
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia", nameFr: "Arabie Saoudite", region: "gcc", incomeLevel: "High", flag: "🇸🇦" },
  { code: "AE", nameAr: "الإمارات", nameEn: "UAE", nameFr: "Émirats Arabes Unis", region: "gcc", incomeLevel: "High", flag: "🇦🇪" },
  { code: "DZ", nameAr: "الجزائر", nameEn: "Algeria", nameFr: "Algérie", region: "north_africa", incomeLevel: "Lower-Middle", flag: "🇩🇿" },
  { code: "TN", nameAr: "تونس", nameEn: "Tunisia", nameFr: "Tunisie", region: "north_africa", incomeLevel: "Lower-Middle", flag: "🇹🇳" },
  { code: "MA", nameAr: "المغرب", nameEn: "Morocco", nameFr: "Maroc", region: "north_africa", incomeLevel: "Lower-Middle", flag: "🇲🇦" },
  { code: "LY", nameAr: "ليبيا", nameEn: "Libya", nameFr: "Libye", region: "north_africa", incomeLevel: "Upper-Middle", flag: "🇱🇾" },
  { code: "SD", nameAr: "السودان", nameEn: "Sudan", nameFr: "Soudan", region: "horn_africa", incomeLevel: "Low", flag: "🇸🇩" },
  { code: "IQ", nameAr: "العراق", nameEn: "Iraq", nameFr: "Irak", region: "levant", incomeLevel: "Upper-Middle", flag: "🇮🇶" },
  { code: "JO", nameAr: "الأردن", nameEn: "Jordan", nameFr: "Jordanie", region: "levant", incomeLevel: "Upper-Middle", flag: "🇯🇴" },
  { code: "LB", nameAr: "لبنان", nameEn: "Lebanon", nameFr: "Liban", region: "levant", incomeLevel: "Lower-Middle", flag: "🇱🇧" },
  { code: "OM", nameAr: "عُمان", nameEn: "Oman", nameFr: "Oman", region: "gcc", incomeLevel: "High", flag: "🇴🇲" },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar", nameFr: "Qatar", region: "gcc", incomeLevel: "High", flag: "🇶🇦" },
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait", nameFr: "Koweït", region: "gcc", incomeLevel: "High", flag: "🇰🇼" },
  { code: "BH", nameAr: "البحرين", nameEn: "Bahrain", nameFr: "Bahreïn", region: "gcc", incomeLevel: "High", flag: "🇧🇭" },
  { code: "YE", nameAr: "اليمن", nameEn: "Yemen", nameFr: "Yémen", region: "levant", incomeLevel: "Low", flag: "🇾🇪" },
  { code: "PS", nameAr: "فلسطين", nameEn: "Palestine", nameFr: "Palestine", region: "levant", incomeLevel: "Lower-Middle", flag: "🇵🇸" },
  { code: "SY", nameAr: "سوريا", nameEn: "Syria", nameFr: "Syrie", region: "levant", incomeLevel: "Low", flag: "🇸🇾" },
  { code: "SO", nameAr: "الصومال", nameEn: "Somalia", nameFr: "Somalie", region: "horn_africa", incomeLevel: "Low", flag: "🇸🇴" },
  { code: "DJ", nameAr: "جيبوتي", nameEn: "Djibouti", nameFr: "Djibouti", region: "horn_africa", incomeLevel: "Lower-Middle", flag: "🇩🇯" },
  { code: "KM", nameAr: "جزر القمر", nameEn: "Comoros", nameFr: "Comores", region: "horn_africa", incomeLevel: "Lower-Middle", flag: "🇰🇲" },
  { code: "WLD", nameAr: "العالم ككل", nameEn: "World Aggregate", nameFr: "Monde Entier", region: "global", incomeLevel: "High", flag: "🌐" }
];

export interface IndicatorMeta {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  category: "growth" | "monetary" | "labor" | "trade" | "fiscal";
  unit: string;
  source: string;
  descAr: string;
  descEn: string;
  descFr: string;
}

export const INDICATORS_LIST: IndicatorMeta[] = [
  {
    id: "NY.GDP.MKTP.KD.ZG",
    nameAr: "النمو السنوي للناتج المحلي (%)",
    nameEn: "GDP Growth (Annual %)",
    nameFr: "Croissance du PIB (% annuel)",
    category: "growth",
    unit: "%",
    source: "World Bank national accounts data",
    descAr: "النسبة المئوية للنمو السنوي في الناتج المحلي الإجمالي بأسعار السوق وبناءً على العملة المحلية الثابتة.",
    descEn: "Annual percentage growth rate of GDP at market prices based on constant local currency.",
    descFr: "Taux de croissance annuel en pourcentage du PIB aux prix du marché."
  },
  {
    id: "FP.CPI.TOTL.ZG",
    nameAr: "معدل التضخم السنوي (%)",
    nameEn: "Inflation, consumer prices (Annual %)",
    nameFr: "Inflation, prix à la consommation (% annuel)",
    category: "monetary",
    unit: "%",
    source: "International Monetary Fund, International Financial Statistics",
    descAr: "يعكس التغير السنوي بالنسية المئوية لمتوسط أسعار المستهلك للحصول على سلة من السلع والخدمات.",
    descEn: "Inflation as measured by the consumer price index reflects the annual percentage change in the cost to the average consumer.",
    descFr: "L'inflation mesurée par l'indice des prix à la consommation reflète la variation annuelle."
  },
  {
    id: "SL.UEM.TOTL.ZS",
    nameAr: "معدل البطالة العام (%)",
    nameEn: "Unemployment rate (% of total labor force)",
    nameFr: "Taux de chômage (% de la population active)",
    category: "labor",
    unit: "%",
    source: "International Labour Organization (ILOSTAT) database",
    descAr: "نسبة القوى العاملة التي لا تعمل ولكنها متوفرة وتبحث بنشاط عن عمل.",
    descEn: "Unemployment refers to the share of the labor force that is without work but available for and seeking employment.",
    descFr: "Le chômage désigne la part de la population active sans emploi mais disponible."
  },
  {
    id: "NY.GDP.PCAP.CD",
    nameAr: "نصيب الفرد من الناتج المحلي (US$)",
    nameEn: "GDP per capita (Current US$)",
    nameFr: "PIB par habitant ($ US récents)",
    category: "growth",
    unit: "US$",
    source: "World Bank & OECD National Accounts data",
    descAr: "إجمالي الناتج المحلي مقسوماً على عدد السكان في منتصف العام بالدولار الأمريكي الجاري.",
    descEn: "GDP per capita is gross domestic product divided by midyear population.",
    descFr: "Le PIB par habitant est le produit intérieur brut divisé par la population au milieu de l'année."
  },
  {
    id: "BX.KLT.DINV.WD.GD.ZS",
    nameAr: "الاستثمار الأجنبي المباشر (% من الناتج المحلي)",
    nameEn: "Foreign Direct Investment, net inflows (% of GDP)",
    nameFr: "Investissements directs étrangers (% du PIB)",
    category: "trade",
    unit: "% GDP",
    source: "International Monetary Fund, Balance of Payments database",
    descAr: "صافي التدفقات الوافدة من الاستثمار الأجنبي المباشر للحصول على حصة إدارية دائمة مقسومة على الناتج المحلي.",
    descEn: "Net inflows of investment to acquire a lasting management interest in an enterprise operating in an economy.",
    descFr: "Entrées nettes d'investissements pour acquérir un intérêt durable dans une entreprise."
  },
  {
    id: "NE.EXP.GNFS.ZS",
    nameAr: "الصادرات من السلع والخدمات (% من الناتج المحلي)",
    nameEn: "Exports of goods and services (% of GDP)",
    nameFr: "Exportations de biens et services (% du PIB)",
    category: "trade",
    unit: "% GDP",
    source: "World Bank national accounts data",
    descAr: "قيمة جميع السلع والخدمات المقدمة لبقية العالم كنسبة مئوية من الناتج المحلي الإجمالي.",
    descEn: "Value of all goods and other market services provided to the rest of the world as % of GDP.",
    descFr: "Valeur de tous les biens et autres services fournis au reste du monde."
  },
  {
    id: "NE.IMP.GNFS.ZS",
    nameAr: "الواردات من السلع والخدمات (% من الناتج المحلي)",
    nameEn: "Imports of goods and services (% of GDP)",
    nameFr: "Importations de biens et services (% du PIB)",
    category: "trade",
    unit: "% GDP",
    source: "World Bank national accounts data",
    descAr: "قيمة جميع السلع والخدمات المستلمة من بقية العالم كنسبة مئوية من الناتج المحلي الإجمالي.",
    descEn: "Value of all goods and other market services received from the rest of the world as % of GDP.",
    descFr: "Valeur de tous les biens et autres services reçus du reste du monde."
  },
  {
    id: "NE.GDI.TOTL.ZS",
    nameAr: "إجمالي تكوين رأس المال (% من الناتج المحلي)",
    nameEn: "Gross Capital Formation (% of GDP)",
    nameFr: "Formation brute de capital (% du PIB)",
    category: "trade",
    unit: "% GDP",
    source: "World Bank national accounts data",
    descAr: "الإضافات إلى الأصول الثابتة للاقتصاد بالإضافة إلى التغيرات الصافية في مستويات المخزون.",
    descEn: "Additions to the fixed assets of the economy plus net changes in the level of inventories.",
    descFr: "Additions aux actifs fixes de l'économie plus variations nettes des stocks."
  },
  {
    id: "BN.CAB.XOKA.GD.ZS",
    nameAr: "ميزان الحساب الجاري (% من الناتج المحلي)",
    nameEn: "Current Account Balance (% of GDP)",
    nameFr: "Solde du compte courant (% du PIB)",
    category: "fiscal",
    unit: "% GDP",
    source: "International Monetary Fund, Balance of Payments Statistics",
    descAr: "صافي صادرات السلع والخدمات بالإضافة إلى صافي الدخل والمحولات الجارية مقسوماً على الناتج المحلي.",
    descEn: "Sum of net exports of goods and services, net primary income, and net secondary income as % of GDP.",
    descFr: "Somme des exportations nettes de biens et services, du revenu primaire net et du revenu secondaire net."
  },
  {
    id: "GC.XPN.TOTL.GD.ZS",
    nameAr: "المصروفات الحكومية (% من الناتج المحلي)",
    nameEn: "Government Expenditure (% of GDP)",
    nameFr: "Dépenses publiques (% du PIB)",
    category: "fiscal",
    unit: "% GDP",
    source: "International Monetary Fund, Government Finance Statistics",
    descAr: "المصروفات النقدية للحكومة المركزية لتوفير الخدمات والسلع العامة مقسومة على الناتج المحلي.",
    descEn: "Cash payments for operating activities of the government in providing goods and services.",
    descFr: "Paiements en espèces pour les activités opérationnelles du gouvernement."
  },
  {
    id: "NE.TRD.GNFS.ZS",
    nameAr: "إجمالي التجارة الخارجية (% من الناتج المحلي)",
    nameEn: "Trade (% of GDP)",
    nameFr: "Commerce (% du PIB)",
    category: "trade",
    unit: "% GDP",
    source: "World Bank and OECD national accounts data",
    descAr: "مجموع صادرات وواردات السلع والخدمات مقسوماً على قيمة الناتج المحلي الإجمالي.",
    descEn: "Sum of exports and imports of goods and services measured as a share of gross domestic product.",
    descFr: "Somme des exportations et des importations de biens et services mesurée en part du PIB."
  }
];

export const WorldBankPortal: React.FC<WorldBankPortalProps> = ({
  theme,
  lang,
  currentUser,
  memories,
  wbCountry,
  setWbCountry,
  wbIndicator,
  setWbIndicator,
  wbStartYear,
  setWbStartYear,
  wbEndYear,
  setWbEndYear,
  wbData,
  wbLoading,
  wbCausalAnalysis,
  wbIsAnalyzing,
  runWorldBankCausalAnalysis,
  importWorldBankToMemory,
  wbImportSuccessMsg,
  setWbImportSuccessMsg,
  wbImportErrorMsg,
  setWbImportErrorMsg,
  wbImporting,
  renderTextWithLinks,
  wbError,
  wbSourceInfo = "live",
  retryFetch,
  loadBenchmarkFallback
}) => {
  // Filters & Search local state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [showTechnicalLogs, setShowTechnicalLogs] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chartType, setChartType] = useState<"area" | "line" | "bar">("area");
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedCausalNode, setSelectedCausalNode] = useState<string>("cause");

  const yearsList = useMemo(() => {
    const list = [];
    for (let y = 2025; y >= 1960; y--) {
      list.push(y);
    }
    return list;
  }, []);

  // Selected Country & Indicator Meta
  const currentCountryMeta = useMemo(() => {
    return COUNTRIES_LIST.find(c => c.code === wbCountry) || COUNTRIES_LIST[0];
  }, [wbCountry]);

  const currentIndicatorMeta = useMemo(() => {
    return INDICATORS_LIST.find(i => i.id === wbIndicator) || INDICATORS_LIST[0];
  }, [wbIndicator]);

  // Filtered countries based on search and region
  const filteredCountries = useMemo(() => {
    return COUNTRIES_LIST.filter(c => {
      const matchesSearch =
        c.nameAr.includes(searchQuery) ||
        c.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = selectedRegion === "all" || c.region === selectedRegion;
      return matchesSearch && matchesRegion;
    });
  }, [searchQuery, selectedRegion]);

  // Filtered indicators based on category
  const filteredIndicators = useMemo(() => {
    return INDICATORS_LIST.filter(i => {
      return selectedCategory === "all" || i.category === selectedCategory;
    });
  }, [selectedCategory]);

  // Count of World Bank memories imported in Zakir
  const importedWbMemoriesCount = useMemo(() => {
    return memories.filter(m =>
      m.tags?.some(t => t.toLowerCase().includes("worldbank") || t.toLowerCase().includes("macrointel"))
    ).length;
  }, [memories]);

  // Statistics calculation for current dataset
  const stats = useMemo(() => {
    if (!wbData || wbData.length === 0) {
      return { latest: null, latestYear: wbEndYear, avg: null, max: null, min: null, trend: "stable", change: 0 };
    }
    const validPoints = wbData
      .filter(d => d.value !== null && d.value !== undefined && !isNaN(Number(d.value)))
      .sort((a, b) => Number(a.year) - Number(b.year));

    if (validPoints.length === 0) {
      return { latest: null, latestYear: wbEndYear, avg: null, max: null, min: null, trend: "stable", change: 0 };
    }

    const latestPoint = validPoints[validPoints.length - 1];
    const firstPoint = validPoints[0];

    const values = validPoints.map(d => Number(d.value));
    const latest = latestPoint.value;
    const latestYear = latestPoint.year || wbEndYear;
    const first = firstPoint.value;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    let trend: "up" | "down" | "stable" = "stable";
    const diff = latest - first;
    if (diff > 0.5) trend = "up";
    else if (diff < -0.5) trend = "down";

    return {
      latest,
      latestYear,
      avg: Number(avg.toFixed(2)),
      max: Number(max.toFixed(2)),
      min: Number(min.toFixed(2)),
      trend,
      change: Number(diff.toFixed(2))
    };
  }, [wbData, wbEndYear]);

  const handleStartYearChange = (newStart: number) => {
    setWbStartYear(newStart);
    if (newStart > wbEndYear) {
      setWbEndYear(newStart);
    }
  };

  const handleEndYearChange = (newEnd: number) => {
    setWbEndYear(newEnd);
    if (newEnd < wbStartYear) {
      setWbStartYear(newEnd);
    }
  };

  // Translation helpers
  const getCountryName = (c: CountryMeta) => {
    if (lang === "ar") return c.nameAr;
    if (lang === "fr") return c.nameFr;
    return c.nameEn;
  };

  const getIndicatorName = (i: IndicatorMeta) => {
    if (lang === "ar") return i.nameAr;
    if (lang === "fr") return i.nameFr;
    return i.nameEn;
  };

  const getIndicatorDesc = (i: IndicatorMeta) => {
    if (lang === "ar") return i.descAr;
    if (lang === "fr") return i.descFr;
    return i.descEn;
  };

  return (
    <div className={`mt-8 rounded-3xl border transition-all duration-300 overflow-hidden ${
      theme === "dark" 
        ? "bg-slate-950/80 border-slate-800/90 text-slate-100 shadow-2xl shadow-black/50" 
        : "bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-200/50"
    }`}>
      
      {/* 1. ENTERPRISE HEADER BAR */}
      <div className={`p-6 border-b relative overflow-hidden ${
        theme === "dark"
          ? "bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-slate-800"
          : "bg-gradient-to-r from-slate-50 via-amber-50/30 to-white border-slate-200"
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0075DE]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#0075DE]/15 text-[#0075DE] border border-[#0075DE]/30 flex items-center gap-1">
                <Globe className="w-3 h-3 text-[#0075DE] animate-spin" style={{ animationDuration: '12s' }} />
                <span>World Bank Data v2 API</span>
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-wider">
                {lang === "ar" ? "مزامنة متعددة الأطراف نشطة" : "Active Multilateral Sync"}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-[#0075DE]" />
              <span>
                {lang === "ar" 
                  ? "بوابة البنك الدولي واستخبارات الكلية السببية" 
                  : "World Bank Data Sync & Macro-Intelligence"}
              </span>
            </h2>

            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              {lang === "ar"
                ? "ربط بيانات ومؤشرات البنك الدولي الرسمية مباشرة بنواة 'Zakir' لتشخيص الأثر والتحليل السببي، وتأطير قرارات الاستثمار وسلاسل الإمداد ثم تحويلها إلى ذاكرة مؤسسية نشطة."
                : "Synchronize official World Bank macro indicators directly into Zakir's causal intelligence engine to diagnose cross-departmental risk propagation and convert insights into active corporate memory."}
            </p>
          </div>

          {/* Quick Actions & Meta */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-900 hover:bg-slate-800 border-slate-700 text-[#0075DE]"
                  : "bg-white hover:bg-slate-50 border-slate-300 text-amber-600 shadow-sm"
              }`}
            >
              <Info className="w-4 h-4 text-[#0075DE]" />
              <span>{lang === "ar" ? "تفاصيل المؤشر والمصدر" : "Indicator Source Metadata"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE DASHBOARD SUMMARY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6 border-b border-slate-800/50">
        
        {/* Stat 1: Total Countries */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "ar" ? "الدول والأقاليم المشمولة" : "Covered Jurisdictions"}
            </span>
            <Globe className="w-4 h-4 text-[#0075DE]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#0075DE]">{COUNTRIES_LIST.length}</span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">22 Arab + World</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {lang === "ar" ? "جامعة الدول العربية والتجميعات الكلية" : "Arab League & Global Aggregates"}
          </span>
        </div>

        {/* Stat 2: Indicators */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "ar" ? "المؤشرات الهيكلية" : "Macro Indicators"}
            </span>
            <BarChart2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">{INDICATORS_LIST.length}</span>
            <span className="text-[10px] text-slate-400 font-mono">100% Verified</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {lang === "ar" ? "نمو، تضخم، بطالة، استثمار، تجارة" : "Growth, Inflation, Labor & Trade"}
          </span>
        </div>

        {/* Stat 3: Causal Diagnoses Run */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "ar" ? "تشخيص الأثر السببي" : "Causal Diagnoses"}
            </span>
            <Brain className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400">
              {wbCausalAnalysis ? "1 Active" : "0 Ready"}
            </span>
            <span className="text-[10px] text-cyan-400/80 font-mono">AI Engine</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {lang === "ar" ? "تحليل مترابط للمخاطر الداخلية" : "Cross-Correlated Internal Risk"}
          </span>
        </div>

        {/* Stat 4: Active Memories Imported */}
        <div className={`p-4 rounded-2xl border transition-all ${
          theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50/80 border-slate-200"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "ar" ? "الذكريات النشطة المستوردة" : "Imported Active Memories"}
            </span>
            <Database className="w-4 h-4 text-[#0075DE]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#0075DE]">{importedWbMemoriesCount}</span>
            <span className="text-[10px] text-emerald-500 font-mono font-bold">Synced</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {lang === "ar" ? "مثبتة في الذاكرة المؤسسية" : "Persisted in Corporate Vault"}
          </span>
        </div>

      </div>

      {/* 3. SMART SEARCH & MULTILATERAL FILTERS BAR */}
      <div className="p-6 border-b border-slate-800/50 space-y-4">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === "ar" 
                  ? "ابحث باسم الدولة (مثلاً: موريتانيا، مصر، السعودية) أو الكود..." 
                  : "Search country name or code (e.g., Mauritania, Egypt, SA)..."
              }
              className={`w-full h-10 pr-10 pl-4 border rounded-xl text-xs focus:outline-none focus:border-[#0075DE] transition-all ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500"
                  : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
            {[
              { id: "all", labelAr: "الكل", labelEn: "All Regions" },
              { id: "north_africa", labelAr: "شمال إفريقيا", labelEn: "North Africa" },
              { id: "gcc", labelAr: "دول الخليج", labelEn: "GCC" },
              { id: "levant", labelAr: "بلاد الشام ومصر", labelEn: "Levant & Egypt" },
              { id: "horn_africa", labelAr: "شرق إفريقيا", labelEn: "Horn of Africa" },
              { id: "global", labelAr: "العالم", labelEn: "Global" }
            ].map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => setSelectedRegion(reg.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedRegion === reg.id
                    ? "bg-[#0075DE] text-white shadow-md shadow-[#0075DE]/20"
                    : theme === "dark"
                    ? "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                {lang === "ar" ? reg.labelAr : reg.labelEn}
              </button>
            ))}
          </div>

        </div>

        {/* Category Sector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#0075DE]" />
            <span>{lang === "ar" ? "قطاع المؤشر:" : "Indicator Sector:"}</span>
          </span>
          {[
            { id: "all", labelAr: "جميع القطاعات", labelEn: "All Sectors" },
            { id: "growth", labelAr: "النمو والدخل (GDP)", labelEn: "Growth & GDP" },
            { id: "monetary", labelAr: "التضخم والنقد", labelEn: "Inflation & Monetary" },
            { id: "labor", labelAr: "التشغيل والبطالة", labelEn: "Labor & Employment" },
            { id: "trade", labelAr: "التجارة والاستثمار", labelEn: "Trade & FDI" },
            { id: "fiscal", labelAr: "المالية العامة والحساب الجاري", labelEn: "Fiscal & Current Account" }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-[#0075DE]/20 text-[#0075DE] border border-[#0075DE]/40 font-bold"
                  : theme === "dark"
                  ? "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/60"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {lang === "ar" ? cat.labelAr : cat.labelEn}
            </button>
          ))}
        </div>

        {/* 4. COUNTRY & INDICATOR SELECTION DROPDOWNS & TIME PERIOD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          
          {/* Country Selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>{lang === "ar" ? "اختيار الدولة أو الإقليم المستهدف" : "Select Target Country / Territory"}</span>
              <span className="text-[#0075DE] font-mono">{currentCountryMeta.flag} {currentCountryMeta.code}</span>
            </label>
            <select
              value={wbCountry}
              onChange={(e) => setWbCountry(e.target.value)}
              className={`w-full h-11 px-3 border rounded-xl text-xs font-bold focus:outline-none focus:border-[#0075DE] transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-sm"
              }`}
            >
              {filteredCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {getCountryName(c)} ({c.code}) - [{c.incomeLevel} Income]
                </option>
              ))}
            </select>
          </div>

          {/* Indicator Selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>{lang === "ar" ? "اختيار المؤشر الاقتصادي القياسي" : "Select Macroeconomic Indicator"}</span>
              <span className="text-emerald-500 font-mono text-[10px]">{currentIndicatorMeta.unit}</span>
            </label>
            <select
              value={wbIndicator}
              onChange={(e) => setWbIndicator(e.target.value)}
              className={`w-full h-11 px-3 border rounded-xl text-xs font-bold focus:outline-none focus:border-[#0075DE] transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-sm"
              }`}
            >
              {filteredIndicators.map((i) => (
                <option key={i.id} value={i.id}>
                  📊 {getIndicatorName(i)}
                </option>
              ))}
            </select>
          </div>

          {/* Start Year Selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>{lang === "ar" ? "بداية الفترة الزمنية" : "Period Start Year"}</span>
              <span className="text-[#0075DE] font-mono text-[10px]">{wbStartYear}</span>
            </label>
            <select
              value={wbStartYear}
              onChange={(e) => handleStartYearChange(parseInt(e.target.value))}
              className={`w-full h-11 px-3 border rounded-xl text-xs font-bold focus:outline-none focus:border-[#0075DE] transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-sm"
              }`}
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  📅 {y}
                </option>
              ))}
            </select>
          </div>

          {/* End Year Selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>{lang === "ar" ? "نهاية الفترة الزمنية" : "Period End Year"}</span>
              <span className="text-[#0075DE] font-mono text-[10px]">{wbEndYear}</span>
            </label>
            <select
              value={wbEndYear}
              onChange={(e) => handleEndYearChange(parseInt(e.target.value))}
              className={`w-full h-11 px-3 border rounded-xl text-xs font-bold focus:outline-none focus:border-[#0075DE] transition-all cursor-pointer ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-sm"
              }`}
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  📅 {y}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* 5. MAIN ANALYTICS CHART & KEY METRICS */}
      <div className="p-6 border-b border-slate-800/50 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{currentCountryMeta.flag}</span>
              <h3 className="text-base font-bold text-[#0075DE]">
                {getCountryName(currentCountryMeta)}: {getIndicatorName(currentIndicatorMeta)}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              {getIndicatorDesc(currentIndicatorMeta)}
            </p>
          </div>

          {/* Chart Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-slate-400">{lang === "ar" ? "نوع الرسم:" : "Chart Type:"}</span>
            {[
              { id: "area", icon: AreaIcon, labelAr: "رسم مساحي", labelEn: "Area Chart" },
              { id: "line", icon: LineIcon, labelAr: "رسم خطي", labelEn: "Line Chart" },
              { id: "bar", icon: BarIcon, labelAr: "رسم أعمدة", labelEn: "Bar Chart" }
            ].map((ct) => {
              const Icon = ct.icon;
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setChartType(ct.id as any)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    chartType === ct.id
                      ? "bg-[#0075DE] text-white border-[#0075DE] shadow-sm font-bold"
                      : theme === "dark"
                      ? "bg-slate-900 text-slate-400 hover:text-white border-slate-800"
                      : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                  }`}
                  title={lang === "ar" ? ct.labelAr : ct.labelEn}
                >
                  <Icon className="w-4 h-4" />
                  <span>{lang === "ar" ? ct.labelAr : ct.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CHART AND KEY PERFORMANCE INDICATORS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Chart Box */}
          <div className={`lg:col-span-8 border p-5 rounded-2xl relative overflow-hidden ${
            theme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-slate-50/60 border-slate-200 shadow-sm"
          }`}>
            
            {/* Diagnostic Banner & Source Indicator */}
            {wbError && (
              <div className={`mb-4 p-3.5 rounded-xl border flex flex-col gap-2 text-xs transition-all ${
                wbError.isFallback
                  ? "bg-[#0075DE]/10 border-amber-500/25 text-amber-200"
                  : "bg-blue-500/10 border-blue-500/25 text-blue-200"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-[#0075DE] shrink-0" />
                    <span>{wbError.message}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {retryFetch && (
                      <button
                        onClick={() => retryFetch()}
                        disabled={wbLoading}
                        className="px-3 py-1 rounded-lg bg-[#0075DE]/20 hover:bg-[#0075DE]/30 text-blue-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${wbLoading ? "animate-spin" : ""}`} />
                        <span>{lang === "ar" ? "إعادة المحاولة" : "Retry"}</span>
                      </button>
                    )}
                    {loadBenchmarkFallback && !wbError.isFallback && (
                      <button
                        onClick={() => loadBenchmarkFallback()}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {lang === "ar" ? "تحميل حزمة البيانات المرجعية" : "Load Benchmark Data"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Technical Diagnostic Drawer Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-amber-500/15 text-[10px] text-slate-400">
                  <button 
                    onClick={() => setShowTechnicalLogs(!showTechnicalLogs)}
                    className="hover:text-[#0075DE] transition-colors flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{showTechnicalLogs ? (lang === "ar" ? "إخفاء التفاصيل الفنية واللُّوج" : "Hide Diagnostic Logs") : (lang === "ar" ? "عرض سجلات التشخيص الفني ومسار الطلب" : "View Diagnostic Technical Logs")}</span>
                  </button>
                  {wbError.timestamp && <span className="font-mono text-[10px] opacity-75">{wbError.timestamp}</span>}
                </div>

                {/* Technical Logs Details Drawer */}
                {showTechnicalLogs && (
                  <div className="mt-1 p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1 overflow-x-auto">
                    <div><strong className="text-[#0075DE]">Request Proxy Endpoint:</strong> /api/world-bank?country={wbCountry}&indicator={wbIndicator}</div>
                    <div><strong className="text-[#0075DE]">Attempted Direct URL:</strong> {wbError.attemptedUrl || `https://api.worldbank.org/v2/country/${wbCountry}/indicator/${wbIndicator}?format=json`}</div>
                    {wbError.statusCode && <div><strong className="text-[#0075DE]">HTTP Response Status:</strong> {wbError.statusCode}</div>}
                    {wbError.latencyMs && <div><strong className="text-[#0075DE]">Latency:</strong> {wbError.latencyMs} ms</div>}
                    {wbError.technicalDetails && <div><strong className="text-[#0075DE]">Technical Diagnostic Cause:</strong> {wbError.technicalDetails}</div>}
                  </div>
                )}
              </div>
            )}

            {wbLoading ? (
              <div className="h-72 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-9 h-9 text-[#0075DE] animate-spin" />
                <span className="text-xs text-slate-400 font-bold">
                  {lang === "ar" ? "جاري الاتصال وسحب بيانات البنك الدولي مباشرة..." : "Fetching live data feeds from World Bank API..."}
                </span>
              </div>
            ) : wbData.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-center p-6 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0075DE]/10 border border-amber-500/20 text-[#0075DE] flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h4 className="text-sm font-bold text-slate-200">
                    {lang === "ar" ? "تعذر استخراج بيانات هذا المؤشر اللحظية" : "Unable to load live indicator data"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {lang === "ar" 
                      ? "لم يرجع سيرفر البنك الدولي سجلات قياسية لهذا المؤشر حالياً، أو تم حظر الطلب بسبب حدود الشبكة. يمكنك إعادة المحاولة أو تفعيل البيانات المرجعية."
                      : "World Bank API did not return data for this indicator or connection timed out. Retry connection or load benchmark records."}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  {retryFetch && (
                    <button
                      onClick={() => retryFetch()}
                      className="px-4 py-2 rounded-xl bg-[#0075DE] hover:bg-[#c4a02e] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === "ar" ? "إعادة محاولة اتصال API" : "Retry API Call"}</span>
                    </button>
                  )}
                  {loadBenchmarkFallback && (
                    <button
                      onClick={() => loadBenchmarkFallback()}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer"
                    >
                      <span>{lang === "ar" ? "تحميل البيانات المرجعية التقديرية" : "Load Benchmark Dataset"}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between mb-4 pb-2 border-b border-slate-800/40 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0075DE] bg-[#0075DE]/10 px-2.5 py-1 rounded-lg border border-[#0075DE]/20">
                      {currentCountryMeta.flag} {wbData[0]?.country || getCountryName(currentCountryMeta)}
                    </span>
                    
                    {/* Source Status Pill */}
                    {wbSourceInfo === "live" && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {lang === "ar" ? "ربط حي مباشر (World Bank Live)" : "Live API Synced"}
                      </span>
                    )}
                    {wbSourceInfo === "direct" && (
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {lang === "ar" ? "اتصال متصفح مباشر" : "Browser Direct"}
                      </span>
                    )}
                    {wbSourceInfo === "fallback" && (
                      <span className="text-[10px] font-bold text-[#0075DE] bg-[#0075DE]/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {lang === "ar" ? "بيانات مرجعية معتمدة" : "Verified Benchmark Data"}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    Sourced: {currentIndicatorMeta.source} ({wbStartYear}-{wbEndYear})
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "area" ? (
                      <AreaChart data={wbData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="wbPortalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-color, #0075DE)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="var(--accent-color, #0075DE)" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--accent-color, #0075DE)",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "var(--text-primary)"
                          }}
                        />
                        <Area type="monotone" dataKey="value" stroke="var(--accent-color, #0075DE)" strokeWidth={2.5} fillOpacity={1} fill="url(#wbPortalGrad)" />
                      </AreaChart>
                    ) : chartType === "line" ? (
                      <LineChart data={wbData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--accent-color, #0075DE)",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "var(--text-primary)"
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="var(--accent-color, #0075DE)" strokeWidth={3} dot={{ fill: 'var(--accent-color, #0075DE)', r: 4 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={wbData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="year" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--accent-color, #0075DE)",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "var(--text-primary)"
                          }}
                        />
                        <Bar dataKey="value" fill="var(--accent-color, #0075DE)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </>
            )}

          </div>

          {/* Key Metrics Cards Column */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* Metric 1: Latest Value */}
            <div className={`p-4 rounded-xl border ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  {lang === "ar" ? `أحدث قيمة مسجلة (${stats.latestYear || wbEndYear})` : `Latest Value (${stats.latestYear || wbEndYear})`}
                </span>
                {stats.trend === "up" ? (
                  <span className="flex items-center text-xs text-rose-500 font-bold gap-0.5">
                    <ArrowUpRight className="w-4 h-4" />
                    +{stats.change}
                  </span>
                ) : stats.trend === "down" ? (
                  <span className="flex items-center text-xs text-emerald-500 font-bold gap-0.5">
                    <ArrowDownRight className="w-4 h-4" />
                    {stats.change}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-bold">Stable</span>
                )}
              </div>
              <div className="text-2xl font-black text-[#0075DE] mt-1 font-mono">
                {stats.latest !== null ? `${stats.latest} ${currentIndicatorMeta.unit}` : "N/A"}
              </div>
            </div>

            {/* Metric 2: 10-Year Average */}
            <div className={`p-4 rounded-xl border ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {lang === "ar" 
                  ? `متوسط الفترة (${wbStartYear}-${wbEndYear})` 
                  : `${wbEndYear - wbStartYear + 1}-Year Average (${wbStartYear}-${wbEndYear})`}
              </span>
              <div className="text-xl font-bold text-slate-200 font-mono">
                {stats.avg !== null ? `${stats.avg} ${currentIndicatorMeta.unit}` : "N/A"}
              </div>
            </div>

            {/* Metric 3: Range (Min / Max) */}
            <div className={`p-4 rounded-xl border ${
              theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
                {lang === "ar" ? "نطاق التقلبات (أدنى ⇆ أعلى)" : "Volatility Range (Min ⇆ Max)"}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                  <span className="block text-[9px] opacity-75">{lang === "ar" ? "أعلى قيمة:" : "Max:"}</span>
                  {stats.max !== null ? `${stats.max} ${currentIndicatorMeta.unit}` : "N/A"}
                </div>
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                  <span className="block text-[9px] opacity-75">{lang === "ar" ? "أدنى قيمة:" : "Min:"}</span>
                  {stats.min !== null ? `${stats.min} ${currentIndicatorMeta.unit}` : "N/A"}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 6. AI CAUSAL IMPACT DIAGNOSIS & INTERACTIVE CAUSAL GRAPH */}
      <div className="p-6 border-b border-slate-800/50 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#0075DE] flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#0075DE] animate-pulse" />
              <span>{lang === "ar" ? "تشخيص الأثر المباشر والتحليل السببي الهيكلي" : "Causal Impact & Structural Diagnosis Engine"}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "ar"
                ? "ربط بيانات البنك الدولي برادارات المخاطر الداخلية لاستنباط الأسباب، النتائج، ومصفوفة الفرص والمخاطر التنفيذية"
                : "Correlate international datasets with internal risk profiles to extract root causes, outcomes, and CEO recommendations."}
            </p>
          </div>

          {/* Run Analysis Button */}
          <button
            type="button"
            onClick={(e) => runWorldBankCausalAnalysis(e)}
            disabled={wbIsAnalyzing || wbLoading}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
              wbIsAnalyzing
                ? "bg-[#0075DE]/50 text-slate-900 cursor-not-allowed"
                : "bg-[#0075DE] hover:bg-amber-400 text-slate-950 shadow-[#0075DE]/20 hover:scale-[1.02]"
            }`}
          >
            {wbIsAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                <span>{lang === "ar" ? "جاري التشخيص والربط السببي..." : "Diagnosing Macro Correlations..."}</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>{lang === "ar" ? "تشخيص الأثر والتحليل السببي" : "Diagnose Impact & Causal Correlation"}</span>
              </>
            )}
          </button>
        </div>

        {/* INTERACTIVE VISUAL CAUSAL GRAPH (MOCK / DYNAMIC FLOW NODES) */}
        <div className={`p-5 rounded-2xl border ${
          theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/40 pb-2">
            <span className="text-xs font-bold text-[#0075DE] flex items-center gap-1.5 uppercase">
              <GitMerge className="w-4 h-4" />
              {lang === "ar" ? "مخطط القنوات والعلاقات السببية التفاعلي" : "Interactive Causal Node Flow"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">World Bank ⇆ Zakir Causal Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2 relative">
            
            {/* Node 1: World Bank Indicator */}
            <div
              onClick={() => setSelectedCausalNode("cause")}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedCausalNode === "cause"
                  ? "bg-[#0075DE]/15 border-[#0075DE] text-white shadow-md"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-[9px] font-bold uppercase text-[#0075DE] block mb-1">
                1. {lang === "ar" ? "مؤشر البنك الدولي" : "World Bank Indicator"}
              </span>
              <p className="text-xs font-bold text-slate-200">
                {currentIndicatorMeta.nameAr}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                {currentCountryMeta.flag} {currentCountryMeta.nameAr}
              </span>
            </div>

            {/* Node 2: Causal Mechanism */}
            <div
              onClick={() => setSelectedCausalNode("mechanism")}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedCausalNode === "mechanism"
                  ? "bg-[#0075DE]/15 border-amber-500 text-white shadow-md"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-[9px] font-bold uppercase text-[#0075DE] block mb-1">
                2. {lang === "ar" ? "محركات الأثر والعدوى" : "Causal Transmission"}
              </span>
              <p className="text-xs font-bold text-slate-200">
                {lang === "ar" ? "سلاسل التوريد وتكاليف الصرف" : "Supply Chains & FX Rates"}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Macro-Correlation
              </span>
            </div>

            {/* Node 3: Corporate Exposure */}
            <div
              onClick={() => setSelectedCausalNode("impact")}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedCausalNode === "impact"
                  ? "bg-cyan-500/15 border-cyan-500 text-white shadow-md"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-[9px] font-bold uppercase text-cyan-400 block mb-1">
                3. {lang === "ar" ? "التعرض المالي والتشغيلي" : "Corporate Risk Exposure"}
              </span>
              <p className="text-xs font-bold text-slate-200">
                {lang === "ar" ? "هوامش الربح ورأس المال" : "Profit Margins & Capital"}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Departmental Level
              </span>
            </div>

            {/* Node 4: Active Corporate Memory */}
            <div
              onClick={() => setSelectedCausalNode("memory")}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedCausalNode === "memory"
                  ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="text-[9px] font-bold uppercase text-emerald-400 block mb-1">
                4. {lang === "ar" ? "القرار والذاكرة المؤسسية" : "Strategic Corporate Memory"}
              </span>
              <p className="text-xs font-bold text-slate-200">
                {lang === "ar" ? "تثبيت بروتوكول تحوط دائم" : "Hedging Protocol & Vault"}
              </p>
              <span className="text-[10px] text-emerald-400 block mt-1 font-mono">
                ZAKIR Memory Node
              </span>
            </div>

          </div>
        </div>

        {/* CAUSAL ANALYSIS RESULT TEXT CARD */}
        {wbCausalAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border space-y-4 ${
              theme === "dark" 
                ? "bg-slate-900/60 border-slate-800" 
                : "bg-amber-50/30 border-amber-200/80 shadow-inner"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#0075DE] animate-pulse" />
                <h4 className="text-xs font-bold text-[#0075DE] uppercase tracking-wider">
                  {lang === "ar" 
                    ? "تقرير تشخيص الأثر الكلي المتبادل (البنك الدولي ⇆ Zakir)" 
                    : "Executive Causal Correlation Report (World Bank ⇆ ZAKIR)"}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                Certified Report
              </span>
            </div>

            <div className="prose prose-invert prose-xs max-w-none leading-relaxed">
              <div className={`text-xs leading-relaxed whitespace-pre-wrap ${
                theme === "dark" ? "text-slate-200" : "text-slate-800"
              }`}>
                {renderTextWithLinks(wbCausalAnalysis)}
              </div>
            </div>
          </motion.div>
        )}

      </div>

      {/* 7. ACTIVE CORPORATE MEMORY IMPORT PANEL & MESSAGES */}
      <div className="p-6 bg-slate-900/30 space-y-4">
        
        {/* Toast Error Banner */}
        <AnimatePresence>
          {wbImportErrorMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{wbImportErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setWbImportErrorMsg("")}
                className="text-rose-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-rose-500/20 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Success Banner */}
        <AnimatePresence>
          {wbImportSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{wbImportSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setWbImportSuccessMsg("")}
                className="text-emerald-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-emerald-500/20 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-right sm:text-right w-full sm:w-auto">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#0075DE]" />
              <span>{lang === "ar" ? "تثبيت البيانات في الذاكرة المؤسسية النشطة" : "Persist Intel to Active Corporate Memory"}</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {lang === "ar"
                ? "عند الضغط على الزر، سيتم حفظ هذا السجل والتحليل السببي فوراً في قاعدة البيانات وتنشيطه عبر كافة الأقسام."
                : "Importing persists this dataset and causal diagnosis directly to Firestore and local memory banks."}
            </p>
          </div>

          {/* IMPORT BUTTON */}
          <button
            type="button"
            onClick={(e) => importWorldBankToMemory(e)}
            disabled={wbLoading || wbIsAnalyzing || wbImporting || !wbCausalAnalysis}
            title={!wbCausalAnalysis ? (lang === "ar" ? "يرجى إجراء تشخيص الأثر والتحليل السببي أولاً" : "Execute Causal Diagnosis first") : ""}
            className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer ${
              !wbCausalAnalysis
                ? "bg-slate-800/40 text-slate-500 border border-slate-800/80 cursor-not-allowed opacity-60"
                : "bg-slate-900 hover:bg-slate-800 text-[#0075DE] border border-[#0075DE]/40 hover:border-[#0075DE] shadow-xl hover:scale-[1.02]"
            }`}
          >
            {wbImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#0075DE]" />
                <span>{lang === "ar" ? "جاري استيراد ك ذاكرة مؤسسية نشطة" : "Importing to Active Memory..."}</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4 text-[#0075DE]" />
                <span>{lang === "ar" ? "استيراد كـ ذاكرة مؤسسية نشطة" : "Import as Active Corporate Memory"}</span>
              </>
            )}
          </button>
        </div>

        {!wbCausalAnalysis && (
          <p className="text-[11px] text-[#0075DE]/90 font-medium text-center pt-1 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#0075DE] shrink-0" />
            <span>
              {lang === "ar" 
                ? "ملاحظة: يتعين إجراء 'تشخيص الأثر والتحليل السببي' أولاً لتنشيط زر الاستيراد إلى الذاكرة المؤسسية." 
                : "Note: Execute 'Diagnose Impact & Causal Correlation' first to activate the memory import button."}
            </span>
          </p>
        )}

      </div>

      {/* 8. DETAIL METADATA MODAL / SHEET */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6 space-y-5 shadow-2xl ${
                theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#0075DE]" />
                  <h3 className="text-base font-bold text-[#0075DE]">
                    {lang === "ar" ? "بطاقة تفاصيل المؤشر والمصدر الدولي" : "Indicator Metadata & Source Details"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{lang === "ar" ? "اسم المؤشر القياسي:" : "Indicator Name:"}</span>
                  <span className="text-sm font-bold text-slate-200">{getIndicatorName(currentIndicatorMeta)}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{lang === "ar" ? "الكود الدولي (World Bank Code):" : "World Bank Indicator Code:"}</span>
                  <span className="font-mono text-[#0075DE] font-bold">{currentIndicatorMeta.id}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">{lang === "ar" ? "الوصف الهيكلي:" : "Description:"}</span>
                  <p className="text-slate-300 mt-1">{getIndicatorDesc(currentIndicatorMeta)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lang === "ar" ? "مصدر البيانات الرسمي:" : "Official Data Source:"}</span>
                    <span className="font-bold text-slate-200">{currentIndicatorMeta.source}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lang === "ar" ? "دورية التحديث:" : "Update Frequency:"}</span>
                    <span className="font-bold text-emerald-400">Annual (سنوي معتمد)</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0075DE] text-white font-bold text-xs cursor-pointer"
                >
                  {lang === "ar" ? "إغلاق النافذة" : "Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
