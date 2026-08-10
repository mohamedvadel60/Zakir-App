# Zakir — Institutional Decision Intelligence Platform

Zakir is an advanced institutional decision-intelligence web and desktop platform built with React, TypeScript, Vite, Electron, Tailwind CSS, and Firebase.

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Web Development Mode
```bash
npm run dev
```
Launches the Express + Vite server at `http://localhost:3000`.

### 3. Electron Desktop Development
```bash
npm run electron:dev
```
Starts the Vite dev server and launches Electron connected to `http://localhost:3000`.

---

## 📦 Building for Production

### Web Production Build
```bash
npm run build
```
Generates production web assets in `dist/` and bundled server in `dist/server.cjs`.

### Desktop Production Build (Executable & Installer)
```bash
npm run electron:build
```
Bundles the renderer (`dist/`), compiles Electron main (`dist-electron/main.mjs`) and CommonJS preload (`dist-electron/preload.cjs`), and packages the Windows NSIS installer in `release/`.

Output files:
- `release/Zakir-Setup-1.0.0.exe` (Windows NSIS Installer)
- `release/win-unpacked/Zakir.exe` (Unpacked Standalone Application)

---

## 🛠️ Production Architecture & White Screen Resolution

### Root Causes Solved for Desktop White Screen:
1. **Relative Base Path**: Configured `base: './'` in `vite.config.ts`. Previously, assets were loaded with leading `/assets/index.js`, which failed under Electron's `file://` protocol.
2. **CommonJS Preload Script**: Compiled `electron/preload.ts` to CommonJS (`dist-electron/preload.cjs`). Preload scripts in Electron isolation cannot be loaded as ES Modules (`preload.mjs`).
3. **Optimized Chunking**: Cleaned up Vite `manualChunks` to ensure fast, reliable local asset loading from `app.asar`.
4. **React Error Boundary**: Implemented `<ErrorBoundary>` in `src/main.tsx` so any runtime or Firebase initialization error renders a human-readable error fallback instead of a blank white screen.

### Desktop Auto-Update & GitHub Releases:
- **`electron-updater`**: Integrated into `electron/main.ts` checking `mohamedvadel60/Zakir-Web-App` GitHub releases.
- **`DesktopUpdateNotification`**: React banner component listening to `window.zakirDesktop.onUpdateStatus` and giving users single-click update and restart options.
- **GitHub Release Workflow**: Automatically triggered on `v*` tag pushes (`.github/workflows/release.yml`).

---

## 🔑 Environment Variables & Security

Copy `.env.example` to `.env` and set required keys:

```env
# Gemini AI
GEMINI_API_KEY="..."

# Domain & Downloads
APP_URL="https://getzakir.com"
VITE_DESKTOP_DOWNLOAD_URL="https://github.com/mohamedvadel60/Zakir-Web-App/releases/download/v1.0.0/Zakir-Setup-1.0.0.exe"

# Firebase Credentials
FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="..."
```

### Windows Code Signing Secrets (GitHub Actions)
To sign Windows executables and bypass SmartScreen warnings, configure these repository secrets:
- `CSC_LINK`: Base64 encoded `.pfx` certificate.
- `CSC_KEY_PASSWORD`: Password for the `.pfx` certificate.
