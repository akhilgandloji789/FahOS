/**
 * FahOS Agent Browser Window Manager
 * Creates an expansive, large-screen desktop window housing the live browser view
 * and the real-time agent step HUD.
 */
const electron = require('electron');
const path = require('path');
const agentController = require('./agentBrowserController');

let agentWindow = null;
let currentWebviewContents = null;
let ipcRegistered = false;

function registerIpcHandlers() {
  if (ipcRegistered) return;
  const ipc = electron.ipcMain;
  if (!ipc || !ipc.on) return;

  ipc.on('agent:stop', () => {
    console.log('[FahOS Agent Browser] User requested stop.');
    agentController.cancel();
  });

  ipc.on('agent:close', () => {
    if (agentWindow && !agentWindow.isDestroyed()) {
      agentWindow.close();
    }
  });

  ipcRegistered = true;
}

function createAgentBrowserWindow(initialUrl = null) {
  registerIpcHandlers();

  const { BrowserWindow, screen } = electron;
  if (!BrowserWindow || !screen) {
    console.warn('[FahOS Agent Browser] Electron UI not available');
    return null;
  }

  if (agentWindow && !agentWindow.isDestroyed()) {
    if (agentWindow.isMinimized()) agentWindow.restore();
    agentWindow.show();
    agentWindow.focus();
    agentWindow.moveTop();
    if (initialUrl && currentWebviewContents && !currentWebviewContents.isDestroyed()) {
      currentWebviewContents.loadURL(initialUrl);
    }
    return agentWindow;
  }

  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.workAreaSize;

  // Make screen expansive (94% width, 92% height) so judges can see the entire webpage clearly
  const winW = Math.min(1520, Math.round(width * 0.94));
  const winH = Math.min(960, Math.round(height * 0.92));

  agentWindow = new BrowserWindow({
    title: 'FahOS Unified Browser',
    width: winW,
    height: winH,
    minWidth: 900,
    minHeight: 650,
    center: true,
    frame: true,
    backgroundColor: '#0d0f17',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'agentBrowserPreload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  agentWindow.loadFile(path.join(__dirname, '..', '..', '..', 'renderer', 'browser', 'agentBrowser.html'));

  agentWindow.show();
  agentWindow.focus();
  agentWindow.moveTop();

  // Capture webview webContents as soon as attached
  agentWindow.webContents.on('did-attach-webview', (_, contents) => {
    currentWebviewContents = contents;
    console.log('[FahOS Agent Browser] Webview attached successfully.');
    if (initialUrl) {
      contents.loadURL(initialUrl);
    }
  });

  agentWindow.on('closed', () => {
    agentWindow = null;
    currentWebviewContents = null;
    agentController.cancel();
  });

  return agentWindow;
}

async function runAgentTask(taskText) {
  const win = createAgentBrowserWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.moveTop();
  }

  // Wait for window to load
  await new Promise(r => setTimeout(r, 800));

  win.webContents.send('agent:init', { task: taskText });

  // Wait for webview contents to attach
  for (let i = 0; i < 25; i++) {
    if (currentWebviewContents && !currentWebviewContents.isDestroyed()) break;
    await new Promise(r => setTimeout(r, 200));
  }

  if (!currentWebviewContents) {
    win.webContents.send('agent:result-update', {
      ok: false,
      summary: 'Could not initialize webview engine.'
    });
    return { ok: false, summary: 'Could not initialize webview engine.' };
  }

  const result = await agentController.executeTask(
    taskText,
    currentWebviewContents,
    (stepData) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('agent:step-update', stepData);
      }
    }
  );

  if (win && !win.isDestroyed()) {
    win.webContents.send('agent:result-update', result);
  }

  return result;
}

module.exports = {
  createAgentBrowserWindow,
  runAgentTask
};
