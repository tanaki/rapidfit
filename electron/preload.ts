import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Auto-updater ────────────────────────────────────────────────────────────
  onUpdateAvailable: (cb: (info: unknown) => void) =>
    ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb: (info: unknown) => void) =>
    ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('install-update'),

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
