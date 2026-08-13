import * as React from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { cn } from "../../lib/utils"

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
  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-slate-200 flex flex-col justify-between p-6 sm:p-8 lg:p-12 relative overflow-hidden selection:bg-[#0075DE]/20",
        className
      )}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* GLOWING AMBIENT FIELD */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0075DE]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Controls: Back Button Restored */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-4 relative z-10">
        {onBackToHome ? (
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
        ) : <div />}
      </div>

      {/* Real Form Children Centered */}
      <div className="max-w-md mx-auto w-full my-auto py-8 relative z-10">
        {children}
      </div>

      {/* Legal Footer */}
      <div className="w-full text-center text-[10px] text-slate-600 font-mono mt-6 relative z-10">
        {lang === "ar"
          ? "باستخدام هذا النظام، فإنك توافق على سيصة الاستخدام والامتثال التنظيمي للمؤسسة."
          : "Authorized operational access only. All system actions are securely audited in the corporate ledger."}
      </div>
    </div>
  )
}

export default SplitLoginCard
