import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auto-updater ────────────────────────────────────────────────────────────
  onUpdateAvailable: (cb: (info: unknown) => void) =>
    ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb: (info: unknown) => void) =>
    ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('install-update'),

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
});
