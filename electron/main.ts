import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// Chemin vers l'icône PNG selon le contexte
const iconPath = isDev
  ? path.join(__dirname, '../build/icon.png')
  : path.join(process.resourcesPath, 'icon.png');

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

  // Icône Dock macOS
  if (process.platform === 'darwin') {
    app.dock.setIcon(icon);
  }

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Check for updates after window is ready (production only)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Auto-updater events ───────────────────────────────────────────────────────

autoUpdater.on('update-available', (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err);
});

// IPC: renderer asks to install the downloaded update
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
