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
    {
      id: "forgot" as const,
      label: lang === "ar" ? "إعادة تعيين" : lang === "fr" ? "Récupération" : "Recovery",
    },
  ]

  return (
    <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-6 shadow-sm">
      {modes.map((m) => {
        const isActive = currentMode === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center",
              isActive
                ? "bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25"
                : "text-slate-400 hover:text-white hover:bg-violet-500/10"
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
