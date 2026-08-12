import * as React from "react"
import { ZakirLogo } from "../ZakirLogo"
import { Activity, Database, Brain, ArrowLeft, ArrowRight } from "lucide-react"
import { cn } from "../../lib/utils"

export interface SplitLoginCardProps {
  children: React.ReactNode
  lang?: "ar" | "fr" | "en"
  onBackToHome?: () => void
  onToggleLanguage?: (lang: "ar" | "fr" | "en") => void
  className?: string
}

export function SplitLoginCard({
  children,
  lang = "en",
  onBackToHome,
  onToggleLanguage,
  className,
}: SplitLoginCardProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[#070b13] text-slate-200 flex flex-col md:grid md:grid-cols-12 relative overflow-hidden selection:bg-violet-500/20",
        className
      )}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* GLOWING AMBIENT FIELD */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#7C3AED]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT COLUMN: ZAKIR BRAND MONOLITH & CAUSAL LEDGER VISUAL */}
      <div className="hidden md:flex md:col-span-5 lg:col-span-4 bg-[#0a0f1d] border-r border-slate-800/60 p-8 lg:p-10 flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Header: Brand Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <ZakirLogo theme="dark" />
        </div>

        {/* Causal Path Interactive Console Representation */}
        <div className="relative z-10 my-6 space-y-5">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-400">
                <Activity className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>
                  {lang === "ar"
                    ? "المسار السببي للقرارات المؤسسية"
                    : lang === "fr"
                    ? "Chaîne Causale Institutionnelle"
                    : "Institutional Causal Pathway"}
                </span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                ACTIVE LEDGER
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === "ar"
                ? "منظومة معالجة وتحليل القرارات المؤسسية وربط المسببات بالنتائج والأثر المستقبلي."
                : lang === "fr"
                ? "Système d'analyse décisionnelle reliant déclencheurs, impacts et mémoire d'entreprise."
                : "A unified system for causal memory, institutional knowledge, decision intelligence, risk awareness, and auditability."}
            </p>

            {/* 5-Node Visual Causal Pathway Diagram */}
            <div className="relative mt-4 pt-2 pb-3 px-3 border border-slate-800/70 rounded-xl bg-slate-950/80">
              <div className="flex items-center justify-between relative z-10 gap-1">
                {/* Node 1: TRIGGER */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 font-mono shadow-sm">
                    TRG
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">
                    {lang === "ar" ? "المُحرّك" : "Trigger"}
                  </span>
                </div>

                {/* Arrow 1 */}
                <div className="flex-1 h-[1px] bg-gradient-to-r from-slate-700 to-violet-500/50 relative top-[-6px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 absolute top-[-2px] left-1/2 -translate-x-1/2 animate-ping" />
                </div>

                {/* Node 2: CAUSE */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/40 flex items-center justify-center text-[10px] font-bold text-violet-400 font-mono shadow-sm">
                    CSE
                  </div>
                  <span className="text-[8px] font-mono text-violet-400 mt-1 uppercase tracking-tighter">
                    {lang === "ar" ? "السبب" : "Cause"}
                  </span>
                </div>

                {/* Arrow 2 */}
                <div className="flex-1 h-[1px] bg-gradient-to-r from-violet-500/50 to-blue-500/50 relative top-[-6px]" />

                {/* Node 3: DECISION */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/40 flex items-center justify-center text-[10px] font-bold text-blue-400 font-mono shadow-sm">
                    DEC
                  </div>
                  <span className="text-[8px] font-mono text-blue-400 mt-1 uppercase tracking-tighter">
                    {lang === "ar" ? "القرار" : "Decision"}
                  </span>
                </div>

                {/* Arrow 3 */}
                <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/50 to-amber-500/50 relative top-[-6px]" />

                {/* Node 4: IMPACT */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-300 font-mono shadow-sm">
                    IMP
                  </div>
                  <span className="text-[8px] font-mono text-amber-300 mt-1 uppercase tracking-tighter">
                    {lang === "ar" ? "الأثر" : "Impact"}
                  </span>
                </div>

                {/* Arrow 4 */}
                <div className="flex-1 h-[1px] bg-gradient-to-r from-amber-500/50 to-emerald-500/50 relative top-[-6px]" />

                {/* Node 5: MEMORY */}
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center text-[10px] font-bold text-emerald-400 font-mono shadow-sm">
                    MEM
                  </div>
                  <span className="text-[8px] font-mono text-emerald-400 mt-1 uppercase tracking-tighter">
                    {lang === "ar" ? "الذاكرة" : "Memory"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-400 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  {lang === "ar"
                    ? "سجل غير قابل للتعديل"
                    : lang === "fr"
                    ? "Registre Institutionnel"
                    : "Immutable Audit Trail"}
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                  {lang === "ar"
                    ? "توثيق آمن لجميع الأحداث والقرارات برمز تعقب معتمد."
                    : lang === "fr"
                    ? "Traçabilité sécurisée des opérations et contrôles d'accès."
                    : "Cryptographically verified ledger ensuring enterprise compliance."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-400 shrink-0">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  {lang === "ar"
                    ? "ذكاء استشاري موجه"
                    : lang === "fr"
                    ? "Intelligence Décisionnelle"
                    : "Decision Intelligence"}
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                  {lang === "ar"
                    ? "تحليل وتقييم المخاطر التشغيلية والمالية بناءً على السجل المؤسسي."
                    : lang === "fr"
                    ? "Analyse automatisée des risques et dépendances stratégiques."
                    : "Grounded reasoning engine for institutional risk mitigation."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Credentials */}
        <div className="relative z-10 text-[10px] text-slate-600 font-mono">
          <span>ZAKIR SYSTEMS v3.0</span>
          <span className="block mt-0.5">
            © {new Date().getFullYear()} Zakir Systems Corp.
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: REAL AUTHENTICATION FORM WORKSPACE */}
      <div className="flex-1 md:col-span-7 lg:col-span-8 flex flex-col justify-between p-6 sm:p-8 lg:p-10 relative overflow-y-auto">
        {/* Top Header Controls: Back & Language Switcher */}
        <div className="w-full flex items-center justify-between gap-4 mb-6">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              type="button"
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-violet-400 transition-colors cursor-pointer"
            >
              {lang === "ar" ? (
                <ArrowRight className="w-4 h-4" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
              <span>
                {lang === "ar"
                  ? "العودة للرئيسية"
                  : lang === "fr"
                  ? "Retour à l'accueil"
                  : "Back to Home"}
              </span>
            </button>
          )}

          {onToggleLanguage && (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 ms-auto">
              <button
                type="button"
                onClick={() => onToggleLanguage("ar")}
                className={`text-[10px] font-black px-2.5 py-1 rounded transition-all cursor-pointer ${
                  lang === "ar"
                    ? "bg-violet-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ع
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage("fr")}
                className={`text-[10px] font-black px-2.5 py-1 rounded transition-all cursor-pointer ${
                  lang === "fr"
                    ? "bg-violet-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage("en")}
                className={`text-[10px] font-black px-2.5 py-1 rounded transition-all cursor-pointer ${
                  lang === "en"
                    ? "bg-violet-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>
          )}
        </div>

        {/* Real Form Children */}
        <div className="max-w-md mx-auto w-full my-auto py-4">{children}</div>

        {/* Legal Footer */}
        <div className="w-full text-center text-[10px] text-slate-600 font-mono mt-6">
          {lang === "ar"
            ? "باستخدام هذا النظام، فإنك توافق على سياسة الاستخدام والامتثال التنظيمي للمؤسسة."
            : "Authorized operational access only. All system actions are securely audited in the corporate ledger."}
        </div>
      </div>
    </div>
  )
}

export default SplitLoginCard
