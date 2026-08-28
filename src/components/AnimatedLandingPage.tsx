import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Brain, 
  ShieldAlert, 
  Layers, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Compass,
  ChevronDown,
  HelpCircle,
  Zap,
  Sun,
  Moon,
  Globe,
  Languages
} from "lucide-react";
import { ZakirLogo } from "./ZakirLogo";
import { LandingAnimatedBackground } from "./LandingAnimatedBackground";
import { AnimatedSection } from "./AnimatedSection";
import { CompactLanguageSwitcher } from "./ui/CompactLanguageSwitcher";

// Lazy load the heavy ProductShowcaseWindow demo component
const ProductShowcaseWindow = lazy(() => import("./ProductShowcaseWindow"));

// Reusable Spring & Easing Presets
const transitionSmooth = { duration: 0.6, ease: "easeOut" as const };

// Count-Up Stat Component
const StatCounterItem: React.FC<{
  targetValue: number;
  suffix: string;
  prefix?: string;
  decimals?: number;
  label: string;
  sublabel?: string;
  theme: "dark" | "light";
}> = ({ targetValue, suffix, prefix = "", decimals = 0, label, sublabel, theme }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let start = 0;
          const duration = 1400;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setVal(start + (targetValue - start) * easeOut);
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [targetValue]);

  return (
    <motion.div 
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={transitionSmooth}
      ref={ref} 
      className={`p-6 rounded-2xl ${
        theme === 'light' 
          ? 'bg-white border border-slate-200 shadow-lg text-slate-900' 
          : 'bg-slate-900/80 border border-slate-800/90 shadow-xl shadow-slate-950/40 text-slate-100'
      } backdrop-blur-md cursor-pointer group transition-colors hover:border-[#0075DE]/40`}
    >
      <div className="text-3xl sm:text-4xl font-black text-[#0075DE] font-mono tracking-tight group-hover:text-[#0075DE] transition-colors">
        {prefix}{val.toFixed(decimals)}{suffix}
      </div>
      <div className={`text-xs font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'} mt-2`}>{label}</div>
      {sublabel && <div className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} font-medium mt-0.5`}>{sublabel}</div>}
    </motion.div>
  );
};

// FAQ Accordion Item Component
const FAQAccordionItem: React.FC<{
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  theme: "dark" | "light";
}> = ({ question, answer, isOpen, onToggle, theme }) => {
  return (
    <motion.div 
      initial={false}
      className={`border ${theme === 'light' ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-800/90 bg-slate-900/60'} rounded-xl overflow-hidden transition-colors hover:border-slate-700`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'} text-sm focus:outline-none cursor-pointer`}
      >
        <span className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-[#0075DE] shrink-0" />
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-slate-400 shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={`px-5 pb-5 text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed border-t ${theme === 'light' ? 'border-slate-100' : 'border-slate-800/50'} pt-3`}>
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface AnimatedLandingPageProps {
  lang: "ar" | "en" | "fr";
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleLanguage: (lang: "ar" | "en" | "fr") => void;
  onNavigateAuth: (mode: "login" | "register") => void;
  onStripeCheckout: (plan: string) => void;
}

export const AnimatedLandingPage: React.FC<AnimatedLandingPageProps> = ({
  lang,
  theme,
  onToggleTheme,
  onToggleLanguage,
  onNavigateAuth,
  onStripeCheckout,
}) => {
  const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">("annual");
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(0);
  const prefersReducedMotion = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isRTL = lang === "ar";
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Staggered variants for Framer-style Hero sequential reveal
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitionSmooth,
    },
  };

  // FAQ Data
  const faqs = [
    {
      q: lang === "ar" ? "كيف يضمن نظام ZAKIR سرية وأمان البيانات المؤسسية؟" : "How does ZAKIR ensure security & confidentiality?",
      a: lang === "ar" 
        ? "تخضع البيانات للتشفير التام (AES-256) أثناء التخزين والنقل. نطبق نظام التحكم بالوصول المبني على الأدوار (RBAC) لضمان عدم اطلاع أي طرف غير مخول على السجلات."
        : "All data is encrypted end-to-end (AES-256) at rest and in transit. We enforce strict Role-Based Access Control (RBAC) to ensure unauthorized personnel cannot view sensitive decision records."
    },
    {
      q: lang === "ar" ? "ما الفرق بين ZAKIR وأدوات إدارة المستندات التقليدية؟" : "How is ZAKIR different from standard document management?",
      a: lang === "ar"
        ? "أدوات المستندات تخزن النصوص فقط، بينما يبني ZAKIR رسم بياني سببي يربط القرار بالمحفزات، والنتائج التشغيلية، وقواعد الحوكمة، للتنبؤ بالمخاطر المستقبلية."
        : "Standard tools only store static text. ZAKIR constructs an active causal graph mapping decisions directly to root causes, operational outcomes, and governance rules."
    },
    {
      q: lang === "ar" ? "هل يمكن ربط النظام مع مصادر البيانات الخارجية كالبنك الدولي؟" : "Can ZAKIR connect to external feeds like the World Bank?",
      a: lang === "ar"
        ? "نعم، يتضمن ZAKIR محرك مزامنة مباشر مع مؤشرات البنك الدولي، وسجلات العقوبات المحدثة، لمعايرة القرارات المؤسسية بسلاسة."
        : "Yes, ZAKIR integrates real-time synchronization with World Bank macro feeds, IMF indicators, and sanctions lists to benchmark decisions dynamically."
    },
    {
      q: lang === "ar" ? "كيف أبدأ بتجربة النظام للمؤسسة؟" : "How do we get started?",
      a: lang === "ar"
        ? "يمكنك تسجيل الدخول فوراً عبر خيار الوصول للنظام، أو طلب استشارة مخصصة لربط الخزينة المؤسسية ببيانات مؤسستك."
        : "You can instantly access the system using the login portal or subscribe to a plan to start archiving institutional memory."
    }
  ];

  return (
    <div className={`min-h-screen ${theme === "light" ? "bg-[#F0F2F5] text-[#0F172A]" : "bg-[#0B0F19] text-[#F8FAFC]"} flex flex-col relative selection:bg-[#0075DE]/30 font-sans overflow-x-hidden transition-colors duration-300`}>
      {/* Premium Ambient Background with Zakir Gold Ambient Motion */}
      <LandingAnimatedBackground theme={theme} />

      {/* Header / Navigation Bar with Micro-Interactions */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? (theme === "light" ? "bg-white/95 shadow-lg border-b border-slate-200" : "bg-slate-950/95 shadow-xl border-b border-slate-800") 
          : (theme === "light" ? "bg-white/80 border-b border-slate-200/60" : "bg-slate-950/80 border-b border-slate-800/60")
      } px-4 sm:px-6 py-3.5 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo Branding */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onNavigateAuth("login")}
            className="flex items-center gap-3 cursor-pointer"
          >
            <ZakirLogo theme={theme} lang={lang} />
          </motion.div>

          {/* Navigation Links with Micro-Interactions */}
          <nav className={`hidden md:flex items-center gap-8 text-xs font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            <motion.a 
              whileHover={{ scale: 1.05, color: "#F59E0B" }}
              whileTap={{ scale: 0.95 }}
              href="#story" 
              className="transition-colors"
            >
              {lang === "ar" ? "قصة المنصة" : (lang === "fr" ? "Notre Histoire" : "Platform Story")}
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05, color: "#F59E0B" }}
              whileTap={{ scale: 0.95 }}
              href="#features" 
              className="transition-colors"
            >
              {lang === "ar" ? "المميزات" : (lang === "fr" ? "Fonctionnalités" : "Capabilities")}
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05, color: "#F59E0B" }}
              whileTap={{ scale: 0.95 }}
              href="#ai-analysis" 
              className="transition-colors"
            >
              {lang === "ar" ? "الذكاء الاصطناعي" : (lang === "fr" ? "Analyse IA" : "AI Intelligence")}
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.05, color: "#F59E0B" }}
              whileTap={{ scale: 0.95 }}
              href="#pricing" 
              className="transition-colors"
            >
              {lang === "ar" ? "الأسعار" : (lang === "fr" ? "Tarifs" : "Pricing")}
            </motion.a>
          </nav>

          {/* Controls & CTAs with Micro-Interactions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Theme Toggle Button */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                theme === "light"
                  ? "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-[#0075DE] hover:bg-slate-800"
              }`}
              aria-label="Toggle Theme"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === "dark" ? (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="w-4 h-4 text-[#0075DE]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="w-4 h-4 text-slate-700" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Modern Compact Language Selector with Hover & Tap behavior */}
            <CompactLanguageSwitcher 
              lang={lang} 
              onToggleLanguage={onToggleLanguage} 
              theme={theme}
              align="right"
            />

            {/* Login Button */}
            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: "rgba(245, 158, 11, 0.05)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigateAuth("login")}
              className={`hidden sm:inline-flex text-xs md:text-sm font-semibold px-3 py-2 ${theme === 'light' ? 'text-slate-700 hover:text-black' : 'text-slate-300 hover:text-white'} transition-colors cursor-pointer`}
            >
              {lang === "ar" ? "تسجيل الدخول" : (lang === "fr" ? "Se connecter" : "Login")}
            </motion.button>

            {/* Access System Primary Button */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigateAuth("login")}
              className="bg-[#0075DE] hover:bg-[#005BAB] text-white text-xs md:text-sm font-black px-3.5 sm:px-4 py-2 rounded-lg shadow-lg shadow-[#0075DE]/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{lang === "ar" ? "الوصول للنظام" : (lang === "fr" ? "Accéder au système" : "Access System")}</span>
              <ChevronIcon className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 space-y-24 py-12">
        {/* HERO SECTION - CLEAN, MINIMAL & FOCUSED ON PRODUCT VALUE */}
        <section className="px-6 pt-8 pb-12">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto text-center relative z-10 space-y-6"
          >
            {/* Eyebrow badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] text-xs font-mono font-bold tracking-wider">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} />
              <span>
                {lang === "ar" ? "الذاكرة المؤسسية والذكاء السببي" : (lang === "fr" ? "Mémoire Institutionnelle & Intelligence Causale" : "Institutional Memory & Causal Intelligence")}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={itemVariants} className={`text-3xl sm:text-5xl md:text-6xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'} leading-[1.12]`}>
              {lang === "ar" 
                ? "حوّل النسيان المؤسسي إلى أصل تشغيلي." 
                : (lang === "fr" 
                  ? "Transformez l'oubli institutionnel en un actif opérationnel." 
                  : "Turn institutional forgetting into an operational asset.")}
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={itemVariants} className={`${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} text-base md:text-lg max-w-2xl mx-auto leading-relaxed`}>
              {lang === "ar" 
                ? "نظام صُمّم لحماية المؤسسات من التكرار المكلف للأخطاء عبر ربط القرارات بالنتائج التشغيلية وقواعد الحوكمة."
                : (lang === "fr" 
                  ? "Un système conçu pour protéger les organisations contre la répétition coûteuse des erreurs en reliant les décisions aux résultats opérationnels."
                  : "Designed to protect enterprises from costly recurring mistakes by mapping decisions directly to systemic outcomes and governance rules.")}
            </motion.p>

            {/* Action CTAs */}
            <motion.div variants={itemVariants} className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onNavigateAuth("login")}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#0075DE] hover:bg-[#005BAB] text-white font-black text-sm shadow-xl shadow-[#0075DE]/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{lang === "ar" ? "الوصول للنظام الآن" : (lang === "fr" ? "Accéder au Système" : "Access Zakir System")}</span>
                <ChevronIcon className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </motion.div>

          {/* CINEMATIC INTERACTIVE PRODUCT SHOWCASE */}
          <motion.div variants={itemVariants} className="mt-12 max-w-5xl mx-auto w-full">
            <Suspense fallback={
              <div className={`w-full aspect-[16/9] min-h-[460px] md:min-h-[560px] ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800/80'} rounded-3xl border flex items-center justify-center`}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-4 border-[#0075DE]/20 border-t-[#0075DE] animate-spin" />
                  <span className={`${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} text-xs font-mono font-bold animate-pulse`}>
                    {lang === "ar" ? "جاري تحميل محاكاة المنصة التفاعلية..." : (lang === "fr" ? "Chargement de la simulation interactive..." : "Loading interactive walkthrough...")}
                  </span>
                </div>
              </div>
            }>
              <ProductShowcaseWindow lang={lang} />
            </Suspense>
          </motion.div>
        </section>

        {/* INSTITUTIONAL METRICS & PERFORMANCE IMPACT */}
        <AnimatedSection className="px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <StatCounterItem 
              targetValue={99.8} 
              decimals={1} 
              suffix="%" 
              label={lang === "ar" ? "حفظ سياق الذاكرة المؤسسية" : (lang === "fr" ? "Rétention du Contexte" : "Context Retention")} 
              theme={theme}
            />
            <StatCounterItem 
              targetValue={100} 
              decimals={0} 
              suffix="%" 
              label={lang === "ar" ? "التتبع والتصنيف التلقائي" : (lang === "fr" ? "Traçabilité Intégrale" : "Audited Decision Lineage")} 
              theme={theme}
            />
            <StatCounterItem 
              prefix="< "
              targetValue={1.2} 
              decimals={1} 
              suffix="s" 
              label={lang === "ar" ? "سرعة استرجاع السوابق التلقائية" : (lang === "fr" ? "Vitesse de Recherche" : "Precedent Retrieval Speed")} 
              theme={theme}
            />
            <StatCounterItem 
              targetValue={0} 
              decimals={0} 
              suffix="%" 
              label={lang === "ar" ? "تكرار الأخطاء التشغيلية" : (lang === "fr" ? "Récurrence d'Erreurs" : "Context Loss Rate")} 
              theme={theme}
            />
          </div>
        </AnimatedSection>

        {/* VISUAL STORYTELLING: PROBLEM → SOLUTION → PATTERNS → FUTURE */}
        <AnimatedSection id="story" className="px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className={`px-3 py-1 rounded-full ${theme === 'light' ? 'bg-slate-100 border-slate-300 text-[#0075DE]' : 'bg-slate-900 border-slate-800 text-[#0075DE]'} border text-xs font-mono font-bold uppercase tracking-widest`}>
              {lang === "ar" ? "قصة التحول المعرفي" : (lang === "fr" ? "Histoire de la Transformation des Connaissances" : "Knowledge Transformation Story")}
            </span>
            <h2 className={`text-2xl md:text-4xl font-extrabold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {lang === "ar" ? "من التشتت والتكرار إلى أصل معرفي دائم" : (lang === "fr" ? "De l'Attrition des Connaissances à un Actif Stratégique Permanent" : "From Knowledge Decay to Permanent Strategic Asset")}
            </h2>
            <p className={`${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} text-sm`}>
              {lang === "ar" ? "كيف يحول ZAKIR الذاكرة الفردية العابرة إلى أصل مؤسسي محمي" : (lang === "fr" ? "Comment ZAKIR transforme la mémoire personnelle éphémère en intelligence institutionnelle protégée" : "How ZAKIR converts fleeting personal memory into protected institutional intelligence")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Story Stage 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(245, 158, 11, 0.4)" }}
              whileTap={{ scale: 0.97 }}
              className={`p-6 rounded-2xl ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-900 shadow-md' 
                  : 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl'
              } border space-y-4 relative cursor-pointer transition-colors hover:border-[#0075DE]/40`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0075DE]/10 text-[#0075DE] dark:text-[#0075DE] border border-[#0075DE]/20 flex items-center justify-center font-mono font-bold text-xs">
                01
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{lang === "ar" ? "1. التشتت والنسيان" : (lang === "fr" ? "1. Attrition du Contexte" : "1. Context Decay")}</h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" 
                  ? "تضيع سياقات القرارات الحاسمة في البريد الإلكتروني والاجتماعات الشفهية. عند مغادرة الكوادر، تتلاشى الذاكرة المؤسسية."
                  : (lang === "fr"
                    ? "Le contexte décisionnel critique se dissout dans les e-mails et réunions. Lorsque les dirigeants changent, la mémoire institutionnelle disparaît."
                    : "Critical decision context dissolves across inbox silos and verbal meetings. When leaders rotate, institutional memory vanishes.")}
              </p>
            </motion.div>

            {/* Story Stage 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(245, 158, 11, 0.4)" }}
              whileTap={{ scale: 0.97 }}
              className={`p-6 rounded-2xl ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-900 shadow-md' 
                  : 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl'
              } border space-y-4 relative cursor-pointer transition-colors hover:border-[#0075DE]/40`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0075DE]/10 text-[#0075DE] dark:text-[#0075DE] border border-[#0075DE]/20 flex items-center justify-center font-mono font-bold text-xs">
                02
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{lang === "ar" ? "2. التوثيق الموثوق" : (lang === "fr" ? "2. Capture Causale" : "2. Causal Capture")}</h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" 
                  ? "يسجل ZAKIR التسلسل المباشر: السبب الشكلي ← القرار المتخذ ← النتيجة الميدانية ← القاعدة التنظيمية المكتسبة."
                  : (lang === "fr"
                    ? "ZAKIR capture la chaîne causale exacte : Déclencheur Racine → Décision Prise → Résultat Systémique → Règle de Gouvernance."
                    : "ZAKIR captures the exact causal chain: Root Trigger → Decision Taken → Systemic Outcome → Permanent Governance Rule.")}
              </p>
            </motion.div>

            {/* Story Stage 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(245, 158, 11, 0.4)" }}
              whileTap={{ scale: 0.97 }}
              className={`p-6 rounded-2xl ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-900 shadow-md' 
                  : 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl'
              } border space-y-4 relative cursor-pointer transition-colors hover:border-[#0075DE]/40`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0075DE]/10 text-[#0075DE] dark:text-[#0075DE] border border-[#0075DE]/20 flex items-center justify-center font-mono font-bold text-xs">
                03
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{lang === "ar" ? "3. اكتشاف الأنماط" : (lang === "fr" ? "3. Analyse de Modèles" : "3. Pattern Mining")}</h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" 
                  ? "يقوم الذكاء الاصطناعي بربط السوابق التاريخية المتشابهة لتحديد المخاطر الخفية والتنبؤ بتبعات القرارات الجديدة."
                  : (lang === "fr"
                    ? "L'IA cartographie les antécédents historiques pour identifier les risques récurrents et simuler les impacts opérationnels."
                    : "AI algorithms map historical precedents to identify recurring risk vectors and simulate prospective operational impacts.")}
              </p>
            </motion.div>

            {/* Story Stage 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(245, 158, 11, 0.4)" }}
              whileTap={{ scale: 0.97 }}
              className={`p-6 rounded-2xl ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-900 shadow-md' 
                  : 'bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-xl'
              } border space-y-4 relative cursor-pointer transition-colors hover:border-[#0075DE]/40`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0075DE]/10 text-[#0075DE] dark:text-[#0075DE] border border-[#0075DE]/20 flex items-center justify-center font-mono font-bold text-xs">
                04
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{lang === "ar" ? "4. القرار المحمي" : (lang === "fr" ? "4. Décisions Protégées" : "4. Protected Decisions")}</h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" 
                  ? "تأتي القرارات المستقبليّة مدعومة بالحقائق الموثقة والأدلة التاريخية للمؤسسة، مما يضمن أعلى درجات الامتثال والكفاءة."
                  : (lang === "fr"
                    ? "Les choix stratégiques futurs sont consolidés par la vérité opérationnelle vérifiée, garantissant conformité et efficacité."
                    : "Future strategic choices are fortified by verified operational truth, ensuring total compliance and optimized margin retention.")}
              </p>
            </motion.div>
          </div>
        </AnimatedSection>

        {/* CORE CAPABILITIES GRID SECTION */}
        <AnimatedSection id="features" className="px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className={`text-2xl md:text-3xl font-extrabold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {lang === "ar" ? "قدرات النظام المؤسسي" : (lang === "fr" ? "Capacités de la Plateforme" : "Enterprise Platform Capabilities")}
            </h2>
            <p className="text-[#0075DE] dark:text-[#0075DE] text-xs font-mono tracking-widest uppercase">
              {lang === "ar" ? "بنية تحتية موثوقة لحفظ الخبرات" : "Reliable Infrastructure for Institutional Memory"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(212, 175, 55, 0.5)" }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/90 border-slate-800 shadow-xl'} border rounded-2xl p-6 transition-colors cursor-pointer group hover:border-[#0075DE]/40`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'} mb-2`}>
                {lang === "ar" ? "الذاكرة المؤسسية" : (lang === "fr" ? "Mémoire Institutionnelle" : "Institutional Memory")}
              </h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" ? "توقف عن إهدار المعرفة عند مغادرة الكوادر. يتم أرشفة كل قرار واستراتيجية بشكل منهجي." : (lang === "fr" ? "Cessez de perdre les connaissances critiques." : "Stop losing critical knowledge when personnel depart. Decisions and strategies are systematically archived.")}
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(212, 175, 55, 0.5)" }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/90 border-slate-800 shadow-xl'} border rounded-2xl p-6 transition-colors cursor-pointer group hover:border-[#0075DE]/40`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'} mb-2`}>
                {lang === "ar" ? "الرسم البياني السببي" : (lang === "fr" ? "Analyse du Graphe Causal" : "Causal Graph Analysis")}
              </h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" ? "فهم الأسباب الجذرية وربط القرارات بالنتائج التشغيلية والمالية مباشرة." : (lang === "fr" ? "Ne vous contentez pas de consigner. Comprenez pourquoi." : "Map root causes directly to systemic operational outcomes.")}
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(212, 175, 55, 0.5)" }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/90 border-slate-800 shadow-xl'} border rounded-2xl p-6 transition-colors cursor-pointer group hover:border-[#0075DE]/40`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'} mb-2`}>
                {lang === "ar" ? "تنبيهات المخاطر التوقعية" : (lang === "fr" ? "Alertes de Risques Prédictives" : "Predictive Risk Alerts")}
              </h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" ? "تنبيه الفرق فورياً عند تشابه ظروف التشغيل الحالية مع أنماط تاريخية سابقة." : (lang === "fr" ? "Lorsque des conditions similaires se présentent, ZAKIR alerte vos équipes." : "Alert risk teams when operating conditions match historical patterns.")}
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(212, 175, 55, 0.5)" }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/90 border-slate-800 shadow-xl'} border rounded-2xl p-6 transition-colors cursor-pointer group hover:border-[#0075DE]/40`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'} mb-2`}>
                {lang === "ar" ? "مستشار الذكاء الاصطناعي" : (lang === "fr" ? "Évolution IA Intelligente" : "Cognitive AI Advisor")}
              </h3>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                {lang === "ar" ? "توليد ملخصات تنفيذية وإجابات استراتيجية استناداً إلى سجلات الذاكرة المؤسسية." : (lang === "fr" ? "Générez automatiquement des synthèses exécutives." : "Synthesize executive briefs and forecasts directly from institutional memory.")}
              </p>
            </motion.div>
          </div>
        </AnimatedSection>

        {/* AI ANALYSIS & COGNITIVE INTELLIGENCE SECTION */}
        <AnimatedSection id="ai-analysis" className="px-6 max-w-7xl mx-auto">
          <div className={`p-8 sm:p-10 rounded-3xl ${theme === 'light' ? 'bg-white border-2 border-[#0075DE] shadow-xl' : 'bg-slate-900/80 border-2 border-[#0075DE]/40 shadow-2xl'} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#0075DE]/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0075DE]/10 text-[#0075DE] dark:text-[#0075DE] border border-[#0075DE]/20 text-xs font-mono font-bold">
                  <Brain className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "التحليل الاستراتيجي بالذكاء الاصطناعي" : "Cognitive Reasoning Engine"}</span>
                </div>
                <h2 className={`text-2xl sm:text-3xl font-extrabold ${theme === 'light' ? 'text-slate-900' : 'text-white'} leading-tight`}>
                  {lang === "ar" ? "اسأل خزينة المؤسسة واحصل على إجابات مدعومة بالسوابق." : "Query your institutional memory with deep causal context."}
                </h2>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                  {lang === "ar"
                    ? "يقوم المحرك الذكي بتحليل آلاف السجلات والمذكرات لتوليد تشخيص دقيق للقرارات السابقة والتنبؤ بالنتائج المستقبليّة."
                    : "The cognitive AI advisor parses thousands of historical records to generate precedent-backed decision diagnostics in real-time."}
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onNavigateAuth("login")}
                    className="px-5 py-2.5 rounded-xl bg-[#0075DE] hover:bg-[#005BAB] text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>{lang === "ar" ? "تجربة المستشار الذكي" : "Launch AI Advisor"}</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>

              {/* Simulated AI Terminal Box */}
              <div className={`p-5 rounded-2xl ${theme === 'light' ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950/20 border border-[#0075DE]'} backdrop-blur-md font-mono text-xs space-y-3 shadow-inner`}>
                <div className={`flex items-center justify-between pb-2 border-b ${theme === 'light' ? 'border-slate-200 text-slate-600' : 'border-[#0075DE]/30 text-slate-400'} text-[11px]`}>
                  <span className="flex items-center gap-1.5 text-[#0075DE] dark:text-[#0075DE] font-bold">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
                    ZAKIR Cognitive Query
                  </span>
                  <span className="text-emerald-500 dark:text-emerald-400 font-bold">STRICT CAUSAL VERIFIED</span>
                </div>
                <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-white border border-slate-200 text-slate-800' : 'bg-transparent border border-[#0075DE]/30 text-slate-300'}`}>
                  <span className="text-[#0075DE] dark:text-[#0075DE]/70">Query: </span>
                  {lang === "ar" ? "ما هي نتائج تغطية تحوط العملات لعام 2024؟" : "What were the outcomes of FX hedging decisions in Q3 2024?"}
                </div>
                <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-amber-50/50 border border-amber-200 text-slate-800' : 'bg-[#0075DE]/5 border border-[#0075DE]/20 text-slate-300'} space-y-1`}>
                  <div className="text-[#0075DE] dark:text-[#0075DE] font-bold text-[11px]">{lang === "ar" ? "تشخيص الأثر:" : "Causal Diagnostic:"}</div>
                  <p className={`text-[11px] ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'} leading-normal`}>
                    {lang === "ar"
                      ? "تم تفعيل العقود المستقبلية لتغطية 40% من التعرض. يوصى بزيادة النسبة إلى 70% وفقاً للسابقة رقم #842."
                      : "Forward contracts covered 40% exposure against a 12% EUR/USD adverse shift. Precedent #842 mandates 70% coverage threshold."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* PRICING SECTION */}
        <AnimatedSection id="pricing" className="px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <span className="px-3 py-1 rounded-full bg-[#0075DE]/10 border border-[#0075DE]/20 text-[#0075DE] dark:text-[#0075DE] text-xs font-bold uppercase tracking-wider">
              {lang === "ar" ? "خطط الأسعار" : (lang === "fr" ? "Plans Tarifaires" : "Pricing Plans")}
            </span>
            <h2 className={`text-2xl md:text-3xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {lang === "ar" ? "خطط شفافة ومناسبة لمؤسستك" : (lang === "fr" ? "Tarifs Transparents pour votre Entreprise" : "Transparent Enterprise Plans")}
            </h2>
          </div>

          {/* Monthly / Annual Toggle Switch */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className={`flex items-center ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'} p-1 rounded-xl border text-xs font-bold`}>
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "rgba(245, 158, 11, 0.05)" }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  billingCycle === "annual"
                    ? "bg-[#0075DE] text-white font-black shadow-sm"
                    : (theme === 'light' ? "text-slate-700 hover:text-black" : "text-slate-400 hover:text-white")
                }`}
              >
                {lang === "ar" ? "الفوترة السنوية" : (lang === "fr" ? "Facturation Annuelle" : "Annual Billing")}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "rgba(245, 158, 11, 0.05)" }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-[#0075DE] text-white font-black shadow-sm"
                    : (theme === 'light' ? "text-slate-700 hover:text-black" : "text-slate-400 hover:text-white")
                }`}
              >
                {lang === "ar" ? "الفوترة الشهرية" : (lang === "fr" ? "Facturation Mensuelle" : "Monthly Billing")}
              </motion.button>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#0075DE]/15 text-[#0075DE] dark:text-[#0075DE] font-extrabold text-[11px]">
              {lang === "ar" ? "توفير 20%" : (lang === "fr" ? "Économisez 20%/an" : "Save 20% Annual")}
            </span>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -6 }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-900 border-slate-800 shadow-xl'} border rounded-2xl p-7 flex flex-col justify-between cursor-pointer hover:border-slate-700 transition-colors`}
            >
              <div>
                <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Starter</h3>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} mt-1`}>
                  {lang === "ar" ? "خطة استكشافية للفرق ($50 سنوياً أو $6 شهرياً)" : (lang === "fr" ? "Pour petites équipes ($50/an ou $6/mois)" : "For small teams & initial setup ($50/yr or $6/mo)")}
                </p>
                <div className="my-5">
                  <div className={`text-3xl font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    ${billingCycle === "annual" ? "50" : "6"}
                    <span className={`text-xs font-normal ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} ml-1`}>
                      / {billingCycle === "annual" ? (lang === "ar" ? "سنوياً" : (lang === "fr" ? "an" : "yr")) : (lang === "ar" ? "شهرياً" : (lang === "fr" ? "mois" : "mo"))}
                    </span>
                  </div>
                </div>
                <ul className={`space-y-2.5 text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'} border-t ${theme === 'light' ? 'border-slate-100' : 'border-slate-800'} pt-4`}>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "وصول متعدد المستخدمين" : (lang === "fr" ? "Accès multi-utilisateurs & RBAC" : "Multi-user seat access & RBAC")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "إدارة الملفات والإعدادات" : (lang === "fr" ? "Gestion complète des fichiers" : "Full File & Settings Management")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "بحث الذاكرة السببية" : (lang === "fr" ? "Recherche dans la Mémoire Causale" : "Causal AI Memory Search")}</li>
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onStripeCheckout("Starter")}
                className={`w-full mt-6 py-3 bg-[#0075DE]/10 hover:bg-[#0075DE] text-[#0075DE] hover:text-white border border-[#0075DE]/35 font-bold text-xs rounded-xl transition-all cursor-pointer text-center`}
              >
                {lang === "ar" ? "الاشتراك بخطة Starter" : (lang === "fr" ? "S'abonner à Starter" : "Subscribe Starter")}
              </motion.button>
            </motion.div>

            {/* Professional */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -6 }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-2 border-[#0075DE] shadow-xl' : 'bg-slate-900 border-2 border-[#0075DE] shadow-2xl shadow-[#0075DE]/10'} rounded-2xl p-7 flex flex-col justify-between relative cursor-pointer`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0075DE] text-white font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider">
                {lang === "ar" ? "الخطة الأكثر شعبية" : (lang === "fr" ? "Le Plus Populaire" : "Most Popular")}
              </div>
              <div>
                <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'} flex items-center gap-1.5`}>
                  Professional <Zap className="w-4 h-4 text-[#0075DE] dark:text-[#0075DE] fill-[#0075DE]" />
                </h3>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} mt-1`}>
                  {lang === "ar" ? "للمؤسسات والشركات النامية" : (lang === "fr" ? "Pour entreprises en croissance" : "For growing corporate institutions")}
                </p>
                <div className="my-5">
                  <div className="text-3xl font-black text-[#0075DE] dark:text-[#0075DE]">
                    ${billingCycle === "annual" ? "149" : "189"}
                    <span className={`text-xs font-normal ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} ml-1`}>/ {lang === "ar" ? "شهرياً" : (lang === "fr" ? "mois" : "mo")}</span>
                  </div>
                </div>
                <ul className={`space-y-2.5 text-xs ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'} border-t ${theme === 'light' ? 'border-slate-100' : 'border-slate-800'} pt-4`}>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0075DE] dark:text-[#0075DE] shrink-0" /> {lang === "ar" ? "ذكريات وخزينة غير محدودة" : (lang === "fr" ? "Souvenirs & Coffre Illimités" : "Unlimited Memories & Vault")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0075DE] dark:text-[#0075DE] shrink-0" /> {lang === "ar" ? "تحليل الرسم البياني السببي" : (lang === "fr" ? "Analyse du Graphe Causal" : "Full Causal Graph Analysis")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0075DE] dark:text-[#0075DE] shrink-0" /> {lang === "ar" ? "تنبيهات المخاطر التلقائية" : (lang === "fr" ? "Alertes du Radar de Risque" : "Automated Risk Radar Alerts")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0075DE] dark:text-[#0075DE] shrink-0" /> {lang === "ar" ? "صلاحيات وأدوار الموظفين" : (lang === "fr" ? "Accès multi-utilisateurs & RBAC" : "Multi-user seat access & RBAC")}</li>
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onStripeCheckout("Professional")}
                className="w-full mt-6 py-3 bg-[#0075DE] hover:bg-[#005BAB] text-white font-black text-xs rounded-xl transition-all cursor-pointer text-center"
              >
                {lang === "ar" ? "الاشتراك بالخطة الاحترافية" : (lang === "fr" ? "S'abonner à Professional" : "Subscribe Professional")}
              </motion.button>
            </motion.div>

            {/* Enterprise */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              whileHover={{ scale: 1.03, y: -6 }}
              whileTap={{ scale: 0.97 }}
              className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-900 border-slate-800 shadow-xl'} border rounded-2xl p-7 flex flex-col justify-between cursor-pointer hover:border-slate-700 transition-colors`}
            >
              <div>
                <h3 className={`text-lg font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Enterprise</h3>
                <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} mt-1`}>
                  {lang === "ar" ? "للمؤسسات الكبرى والهيئات السيادية" : (lang === "fr" ? "Pour grands groupes & entités souveraines" : "For large conglomerates & sovereign entities")}
                </p>
                <div className="my-5">
                  <div className={`text-3xl font-black ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    ${billingCycle === "annual" ? "699" : "849"}
                    <span className={`text-xs font-normal ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} ml-1`}>/ {lang === "ar" ? "شهرياً" : (lang === "fr" ? "mois" : "mo")}</span>
                  </div>
                </div>
                <ul className={`space-y-2.5 text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'} border-t ${theme === 'light' ? 'border-slate-100' : 'border-slate-800'} pt-4`}>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "إنستانس سحابي مخصص" : (lang === "fr" ? "Instance Cloud Dédiée" : "Dedicated Cloud Instance")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "ضمان الخدمة 99.99%" : (lang === "fr" ? "SLA Garanti 99,99%" : "99.99% SLA Guaranteed Uptime")}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" /> {lang === "ar" ? "مدير حساب مخصص وتدريب" : (lang === "fr" ? "Gestionnaire de compte dédié" : "Dedicated Account Manager")}</li>
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onStripeCheckout("Enterprise")}
                className={`w-full mt-6 py-3 bg-[#0075DE]/10 hover:bg-[#0075DE] text-[#0075DE] hover:text-white border border-[#0075DE]/35 font-bold text-xs rounded-xl transition-all cursor-pointer text-center`}
              >
                {lang === "ar" ? "الاشتراك بخطة Enterprise" : (lang === "fr" ? "S'abonner à Enterprise" : "Subscribe Enterprise")}
              </motion.button>
            </motion.div>
          </div>
        </AnimatedSection>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) ACCORDION */}
        <AnimatedSection className="px-6 max-w-4xl mx-auto">
          <div className="text-center mb-10 space-y-2">
            <span className={`px-3 py-1 rounded-full ${theme === 'light' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400'} border text-xs font-mono font-bold uppercase tracking-widest`}>
              FAQ
            </span>
            <h2 className={`text-2xl md:text-3xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {lang === "ar" ? "الأسئلة الشائعة حول ZAKIR" : "Frequently Asked Questions"}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <FAQAccordionItem
                key={idx}
                question={faq.q}
                answer={faq.a}
                isOpen={openFAQIndex === idx}
                onToggle={() => setOpenFAQIndex(openFAQIndex === idx ? null : idx)}
                theme={theme}
              />
            ))}
          </div>
        </AnimatedSection>
      </main>

      {/* FOOTER */}
      <footer className={`border-t ${theme === 'light' ? 'border-slate-200 bg-white text-slate-600 shadow-inner' : 'border-slate-800/80 bg-slate-950 text-slate-400'} px-6 py-10 relative z-10 text-xs transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <ZakirLogo theme={theme} lang={lang} />
            <span className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'}>|</span>
            <span className="text-[11px] font-mono">
              © {new Date().getFullYear()} ZAKIR Causal Memory Core. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 text-[11px] font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
              SYSTEM OPERATIONAL
            </span>
            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: "rgba(245, 158, 11, 0.05)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigateAuth("login")}
              className={`${theme === 'light' ? 'text-slate-700 hover:text-[#0075DE]' : 'text-slate-300 hover:text-[#0075DE]'} transition-colors font-bold cursor-pointer`}
            >
              {lang === "ar" ? "تسجيل الدخول" : "Login"}
            </motion.button>
          </div>
        </div>
      </footer>
    </div>
  );
};
