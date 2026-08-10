var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var desktopAPI = {
  minimize: () => import_electron.ipcRenderer.send("window-minimize"),
  maximize: () => import_electron.ipcRenderer.send("window-maximize"),
  close: () => import_electron.ipcRenderer.send("window-close"),
  getAppVersion: () => import_electron.ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => import_electron.ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => import_electron.ipcRenderer.invoke("download-update"),
  installUpdate: () => import_electron.ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback) => {
    const subscription = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("update-status", subscription);
    return () => {
      import_electron.ipcRenderer.removeListener("update-status", subscription);
    };
  }
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", desktopAPI);
import_electron.contextBridge.exposeInMainWorld("zakirDesktop", desktopAPI);
