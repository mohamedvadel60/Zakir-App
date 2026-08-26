import * as React from "react"
import { motion } from "motion/react"
import { LogIn, UserPlus } from "lucide-react"
import { cn } from "../../lib/utils"

export interface AuthSwitchProps {
  currentMode: "login" | "register" | "forgot"
  onModeChange: (mode: "login" | "register" | "forgot") => void
  lang?: "ar" | "fr" | "en"
}

export function AuthSwitch({ currentMode, onModeChange, lang = "en" }: AuthSwitchProps) {
  const modes = [
    {
      id: "login" as const,
      label: lang === "ar" ? "تسجيل الدخول" : lang === "fr" ? "Connexion" : "Sign In",
      icon: LogIn,
    },
    {
      id: "register" as const,
      label: lang === "ar" ? "إنشاء حساب" : lang === "fr" ? "Créer un compte" : "Sign Up",
      icon: UserPlus,
    },
  ]

  return (
    <div className="relative flex items-center p-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-xl mb-6 shadow-inner">
      {modes.map((m) => {
        const isActive = currentMode === m.id
        const IconComponent = m.icon

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "relative z-10 flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5",
              isActive
                ? "text-white font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="auth-tab-pill"
                className="absolute inset-0 bg-[#0075DE] rounded-lg shadow-sm shadow-[#0075DE]/25"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-1.5">
              <IconComponent className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

