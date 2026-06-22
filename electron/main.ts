import { app, BrowserWindow, ipcMain, shell, nativeImage, session, systemPreferences, globalShortcut } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

declare const __GH_UPDATE_TOKEN__: string;
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
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
            'Access-Control-Allow-Origin': '*',
          });
          fsSync.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Type':   contentType,
            'Accept-Ranges':  'bytes',
            'Content-Length': total,
            'Access-Control-Allow-Origin': '*',
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
    // vite-plugin-electron injecte le port réel dans VITE_DEV_SERVER_URL
    win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173');
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
  // 'media' covers getUserMedia in most Electron versions.
  // 'camera' / 'microphone' are used in some Chromium codepaths (Electron 42+).
  const ALLOWED_PERMISSIONS = new Set(['media', 'camera', 'microphone']);

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (ALLOWED_PERMISSIONS.has(permission)) return true;
    return null;   // default behaviour for everything else
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
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
  if (!isDev) {
    if (__GH_UPDATE_TOKEN__) {
      log.info(`[updater] token présent (${__GH_UPDATE_TOKEN__.slice(0, 6)}…)`);
      log.info(`[updater] version courante : ${app.getVersion()}`);
      if (process.platform === 'darwin') {
        // Sur Mac, electron-updater utilise MacUpdater/ShipIt qui exige une
        // signature Apple. On bypasse complètement avec un updater custom.
        checkForUpdatesMac(__GH_UPDATE_TOKEN__);
      } else {
        process.env.GH_TOKEN = __GH_UPDATE_TOKEN__;
        autoUpdater.checkForUpdates();
      }
    } else {
      log.warn('[updater] GH_UPDATE_TOKEN absent — auto-update désactivé');
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Save-before-quit ──────────────────────────────────────────────────────────
// Notifie le renderer pour qu'il flush la sauvegarde, puis quitte.
let quitting = false;
app.on('before-quit', e => {
  if (quitting) return;
  e.preventDefault();
  const w = BrowserWindow.getAllWindows()[0];
  if (!w) { quitting = true; app.quit(); return; }
  // Timeout de sécurité : quitte après 3s même si le renderer ne répond pas
  const fallback = setTimeout(() => { quitting = true; app.quit(); }, 3000);
  ipcMain.once('app:ready-to-quit', () => {
    clearTimeout(fallback);
    quitting = true;
    app.quit();
  });
  w.webContents.send('app:before-quit');
});

// ── Auto-updater Windows (electron-updater) ───────────────────────────────────

autoUpdater.logger = log;
(autoUpdater.logger as typeof log).transports.file.level = 'info';
autoUpdater.on('checking-for-update',  () => log.info('[updater-win] vérification…'));
autoUpdater.on('update-not-available', () => {
  log.info('[updater-win] à jour');
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-not-available', { version: app.getVersion() });
});
autoUpdater.on('update-available',  (info) => {
  log.info(`[updater-win] disponible : ${info.version}`);
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-available', info);
});
autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent);
  log.info(`[updater-win] progression : ${percent}%`);
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-download-progress', { percent });
});
autoUpdater.on('update-downloaded', (info) => {
  log.info(`[updater-win] téléchargé : ${info.version}`);
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-downloaded', info);
});
autoUpdater.on('error', (err) => {
  log.error('[updater-win] erreur :', err.message);
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-error', err.message);
});

// ── Auto-updater Mac custom (bypass MacUpdater/ShipIt) ────────────────────────
// electron-updater utilise Squirrel.Mac (ShipIt) qui exige une signature Apple.
// On bypasse entièrement : appel direct à l'API GitHub, téléchargement du zip,
// installation via script bash (remplace le bundle .app sans passer par ShipIt).

let macDownloadedZip: string | null = null;

function githubApiGet(apiPath: string, token: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'RapidFit-Updater',
        Accept: 'application/vnd.github.v3+json',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function downloadFile(
  url: string,
  token: string,
  dest: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    function follow(u: string, withAuth: boolean) {
      const parsed = new URL(u);
      const headers: Record<string, string> = { 'User-Agent': 'RapidFit-Updater' };
      if (withAuth) {
        headers.Authorization = `token ${token}`;
        headers.Accept = 'application/octet-stream';
      }
      https.request({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers }, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          follow(res.headers.location!, false); // CDN redirect, pas d'auth
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`Download ${res.statusCode}`)); return; }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let received = 0;
        let lastPercent = -1;

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (onProgress && total > 0) {
            const percent = Math.round((received / total) * 100);
            if (percent !== lastPercent) {
              lastPercent = percent;
              onProgress(percent);
            }
          }
        });

        const file = fsSync.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject).end();
    }
    follow(url, true);
  });
}

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = latest.split('.').map(Number);
  const [cMaj, cMin, cPat] = current.split('.').map(Number);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

async function checkForUpdatesMac(token: string) {
  const win = () => BrowserWindow.getAllWindows()[0];
  try {
    log.info('[updater-mac] vérification…');
    const release = await githubApiGet('/repos/tanaki/rapidfit/releases/latest', token) as {
      tag_name: string;
      assets: { id: number; name: string }[];
    };
    const latest = release.tag_name.replace(/^v/, '');
    const current = app.getVersion();
    log.info(`[updater-mac] latest=${latest} current=${current}`);

    if (!isNewer(latest, current)) {
      log.info('[updater-mac] déjà à jour');
      win()?.webContents.send('update-not-available', { version: current });
      return;
    }

    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const assetName = `RapidFit-${latest}-mac-${arch}.zip`;
    const asset = release.assets.find(a => a.name === assetName);
    if (!asset) {
      log.warn(`[updater-mac] asset introuvable : ${assetName}`);
      return;
    }

    log.info(`[updater-mac] nouvelle version ${latest}, téléchargement…`);
    win()?.webContents.send('update-available', { version: latest });

    const zipPath = path.join(app.getPath('temp'), assetName);
    await downloadFile(
      `https://api.github.com/repos/tanaki/rapidfit/releases/assets/${asset.id}`,
      token, zipPath,
      (percent) => {
        win()?.webContents.send('update-download-progress', { percent });
      },
    );

    macDownloadedZip = zipPath;
    log.info(`[updater-mac] prêt à installer : ${zipPath}`);
    win()?.webContents.send('update-downloaded', { version: latest });

  } catch (err) {
    log.error('[updater-mac] erreur :', (err as Error).message);
    win()?.webContents.send('update-error', (err as Error).message);
  }
}

function installWithScript(zipPath: string) {
  const appBundle = path.resolve(process.execPath, '..', '..', '..');
  const appParent = path.dirname(appBundle);
  const appName   = path.basename(appBundle);
  const tmpScript = path.join(app.getPath('temp'), 'rapidfit-update.sh');

  const script = [
    '#!/bin/bash',
    'sleep 2',
    `ZIP="${zipPath}"`,
    `APP_PATH="${appBundle}"`,
    `PARENT="${appParent}"`,
    `APP_NAME="${appName}"`,
    'TMP=$(mktemp -d)',
    'unzip -o "$ZIP" -d "$TMP"',
    'rm -rf "$APP_PATH"',
    'cp -r "$TMP/$APP_NAME" "$PARENT/"',
    'xattr -rd com.apple.quarantine "$PARENT/$APP_NAME" 2>/dev/null || true',
    'open "$PARENT/$APP_NAME"',
    'rm -rf "$TMP"',
  ].join('\n');

  fsSync.writeFileSync(tmpScript, script, { mode: 0o755 });
  log.info(`[updater-mac] script : ${tmpScript}`);
  log.info(`[updater-mac] bundle : ${appBundle}`);
  spawn('bash', [tmpScript], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

ipcMain.handle('updater:check-now', () => {
  if (!__GH_UPDATE_TOKEN__) {
    BrowserWindow.getAllWindows()[0]?.webContents.send('update-error', 'Token GitHub absent — mise à jour désactivée');
    return;
  }
  if (process.platform === 'darwin') {
    checkForUpdatesMac(__GH_UPDATE_TOKEN__);
  } else {
    process.env.GH_TOKEN = __GH_UPDATE_TOKEN__;
    autoUpdater.checkForUpdates();
  }
});

ipcMain.on('install-update', () => {
  if (process.platform === 'darwin' && macDownloadedZip) {
    log.info('[updater-mac] installation via script bash');
    installWithScript(macDownloadedZip);
  } else {
    autoUpdater.quitAndInstall();
  }
});

// ── File server port ──────────────────────────────────────────────────────────
ipcMain.handle('get-file-server-port', () => fileServerPort);

// ── App asset path ────────────────────────────────────────────────────────────
// Returns the absolute filesystem path to a static asset inside dist/.
// Used by the renderer to load app assets via the local file server in packaged
// builds (where window.location.origin is "null" for file:// URLs).
ipcMain.handle('app:get-asset-path', (_e, name: string) =>
  path.join(app.getAppPath(), 'dist', name),
);

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

ipcMain.handle('sessions:delete-capture', async (_e, { filePath }: { filePath: string }) => {
  await fs.unlink(filePath);
});

ipcMain.handle('sessions:delete-recording', async (_e, { filePath }: { filePath: string }) => {
  await fs.unlink(filePath);
  try { await fs.unlink(`${filePath}.info.json`); } catch { /* sidecar may not exist */ }
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

// ── Company settings ──────────────────────────────────────────────────────────
const companySettingsFile = () => path.join(app.getPath('userData'), 'company-settings.json');

ipcMain.handle('company:get', async () => {
  return readJson(companySettingsFile(), { name: '', subtitle: '', logoDataUrl: '' });
});

ipcMain.handle('company:save', async (_e, settings: unknown) => {
  await fs.writeFile(companySettingsFile(), JSON.stringify(settings, null, 2), 'utf-8');
});

// ── Report data ───────────────────────────────────────────────────────────────
ipcMain.handle('sessions:save-report', async (_e, { sessionFolderPath, data }: { sessionFolderPath: string; data: unknown }) => {
  await fs.writeFile(path.join(sessionFolderPath, 'report.json'), JSON.stringify(data, null, 2), 'utf-8');
});

ipcMain.handle('sessions:load-report', async (_e, sessionFolderPath: string) => {
  return readJson(path.join(sessionFolderPath, 'report.json'), null);
});
