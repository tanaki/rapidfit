import { app, BrowserWindow, ipcMain, shell, nativeImage, session, systemPreferences, globalShortcut } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import type { Client, Session } from '../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// ── Local file server ─────────────────────────────────────────────────────────
// Serves captures and recordings to the renderer over plain HTTP on 127.0.0.1.
// A custom Electron protocol (localfile://) was unreliable — Chromium's URL
// normalisation varies across versions and broke path extraction. A local HTTP
// server is the standard, well-tested approach for streaming local media in
// Electron apps. It listens only on loopback so it is not reachable externally.

const MIME: Record<string, string> = {
  '.png': 'image/png',   '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.webm': 'video/webm',
  '.mp4': 'video/mp4',   '.mov': 'video/quicktime',
};

let fileServerPort = 0;

function startFileServer(): Promise<number> {
  return new Promise(resolve => {
    const server = http.createServer(async (req, res) => {
      // Path is the URL-decoded request path, e.g. /Users/nico/.../file.png
      const filePath = decodeURIComponent(req.url ?? '/');
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] ?? 'application/octet-stream';

      try {
        const stat = await fs.stat(filePath);
        const total = stat.size;
        const rangeHeader = req.headers.range;

        if (rangeHeader) {
          // Byte-range request — required for HTML5 video scrubbing
          const [s, e] = rangeHeader.replace('bytes=', '').split('-');
          const start = parseInt(s, 10);
          const end   = e ? parseInt(e, 10) : total - 1;
          const chunk = end - start + 1;
          res.writeHead(206, {
            'Content-Type':  contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunk,
          });
          fsSync.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Type':   contentType,
            'Accept-Ranges':  'bytes',
            'Content-Length': total,
          });
          fsSync.createReadStream(filePath).pipe(res);
        }
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Port 0 → OS picks a free port
    server.listen(0, '127.0.0.1', () => {
      fileServerPort = (server.address() as { port: number }).port;
      resolve(fileServerPort);
    });
  });
}

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

  // Cmd+Option+I (mac) ou Ctrl+Shift+I (win/linux) ouvre les DevTools en prod
  win.webContents.on('before-input-event', (_e, input) => {
    const toggle =
      (process.platform === 'darwin'
        ? input.meta && input.alt && input.key === 'i'
        : input.control && input.shift && input.key === 'I');
    if (toggle) win.webContents.toggleDevTools();
  });

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

  // Start local file server (port assigned by OS)
  await startFileServer();

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

// ── File server port ──────────────────────────────────────────────────────────
ipcMain.handle('get-file-server-port', () => fileServerPort);

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
  sessionFolderPath, filename, buffer, duration,
}: { sessionFolderPath: string; filename: string; buffer: Uint8Array; duration: number }) => {
  const dest = path.join(sessionFolderPath, 'videos', filename);
  await fs.writeFile(dest, Buffer.from(buffer));
  // Sidecar: store the duration (elapsed recording time) so we can display it
  // in the library without relying on video.duration which is often Infinity
  // for WebM files produced by MediaRecorder.
  await fs.writeFile(`${dest}.info.json`, JSON.stringify({ duration }));
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

ipcMain.handle('sessions:save-state', async (_e, {
  sessionFolderPath, state,
}: { sessionFolderPath: string; state: unknown }) => {
  await fs.writeFile(
    path.join(sessionFolderPath, 'session-state.json'),
    JSON.stringify(state, null, 2),
  );
});

ipcMain.handle('sessions:load-state', async (_e, sessionFolderPath: string) => {
  return readJson<unknown>(path.join(sessionFolderPath, 'session-state.json'), null);
});

ipcMain.handle('sessions:delete-session', async (_e, {
  sessionFolderPath,
}: { sessionFolderPath: string }) => {
  await fs.rm(sessionFolderPath, { recursive: true, force: true });
});

ipcMain.handle('sessions:delete-client', async (_e, {
  clientId, folderPath,
}: { clientId: string; folderPath: string }) => {
  await fs.rm(folderPath, { recursive: true, force: true });
  const clients = await readJson<Client[]>(clientsIndex(), []);
  const updated = clients.filter(c => c.id !== clientId);
  await fs.writeFile(clientsIndex(), JSON.stringify(updated, null, 2));
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
          return { name: f, path: filePath, createdAt: stat.birthtime.toISOString(), duration: 0 };
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
          // Read sidecar duration (written at record time via save-recording).
          // Falls back to 0 if the file was recorded before this feature.
          const info = await readJson<{ duration: number }>(`${filePath}.info.json`, { duration: 0 });
          return { name: f, path: filePath, createdAt: stat.birthtime.toISOString(), duration: info.duration };
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
