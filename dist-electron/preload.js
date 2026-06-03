import { contextBridge, ipcRenderer } from "electron";
//#region electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
	onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
	onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", (_e, info) => cb(info)),
	installUpdate: () => ipcRenderer.send("install-update")
});
//#endregion
export {};

//# sourceMappingURL=preload.js.map