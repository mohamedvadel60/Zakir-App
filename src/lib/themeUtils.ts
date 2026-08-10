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
  
  // 4. Centrally set CSS variables for consistent component inheritance
  if (mode === "light") {
    root.style.setProperty("--bg-primary", "#F0F2F5");
    root.style.setProperty("--bg-secondary", "#FFFFFF");
    root.style.setProperty("--bg-tertiary", "#F8FAFC");
    root.style.setProperty("--text-primary", "#0F172A");
    root.style.setProperty("--text-secondary", "#475569");
    root.style.setProperty("--border-color", "#CBD5E1"); // High-contrast slate-300 for light mode
    root.style.setProperty("--accent-color", "#D4AF37");
    root.style.setProperty("--accent-hover", "#BCA032");
    root.style.setProperty("--accent-subtle", "rgba(212, 175, 55, 0.12)");
    root.style.setProperty("--accent-text", "#0F172A");
    root.style.setProperty("--card-bg", "#FFFFFF");
    root.style.setProperty("--input-bg", "#F8FAFC");
  } else {
    root.style.setProperty("--bg-primary", "#0B0F19");
    root.style.setProperty("--bg-secondary", "#111827");
    root.style.setProperty("--bg-tertiary", "#1F2937");
    root.style.setProperty("--text-primary", "#F8FAFC");
    root.style.setProperty("--text-secondary", "#94A3B8");
    root.style.setProperty("--border-color", "#334155"); // High-contrast slate-700 for dark mode
    root.style.setProperty("--accent-color", "#D4AF37");
    root.style.setProperty("--accent-hover", "#E5C158");
    root.style.setProperty("--accent-subtle", "rgba(212, 175, 55, 0.18)");
    root.style.setProperty("--accent-text", "#0B0F19");
    root.style.setProperty("--card-bg", "#111827");
    root.style.setProperty("--input-bg", "#1F2937");
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

