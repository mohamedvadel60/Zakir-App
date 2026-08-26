import * as React from "react"
import { ArrowLeft, ArrowRight, ShieldCheck, Lock } from "lucide-react"
import { cn } from "../../lib/utils"
import { ZakirLogo } from "../ZakirLogo"

export interface SplitLoginCardProps {
  children: React.ReactNode
  lang?: "ar" | "fr" | "en"
  theme?: "light" | "dark"
  onBackToHome?: () => void
  className?: string
}

export function SplitLoginCard({
  children,
  lang = "en",
  theme = "dark",
  onBackToHome,
  className,
}: SplitLoginCardProps) {
  const isRtl = lang === "ar"

  return (
    <div
      className={cn(
        "min-h-screen w-full bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-[#0075DE]/20 font-sans relative overflow-hidden",
        className
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Ambient background glow and grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#0075DE]/15 via-[#0075DE]/5 to-transparent blur-3xl opacity-70 dark:opacity-40" />
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: `24px 24px`
          }}
        />
      </div>

      {/* Top Bar with Brand and Navigation */}
      <header className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-[#07090E]/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <ZakirLogo size={28} theme={theme} />
        </div>

        <div className="flex items-center gap-3">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 shadow-xs"
            >
              {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>
                {lang === "ar" ? "العودة للرئيسية" : lang === "fr" ? "Retour à l'accueil" : "Back to Home"}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </main>

      {/* Institutional Security Notice Footer */}
      <footer className="relative z-10 w-full py-4 px-6 border-t border-slate-200/80 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 bg-white/40 dark:bg-[#07090E]/40 backdrop-blur-xs">
        <ShieldCheck className="w-4 h-4 text-[#0075DE] shrink-0" />
        <span className="font-medium text-[11px] sm:text-xs">
          {lang === "ar"
            ? "نظام ذاكرة مؤسسية آمن ومحمي بأعلى معايير التشفير والحوكمة"
            : lang === "fr"
            ? "Système de mémoire institutionnelle sécurisé selon les normes d'entreprise"
            : "Enterprise Institutional Causal Memory & Knowledge System"}
        </span>
      </footer>
    </div>
  )
}

export default SplitLoginCard

