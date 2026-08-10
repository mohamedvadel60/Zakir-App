import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// Configure electron-updater
autoUpdater.logger = console;
autoUpdater.autoDownload = false; // Give user control via UI banner
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateStatus(status: string, data: Record<string, any> = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    sendUpdateStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    sendUpdateStatus('available', { info });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Application is up to date:', info.version);
    sendUpdateStatus('not-available', { info });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error during update:', err);
    sendUpdateStatus('error', { error: err ? err.message : 'Update error' });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[AutoUpdater] Progress: ${Math.round(progressObj.percent)}%`);
    sendUpdateStatus('downloading', { progress: progressObj });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    sendUpdateStatus('downloaded', { info });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Ensure full preload and IPC compatibility
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Diagnostics to prevent silent white screen
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron Main] Page failed to load: ${errorCode} - ${errorDescription} (${validatedURL})`);
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Electron Main] Renderer process gone: ${details.reason}`);
  });

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Auto update check for packaged desktop app
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.error('[AutoUpdater] Auto update check failed:', err);
        });
      }, 5000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Crash Handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  mainWindow?.webContents.send('app-error', 'Zakir encountered an unexpected error.');
});

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Communication for Title Bar Controls
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC Communication for Auto-Updater
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Dev mode: update check skipped');
    return { status: 'dev-mode' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'success', result };
  } catch (err: any) {
    console.error('[AutoUpdater] Manual check error:', err);
    return { status: 'error', error: err?.message || 'Check failed' };
  }
});

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) {
    return { status: 'dev-mode' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { status: 'success' };
  } catch (err: any) {
    console.error('[AutoUpdater] Download error:', err);
    return { status: 'error', error: err?.message || 'Download failed' };
  }
});

ipcMain.handle('install-update', () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall(false, true);
  } else {
    console.log('[AutoUpdater] Dev mode: quitAndInstall skipped');
  }
});
