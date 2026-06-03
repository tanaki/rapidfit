let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	onUpdateAvailable: (cb) => electron.ipcRenderer.on("update-available", (_e, info) => cb(info)),
	onUpdateDownloaded: (cb) => electron.ipcRenderer.on("update-downloaded", (_e, info) => cb(info)),
	installUpdate: () => electron.ipcRenderer.send("install-update")
});
//#endregion

//# sourceMappingURL=preload.js.map