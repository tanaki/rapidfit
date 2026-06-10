import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auto-updater ────────────────────────────────────────────────────────────
  // Each on* call registers a listener and returns a cleanup function so React
  // can remove it when the component unmounts — prevents listener accumulation.
  onUpdateAvailable: (cb: (info: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: unknown) => cb(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloadProgress: (cb: (info: { percent: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { percent: number }) => cb(info);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (cb: (info: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: unknown) => cb(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateNotAvailable: (cb: (info: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: unknown) => cb(info);
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateError: (cb: (message: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, message: string) => cb(message);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check-now'),

  // ── File server ─────────────────────────────────────────────────────────────
  getFileServerPort: () => ipcRenderer.invoke('get-file-server-port'),

  // ── Camera ─────────────────────────────────────────────────────────────────
  cameraRequestAccess: () => ipcRenderer.invoke('camera:request-access'),
  cameraGetStatus: () => ipcRenderer.invoke('camera:get-status'),

  // ── Sessions ────────────────────────────────────────────────────────────────
  sessionsList: () =>
    ipcRenderer.invoke('sessions:list'),
  sessionsCreateClient: (client: unknown) =>
    ipcRenderer.invoke('sessions:create-client', client),
  sessionsCreateSession: (session: unknown) =>
    ipcRenderer.invoke('sessions:create-session', session),
  sessionsSaveCapture: (payload: unknown) =>
    ipcRenderer.invoke('sessions:save-capture', payload),
  sessionsSaveRecording: (payload: unknown) =>
    ipcRenderer.invoke('sessions:save-recording', payload),
  sessionsSaveState: (payload: unknown) =>
    ipcRenderer.invoke('sessions:save-state', payload),
  sessionsLoadState: (sessionFolderPath: string) =>
    ipcRenderer.invoke('sessions:load-state', sessionFolderPath),
  sessionsDeleteSession: (payload: unknown) =>
    ipcRenderer.invoke('sessions:delete-session', payload),
  sessionsDeleteClient: (payload: unknown) =>
    ipcRenderer.invoke('sessions:delete-client', payload),
  sessionsDeleteCapture: (payload: unknown) =>
    ipcRenderer.invoke('sessions:delete-capture', payload),
  sessionsDeleteRecording: (payload: unknown) =>
    ipcRenderer.invoke('sessions:delete-recording', payload),
  sessionsListCaptures: (sessionFolderPath: string) =>
    ipcRenderer.invoke('sessions:list-captures', sessionFolderPath),
  sessionsListRecordings: (sessionFolderPath: string) =>
    ipcRenderer.invoke('sessions:list-recordings', sessionFolderPath),
  sessionsUpdateClient: (client: unknown) =>
    ipcRenderer.invoke('sessions:update-client', client),
  sessionsGetLast: () =>
    ipcRenderer.invoke('sessions:get-last'),
  sessionsSetLast: (data: unknown) =>
    ipcRenderer.invoke('sessions:set-last', data),

  // ── Company settings ────────────────────────────────────────────────────────
  companyGet: () => ipcRenderer.invoke('company:get'),
  companySave: (settings: unknown) => ipcRenderer.invoke('company:save', settings),

  // ── Report data ─────────────────────────────────────────────────────────────
  sessionsSaveReport: (payload: unknown) => ipcRenderer.invoke('sessions:save-report', payload),
  sessionsLoadReport: (sessionFolderPath: string) => ipcRenderer.invoke('sessions:load-report', sessionFolderPath),

  // ── App assets ───────────────────────────────────────────────────────────────
  appGetAssetPath: (name: string) => ipcRenderer.invoke('app:get-asset-path', name),
});
