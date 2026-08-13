import * as React from "react"
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
    },
    {
      id: "register" as const,
      label: lang === "ar" ? "إنشاء حساب" : lang === "fr" ? "Inscription" : "Register",
    },
  ]

  return (
    <div className="flex items-center gap-1 p-1.5 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl mb-6 shadow-sm overflow-hidden">
      {modes.map((m) => {
        const isActive = currentMode === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "flex-1 py-2 px-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center whitespace-nowrap overflow-hidden text-ellipsis min-w-0",
              isActive
                ? "bg-[#0075DE] text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/50"
            )}
            title={m.label}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
