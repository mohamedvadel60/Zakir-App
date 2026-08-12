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
        "min-h-screen bg-[#070b13] text-slate-200 flex flex-col md:grid md:grid-cols-12 relative overflow-hidden selection:bg-amber-500/20",
        className
      )}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* GLOWING AMBIENT FIELD */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT COLUMN: ZAKIR BRAND MONOLITH & CAUSAL LEDGER VISUAL */}
      <div className="hidden md:flex md:col-span-5 lg:col-span-4 bg-[#0a0f1d] border-r border-slate-800/60 p-8 lg:p-10 flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Header: Brand Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <ZakirLogo theme="dark" />
        </div>

        {/* Causal Path Interactive Console Representation */}
        <div className="relative z-10 my-8 space-y-6">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              <Activity className="w-4 h-4 animate-pulse shrink-0" />
              <span>
                {lang === "ar"
                  ? "سجل الحوكمة والترابط السببي"
                  : lang === "fr"
                  ? "Registre de Gouvernance Causale"
                  : "Causal Governance Ledger"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lang === "ar"
                ? "منظومة معالجة وتحليل القرارات المؤسسية وربط الأنشطة والامتثال التنظيمي."
                : lang === "fr"
                ? "Infrastructure de traitement des décisions institutionnelles et d'audit causale."
                : "Real-time stateful analysis linking operational events, decision trails, and risk vectors."}
            </p>

            {/* SVG Connector Animation */}
            <div className="h-28 relative mt-3 border border-slate-800/60 rounded-lg bg-slate-950/70 overflow-hidden p-2">
              <svg
                className="w-full h-full absolute inset-0 text-slate-800"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 30,50 L 120,30 L 210,50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M 30,50 L 120,74 L 210,50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <circle r="3" fill="#D4AF37">
                  <animateMotion
                    dur="4s"
                    repeatCount="indefinite"
                    path="M 30,50 L 120,30 L 210,50"
                  />
                </circle>
                <circle r="3" fill="#3b82f6">
                  <animateMotion
                    dur="5s"
                    repeatCount="indefinite"
                    path="M 30,50 L 120,74 L 210,50"
                  />
                </circle>
              </svg>

              <div className="absolute top-[38px] left-[10px] flex flex-col items-center">
                <div className="w-6 h-6 rounded bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                  IN
                </div>
                <span className="text-[8px] text-slate-500 mt-1 uppercase tracking-wider">
                  Event
                </span>
              </div>

              <div className="absolute top-[18px] left-[105px] flex flex-col items-center">
                <div className="w-6 h-6 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[10px] font-bold text-[#D4AF37] animate-pulse">
                  CA
                </div>
                <span className="text-[8px] text-[#D4AF37] mt-1 uppercase tracking-wider">
                  Causal
                </span>
              </div>

              <div className="absolute bottom-[10px] left-[105px] flex flex-col items-center">
                <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                  RG
                </div>
                <span className="text-[8px] text-blue-400 mt-1 uppercase tracking-wider">
                  Audit
                </span>
              </div>

              <div className="absolute top-[38px] right-[10px] flex flex-col items-center">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                  OK
                </div>
                <span className="text-[8px] text-emerald-400 mt-1 uppercase tracking-wider">
                  Secure
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[#D4AF37] shrink-0">
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
                    ? "بيانات محمية برمجياً وفق معايير التشفير والامتثال المؤسسي."
                    : lang === "fr"
                    ? "Traçabilité sécurisée des opérations et contrôles d'accès."
                    : "Cryptographically verified ledger ensuring enterprise compliance."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[#D4AF37] shrink-0">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  {lang === "ar"
                    ? "ذكاء استشاري موجه"
                    : lang === "fr"
                    ? "Intelligence Décisionnelle"
                    : "Cognitive Intelligence"}
                </h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                  {lang === "ar"
                    ? "استخلاص الأنماط وتقييم المخاطر التشغيلية والمالية تلقائياً."
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
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
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
                    ? "bg-[#D4AF37] text-slate-950 font-bold"
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
                    ? "bg-[#D4AF37] text-slate-950 font-bold"
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
                    ? "bg-[#D4AF37] text-slate-950 font-bold"
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
