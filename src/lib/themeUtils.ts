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
  root.classList.remove("theme-light", "theme-dark", "custom-theme-active", "dark");
  if (mode === "dark") {
    root.classList.add("dark", "theme-dark");
  } else {
    root.classList.add("theme-light");
  }
  
  // 4. Centrally set CSS variables for consistent component inheritance
  if (mode === "light") {
    root.style.colorScheme = "light";
    root.style.setProperty("--background", "#F8FAFC");
    root.style.setProperty("--foreground", "#0F172A");
    root.style.setProperty("--card", "#FFFFFF");
    root.style.setProperty("--card-foreground", "#0F172A");
    root.style.setProperty("--popover", "#FFFFFF");
    root.style.setProperty("--popover-foreground", "#0F172A");
    root.style.setProperty("--primary", "#0075DE");
    root.style.setProperty("--primary-foreground", "#FFFFFF");
    root.style.setProperty("--secondary", "#F1F5F9");
    root.style.setProperty("--secondary-foreground", "#0F172A");
    root.style.setProperty("--muted", "#F1F5F9");
    root.style.setProperty("--muted-foreground", "#64748B");
    root.style.setProperty("--accent", "#EBF5FF");
    root.style.setProperty("--accent-foreground", "#005BAB");
    root.style.setProperty("--border", "#E2E8F0");
    root.style.setProperty("--input", "#E2E8F0");
    root.style.setProperty("--ring", "#0075DE");

    root.style.setProperty("--bg-primary", "#F8FAFC");
    root.style.setProperty("--bg-secondary", "#FFFFFF");
    root.style.setProperty("--bg-tertiary", "#F1F5F9");
    root.style.setProperty("--text-primary", "#0F172A");
    root.style.setProperty("--text-secondary", "#64748B");
    root.style.setProperty("--border-color", "#E2E8F0");
    root.style.setProperty("--accent-color", "#0075DE");
    root.style.setProperty("--accent-hover", "#005BAB");
    root.style.setProperty("--accent-subtle", "rgba(0, 117, 222, 0.08)");
    root.style.setProperty("--accent-text", "#FFFFFF");
    root.style.setProperty("--card-bg", "#FFFFFF");
    root.style.setProperty("--input-bg", "#FFFFFF");
  } else {
    root.style.colorScheme = "dark";
    root.style.setProperty("--background", "#080C14");
    root.style.setProperty("--foreground", "#F8FAFC");
    root.style.setProperty("--card", "#0F172A");
    root.style.setProperty("--card-foreground", "#F8FAFC");
    root.style.setProperty("--popover", "#0F172A");
    root.style.setProperty("--popover-foreground", "#F8FAFC");
    root.style.setProperty("--primary", "#0075DE");
    root.style.setProperty("--primary-foreground", "#FFFFFF");
    root.style.setProperty("--secondary", "#1E293B");
    root.style.setProperty("--secondary-foreground", "#F8FAFC");
    root.style.setProperty("--muted", "#1E293B");
    root.style.setProperty("--muted-foreground", "#94A3B8");
    root.style.setProperty("--accent", "#13233A");
    root.style.setProperty("--accent-foreground", "#38BDF8");
    root.style.setProperty("--border", "#1E293B");
    root.style.setProperty("--input", "#1E293B");
    root.style.setProperty("--ring", "#0075DE");

    root.style.setProperty("--bg-primary", "#080C14");
    root.style.setProperty("--bg-secondary", "#0F172A");
    root.style.setProperty("--bg-tertiary", "#1E293B");
    root.style.setProperty("--text-primary", "#F8FAFC");
    root.style.setProperty("--text-secondary", "#94A3B8");
    root.style.setProperty("--border-color", "#1E293B");
    root.style.setProperty("--accent-color", "#0075DE");
    root.style.setProperty("--accent-hover", "#1D4ED8");
    root.style.setProperty("--accent-subtle", "rgba(0, 117, 222, 0.15)");
    root.style.setProperty("--accent-text", "#FFFFFF");
    root.style.setProperty("--card-bg", "#0F172A");
    root.style.setProperty("--input-bg", "#0B1120");
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

