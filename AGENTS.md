# Zakir-App — Repository Memory

## Product
Zakir — Institutional Decision Intelligence ("The Organizational Causal Memory").
Vite + React 19 + Tailwind v4 (`@import "tailwindcss"` + `@theme inline`), motion (framer-motion), recharts, lucide-react, firebase. Electron + Express server also present.

## Architecture
- **No router.** Single-page app; view switching via `activeTab` state in `src/App.tsx` (~7000 lines).
- **Auth gate** (App.tsx ~L2618-3845): isAuthChecking splash → `!currentUser` (authMode: landing/register/login) → EmailVerificationView → AdminDashboard (admin user) → main workspace (sidebar + header + tab views).
- Tabs: dashboard, library, add, files, smart, market, agent, alerts, gmail, settings, support.
- Large feature components: `SettingsAdmin.tsx` (3510), `PrintPreviewModal.tsx` (2489), `ProductShowcaseWindow.tsx` (1926), `GmailVault.tsx` (1428), `WorldBankPortal.tsx` (1437), `AdminDashboard.tsx` (1612), `CustomerSupport.tsx` (1062), `FileManager.tsx` (961), `AnimatedLandingPage.tsx` (988).

## Design system
- Violet-first tokens in `src/index.css`: `--accent-color: #7C3AED`, `--bg-primary: #0b0f19`, `--card-bg: #111827`, `--border-color: #1e293b`.
- Utility classes: `.zakir-card`, `.zakir-card-bento`, `.zakir-btn-primary`, `.zakir-btn-secondary`, `.zakir-input`, `.zakir-badge`, `.zakir-tab`, `.zakir-kpi-block`.
- shadcn-style primitives in `src/components/ui/` (button, input, label, auth-switch, split-login-card) wired to tokens via `@theme inline`.
- **Known inconsistency (fixed):** `src/lib/themeUtils.ts` previously overrode `--accent-color` to gold `#D4AF37` at runtime, fighting the violet-first CSS classes. Now aligned to violet.
- Lots of raw hex (`bg-[#070b13]`, `#0d1527`, `#0a0f1d`) used inline instead of tokens.

## Build / lint
- `npm install` (npm, not bun, in this env).
- `npm run lint` → `tsc --noEmit` (must stay clean).
- `npm run build` → `vite build` + esbuild server. Note: firebase dynamic-import warnings are pre-existing and benign.

## Scope rules (UI/UX redesign)
DO NOT touch: firebase.ts, firebaseServices.ts, firebase-admin.ts, workspace-auth.ts, server.ts, api/, firestore.rules, *.cjs scripts, env.ts, apiUtils.ts, types.ts business logic, worldBankFallback.ts (data), all business/auth logic in App.tsx handlers. Only change JSX/CSS/className presentation + CSS-variable tokens.
