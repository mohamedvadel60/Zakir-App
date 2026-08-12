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
    <div className="flex items-center p-1 bg-secondary border border-border rounded-xl mb-6 shadow-xs">
      {modes.map((m) => {
        const isActive = currentMode === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            aria-pressed={isActive}
            className={cn(
              "flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-[background-color,color,box-shadow] duration-150 cursor-pointer text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              isActive
                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
