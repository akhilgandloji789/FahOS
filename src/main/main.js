/**
 * FahOS - The Voice-First AI Operating Layer for Windows
 * Phase 1: Core Electron Shell & Obsidian Glass HUD Overlay
 */

const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { loadConfig } = require('./config');

// Prevent duplicate instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[FahOS] Another instance is already running. Exiting.');
  app.quit();
  process.exit(0);
}

const isDev = process.argv.includes('--dev');

// Disable hardware acceleration to eliminate Windows DWM rectangular shadow artifacts
app.disableHardwareAcceleration();

let cfg = loadConfig();
let win = null;
let tray = null;
let lastShowTime = 0;

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const areaW = primary.workAreaSize.width;
  const WIN_W = 470;
  const WIN_H = 265;

  win = new BrowserWindow({
    title: 'FahOS',
    width: WIN_W,
    height: WIN_H,
    minWidth: WIN_W,
    maxWidth: WIN_W,
    minHeight: 200,
    maxHeight: 920,
    x: Math.round((areaW - WIN_W) / 2),
    y: 40,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'overlay', 'index.html'));
  win.setAlwaysOnTop(true);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if ((input.control || input.meta) && input.code === 'Space') {
        event.preventDefault();
        toggleOverlay();
      } else if (input.code === 'Escape') {
        event.preventDefault();
        hideOverlay();
      }
    }
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[FahOS] Obsidian Glass Overlay loaded.');
    win.webContents.send('fahos:appear');
    win.webContents.send('fahos:focusInput');
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

function showOverlay() {
  if (!win) return;
  lastShowTime = Date.now();
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.moveTop();
  win.focus();
  win.webContents.send('fahos:appear');
  win.webContents.send('fahos:focusInput');
}

function hideOverlay() {
  if (!win || !win.isVisible()) return;
  win.webContents.send('fahos:prepareHide');
  setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  }, 180);
}

function toggleOverlay() {
  if (!win) return;
  const now = Date.now();
  if (now - lastShowTime < 200) return;
  lastShowTime = now;

  if (win.isVisible() && !win.isMinimized()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

app.on('second-instance', () => {
  showOverlay();
});

app.whenReady().then(() => {
  app.setName('FahOS');

  createWindow();

  // Create System Tray
  try {
    const iconPath = path.join(__dirname, '..', 'renderer', 'shared', 'assets', 'logo.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('FahOS — Voice AI (Ctrl + Space)');
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open FahOS (Ctrl+Space)', click: () => showOverlay() },
      { type: 'separator' },
      { label: 'Quit FahOS', click: () => app.quit() }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.on('click', () => toggleOverlay());
  } catch (e) {
    console.warn('[FahOS] Could not create system tray:', e.message);
  }

  // Register Global Hotkeys
  globalShortcut.unregisterAll();
  globalShortcut.register('CommandOrControl+Space', () => {
    toggleOverlay();
  });
  globalShortcut.register('Alt+Space', () => {
    toggleOverlay();
  });

  // ---- Core IPC Handlers (Phase 1) ----
  ipcMain.handle('fahos:getInfo', async () => ({
    provider: 'FahOS Core',
    shortcut: 'Ctrl+Space',
    version: app.getVersion(),
    orchestrator: false
  }));

  ipcMain.handle('fahos:runAction', async (_event, payload) => {
    const text = (payload && payload.text) || '';
    return {
      ok: true,
      provider: 'FahOS Core',
      output: `**FahOS Glass HUD Active!**\n\nReceived: "${text}"\n\n*Phase 1 Scaffolding complete. AI Orchestration pipeline connects in Phase 2.*`
    };
  });

  ipcMain.handle('fahos:orchestrate', async (_event, payload) => {
    const text = (payload && payload.text) || '';
    return {
      ok: true,
      tier: 'simple',
      provider: 'FahOS Core',
      output: `**[FahOS HUD]** Core UI overlay active.\n\nQuery: *"${text}"*\n\n*(AI multi-model orchestrator is staged for Phase 2)*`
    };
  });

  ipcMain.handle('fahos:getHistory', async () => []);
  ipcMain.handle('fahos:addHistory', async () => ({ ok: true }));
  ipcMain.handle('fahos:clearHistory', async () => ({ ok: true }));
  ipcMain.handle('fahos:getContacts', async () => []);

  ipcMain.handle('fahos:setHeight', async (_event, targetHeight) => {
    if (win && !win.isDestroyed()) {
      const [w] = win.getSize();
      win.setSize(w, Math.round(targetHeight));
    }
    return { ok: true };
  });

  ipcMain.on('fahos:moveWindow', (_event, payload) => {
    if (win && !win.isDestroyed()) {
      const deltaX = (payload && payload.deltaX) || 0;
      const deltaY = (payload && payload.deltaY) || 0;
      const [x, y] = win.getPosition();
      win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
  });

  ipcMain.on('fahos:hide', () => {
    if (win) win.hide();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showOverlay();
  });
});

app.on('window-all-closed', () => { /* keep running in background */ });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
