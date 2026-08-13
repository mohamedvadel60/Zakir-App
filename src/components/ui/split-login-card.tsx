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
        "min-h-screen bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-slate-200 flex flex-col md:grid md:grid-cols-12 relative overflow-hidden selection:bg-[#0075DE]/20",
        className
      )}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* GLOWING AMBIENT FIELD */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0075DE]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* LEFT COLUMN: ZAKIR BRAND MONOLITH & CAUSAL LEDGER VISUAL */}
      <div className="hidden md:flex md:col-span-5 lg:col-span-4 bg-slate-100 dark:bg-[#0a0f1d] border-r border-slate-200 dark:border-slate-800/60 p-8 lg:p-10 flex-col justify-between relative overflow-hidden shrink-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Header: Brand Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <ZakirLogo theme="dark" />
        </div>

        {/* Causal Path Interactive Console Representation */}
        <div className="relative z-10 my-8 space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-center text-[#0075DE] shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
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
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-center text-[#0075DE] shrink-0">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
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
              className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#0075DE] dark:hover:text-[#0075DE] transition-colors cursor-pointer"
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
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800/80 ms-auto shadow-inner">
              <button
                type="button"
                onClick={() => onToggleLanguage("ar")}
                className={`min-w-[32px] h-7 text-[11px] font-bold px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  lang === "ar"
                    ? "bg-[#0075DE] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                ع
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage("fr")}
                className={`min-w-[32px] h-7 text-[11px] font-bold px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  lang === "fr"
                    ? "bg-[#0075DE] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage("en")}
                className={`min-w-[32px] h-7 text-[11px] font-bold px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  lang === "en"
                    ? "bg-[#0075DE] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
