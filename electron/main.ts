import { app, BrowserWindow, ipcMain, shell, nativeImage, session, systemPreferences, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import type { Client, Session } from '../src/types/index.js';

// Register localfile:// scheme before app is ready so it is treated as secure.
// This allows the renderer to load images and videos from the user's filesystem
// without cross-origin restrictions (file:// is blocked from http://localhost).
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true } },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

const iconPath = isDev
  ? path.join(__dirname, '../build/icon.png')
  : path.join(process.resourcesPath, 'icon.png');

// ── Filesystem helpers ────────────────────────────────────────────────────────

const rapidfitDir = () => path.join(app.getPath('documents'), 'RapidFit');
const clientsIndex = () => path.join(rapidfitDir(), 'clients.json');
const lastSessionFile = () => path.join(rapidfitDir(), 'last-session.json');

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const icon = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'RapidFit',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    app.dock.setIcon(icon);
  }

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  // ── Camera / microphone permissions ────────────────────────────────────────
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'media') return true;
    return null;
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });

  // localfile:// → serve any local file path securely to the renderer
  protocol.handle('localfile', req => {
    const filePath = decodeURIComponent(req.url.slice('localfile://'.length));
    return net.fetch(`file://${filePath}`);
  });

  // On macOS, request system-level camera access before the window opens.
  // setPermissionRequestHandler handles Electron's internal layer; this call
  // handles the macOS TCC (Privacy) layer which is a separate gate.
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('camera');
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  if (!isDev) autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Auto-updater ──────────────────────────────────────────────────────────────

autoUpdater.on('update-available', (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-available', info);
});
autoUpdater.on('update-downloaded', (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-downloaded', info);
});
autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
});
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// ── Camera IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('camera:request-access', async () => {
  if (process.platform === 'darwin') {
    return systemPreferences.askForMediaAccess('camera');
  }
  return true;
});

ipcMain.handle('camera:get-status', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('camera');
  }
  return 'granted';
});

// ── Sessions IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('sessions:list', async () => {
  await ensureDir(rapidfitDir());
  const clients = await readJson<Client[]>(clientsIndex(), []);
  const sessionsByClient: Record<string, Session[]> = {};

  for (const client of clients) {
    const sessionsDir = path.join(client.folderPath, 'sessions');
    try {
      const dirs = await fs.readdir(sessionsDir);
      const sessions: Session[] = [];
      for (const dir of dirs) {
        const s = await readJson<Session | null>(path.join(sessionsDir, dir, 'session.json'), null);
        if (s) sessions.push(s);
      }
      sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      sessionsByClient[client.id] = sessions;
    } catch {
      sessionsByClient[client.id] = [];
    }
  }

  return { clients, sessionsByClient };
});

ipcMain.handle('sessions:create-client', async (_e, client: Client) => {
  await ensureDir(rapidfitDir());
  const clientDir = path.join(rapidfitDir(), 'clients', client.id);
  await ensureDir(path.join(clientDir, 'sessions'));

  const saved: Client = { ...client, folderPath: clientDir };
  await fs.writeFile(path.join(clientDir, 'client.json'), JSON.stringify(saved, null, 2));

  const clients = await readJson<Client[]>(clientsIndex(), []);
  clients.push(saved);
  await fs.writeFile(clientsIndex(), JSON.stringify(clients, null, 2));

  return saved;
});

ipcMain.handle('sessions:create-session', async (_e, session: Session) => {
  const sessionDir = path.join(
    rapidfitDir(), 'clients', session.clientId, 'sessions', session.id,
  );
  await ensureDir(path.join(sessionDir, 'captures'));
  await ensureDir(path.join(sessionDir, 'videos'));
  await ensureDir(path.join(sessionDir, 'reports'));

  const saved: Session = { ...session, folderPath: sessionDir };
  await fs.writeFile(path.join(sessionDir, 'session.json'), JSON.stringify(saved, null, 2));

  return saved;
});

ipcMain.handle('sessions:save-capture', async (_e, {
  sessionFolderPath, filename, buffer,
}: { sessionFolderPath: string; filename: string; buffer: Uint8Array }) => {
  const dest = path.join(sessionFolderPath, 'captures', filename);
  await fs.writeFile(dest, Buffer.from(buffer));
  return dest;
});

ipcMain.handle('sessions:save-recording', async (_e, {
  sessionFolderPath, filename, buffer,
}: { sessionFolderPath: string; filename: string; buffer: Uint8Array }) => {
  const dest = path.join(sessionFolderPath, 'videos', filename);
  await fs.writeFile(dest, Buffer.from(buffer));
  return dest;
});

ipcMain.handle('sessions:update-client', async (_e, client: Client) => {
  await fs.writeFile(path.join(client.folderPath, 'client.json'), JSON.stringify(client, null, 2));
  const clients = await readJson<Client[]>(clientsIndex(), []);
  const idx = clients.findIndex(c => c.id === client.id);
  if (idx >= 0) clients[idx] = client;
  await fs.writeFile(clientsIndex(), JSON.stringify(clients, null, 2));
  return client;
});

ipcMain.handle('sessions:list-captures', async (_e, sessionFolderPath: string) => {
  const dir = path.join(sessionFolderPath, 'captures');
  try {
    const files = await fs.readdir(dir);
    const items = await Promise.all(
      files
        .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
        .map(async f => {
          const filePath = path.join(dir, f);
          const stat = await fs.stat(filePath);
          return { name: f, path: filePath, createdAt: stat.birthtime.toISOString() };
        }),
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
});

ipcMain.handle('sessions:list-recordings', async (_e, sessionFolderPath: string) => {
  const dir = path.join(sessionFolderPath, 'videos');
  try {
    const files = await fs.readdir(dir);
    const items = await Promise.all(
      files
        .filter(f => /\.(webm|mp4|mov)$/i.test(f))
        .map(async f => {
          const filePath = path.join(dir, f);
          const stat = await fs.stat(filePath);
          return { name: f, path: filePath, createdAt: stat.birthtime.toISOString() };
        }),
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
});

ipcMain.handle('sessions:get-last', async () => {
  return readJson<{ clientId: string; sessionId: string } | null>(lastSessionFile(), null);
});

ipcMain.handle('sessions:set-last', async (_e, data: { clientId: string; sessionId: string } | null) => {
  await ensureDir(rapidfitDir());
  if (data) {
    await fs.writeFile(lastSessionFile(), JSON.stringify(data, null, 2));
  } else {
    try { await fs.unlink(lastSessionFile()); } catch { /* already gone */ }
  }
});
