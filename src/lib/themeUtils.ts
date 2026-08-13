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
    root.style.setProperty("--bg-primary", "#FFFFFF");
    root.style.setProperty("--bg-secondary", "#F4F4F5");
    root.style.setProperty("--bg-tertiary", "#E4E4E7");
    root.style.setProperty("--text-primary", "#0D0D0D");
    root.style.setProperty("--text-secondary", "#71717A");
    root.style.setProperty("--border-color", "#E4E4E7");
    root.style.setProperty("--accent-color", "#0075DE");
    root.style.setProperty("--accent-hover", "#005BAB");
    root.style.setProperty("--accent-subtle", "#E6F3FE");
    root.style.setProperty("--accent-text", "#FFFFFF");
    root.style.setProperty("--card-bg", "#FFFFFF");
    root.style.setProperty("--input-bg", "#FFFFFF");
  } else {
    root.style.setProperty("--bg-primary", "#0A0A0A");
    root.style.setProperty("--bg-secondary", "#171717");
    root.style.setProperty("--bg-tertiary", "#27272A");
    root.style.setProperty("--text-primary", "#FAFAFA");
    root.style.setProperty("--text-secondary", "#A1A1AA");
    root.style.setProperty("--border-color", "#27272A");
    root.style.setProperty("--accent-color", "#0075DE");
    root.style.setProperty("--accent-hover", "#1D4ED8");
    root.style.setProperty("--accent-subtle", "rgba(0, 117, 222, 0.15)");
    root.style.setProperty("--accent-text", "#FFFFFF");
    root.style.setProperty("--card-bg", "#171717");
    root.style.setProperty("--input-bg", "#171717");
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

