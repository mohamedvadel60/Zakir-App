import { updateUserPreferences, saveFirebaseUserProfile } from "./firebaseServices.js";
import type { User } from "../types.js";
import React from "react";

export type ThemeMode = "light" | "dark";

export const applyGlobalTheme = (
  mode: ThemeMode,
  setThemeState: (theme: ThemeMode) => void,
  currentUser: User | null,
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>,
  saveToBackend: boolean = true
) => {
  // 1. Update React State
  setThemeState(mode);
  
  // 2. Persist to localStorage
  localStorage.setItem("zakir_theme", mode);
  
  // 3. Update HTML root dataset & theme class
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.classList.remove("theme-light", "theme-dark", "custom-theme-active");
  root.classList.add(`theme-${mode}`);
  
  // 4. Centrally set CSS variables for consistent component inheritance.
  // Violet-first institutional palette (presentation only — no business logic).
  if (mode === "light") {
    root.style.setProperty("--bg-primary", "#f6f7fb");
    root.style.setProperty("--bg-secondary", "#ffffff");
    root.style.setProperty("--bg-tertiary", "#f1f5f9");
    root.style.setProperty("--bg-elevated", "#ffffff");
    root.style.setProperty("--text-primary", "#0f172a");
    root.style.setProperty("--text-secondary", "#475569");
    root.style.setProperty("--text-tertiary", "#94a3b8");
    root.style.setProperty("--border-color", "#e2e8f0");
    root.style.setProperty("--border-strong", "#cbd5e1");
    root.style.setProperty("--accent-color", "#6d28d9");
    root.style.setProperty("--accent-hover", "#7c3aed");
    root.style.setProperty("--accent-pressed", "#5b21b6");
    root.style.setProperty("--accent-subtle", "rgba(109, 40, 217, 0.10)");
    root.style.setProperty("--accent-text", "#ffffff");
    root.style.setProperty("--accent-tertiary", "#6d28d9");
    root.style.setProperty("--card-bg", "#ffffff");
    root.style.setProperty("--input-bg", "#f8fafc");
    root.style.setProperty("--premium-color", "#b45309");
    root.style.setProperty("--header-bg", "rgba(255, 255, 255, 0.80)");
  } else {
    root.style.setProperty("--bg-primary", "#0b0f19");
    root.style.setProperty("--bg-secondary", "#111827");
    root.style.setProperty("--bg-tertiary", "#1f2937");
    root.style.setProperty("--bg-elevated", "#161e2e");
    root.style.setProperty("--text-primary", "#f8fafc");
    root.style.setProperty("--text-secondary", "#94a3b8");
    root.style.setProperty("--text-tertiary", "#64748b");
    root.style.setProperty("--border-color", "#1e293b");
    root.style.setProperty("--border-strong", "#334155");
    root.style.setProperty("--accent-color", "#7c3aed");
    root.style.setProperty("--accent-hover", "#8b5cf6");
    root.style.setProperty("--accent-pressed", "#6d28d9");
    root.style.setProperty("--accent-subtle", "rgba(124, 58, 237, 0.12)");
    root.style.setProperty("--accent-text", "#ffffff");
    root.style.setProperty("--accent-tertiary", "#a78bfa");
    root.style.setProperty("--card-bg", "#111827");
    root.style.setProperty("--input-bg", "#1f2937");
    root.style.setProperty("--premium-color", "#d4af37");
    root.style.setProperty("--header-bg", "rgba(11, 15, 25, 0.80)");
  }

  // 5. Simultaneously save user preference to Firestore backend
  if (saveToBackend && currentUser?.id) {
    setCurrentUser((prevUser: User | null) => {
      if (!prevUser) return null;
      const updatedUser: User = {
        ...prevUser,
        userPreferences: {
          ...(prevUser.userPreferences || {
            theme: "dark",
            language: "ar",
            emailNotifications: true,
            riskRadarAlerts: true,
            autoSaveMemories: true,
            defaultView: "overview"
          }),
          theme: mode
        },
        customTheme: prevUser.customTheme ? {
          ...prevUser.customTheme,
          approvedAt: null as any
        } : undefined
      };
      
      saveFirebaseUserProfile(updatedUser).catch(err => 
        console.warn("Failed to persist theme preference to Firestore:", err)
      );

      return updatedUser;
    });
  }
};

