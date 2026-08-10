import { contextBridge, ipcRenderer } from 'electron';

export interface UpdateStatusData {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'dev-mode';
  info?: any;
  progress?: {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  };
  error?: string;
}

const desktopAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (data: UpdateStatusData) => void) => {
    const subscription = (_event: any, data: UpdateStatusData) => callback(data);
    ipcRenderer.on('update-status', subscription);
    return () => {
      ipcRenderer.removeListener('update-status', subscription);
    };
  }
};

contextBridge.exposeInMainWorld('electronAPI', desktopAPI);
contextBridge.exposeInMainWorld('zakirDesktop', desktopAPI);
