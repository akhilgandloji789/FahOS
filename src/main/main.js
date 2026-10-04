/**
 * FahOS - The Voice-First AI Operating Layer for Windows
 * Phase 2: Pluggable AI Multi-Provider Foundation & Intent Orchestrator
 */

const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, shell, session, desktopCapturer } = require('electron');
const path = require('path');
const { loadConfig } = require('./config');
const { runAction, createProvider } = require('./features/ai/router');
const { orchestrateResponse, classifyQuery, getTierInfo, listTiers } = require('./features/ai/orchestrator');
const { getTranscriber } = require('./features/voice/localWhisper');
const whisperService = require('./features/voice/whisperService');
const nativeStt = require('./features/voice/nativeStt');
const visualAgent = require('./features/vision/visualAgent');

// Configure in-memory screen capturer (zero disk storage, 100% ephemeral)
visualAgent.setScreenCapturer(async () => {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.bounds;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });
  if (sources.length > 0) {
    return sources[0].thumbnail.toJPEG(75).toString('base64');
  }
  return null;
});

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

  // Auto-grant microphone permissions so Web Speech and getUserMedia work seamlessly
  try {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') return callback(true);
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);
  } catch (err) {
    console.warn('[FahOS] Permission handler notice:', err.message);
  }

  createWindow();

  // Pre-warm local Whisper model in background
  try {
    getTranscriber().catch((e) => console.warn('[FahOS] Whisper pre-warm warning:', e));
  } catch (_) {}

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

  // ---- AI Routing & Orchestration IPC Handlers (Phase 2) ----
  ipcMain.handle('fahos:getInfo', async () => ({
    provider: createProvider(cfg).name,
    shortcut: 'Ctrl+Space',
    version: app.getVersion(),
    orchestrator: true
  }));

  ipcMain.handle('fahos:runAction', async (_event, payload) => {
    const action = (payload && payload.action) || 'ask';
    const text = (payload && payload.text) || '';
    if (!text.trim()) return { ok: false, provider: createProvider(cfg).name, error: 'Empty request.' };
    return runAction({ cfg, action, text });
  });

  ipcMain.handle('fahos:orchestrate', async (_event, payload) => {
    const text = (payload && payload.text) || '';
    const hasImage = (payload && payload.hasImage) || false;
    const imageBase64 = (payload && payload.imageBase64) || null;
    if (!text.trim() && !hasImage) return { ok: false, error: 'Empty request.' };
    const classification = classifyQuery(text, hasImage);
    console.log(`[FahOS Orchestrator] Query: "${text.slice(0, 50)}..." → Tier: ${classification.tier}`);
    return orchestrateResponse(cfg, text, hasImage, imageBase64);
  });

  ipcMain.handle('fahos:getTierInfo', async (_event, tier) => {
    if (tier) return getTierInfo(tier);
    return { tiers: listTiers() };
  });

  // Local-First History IPC Handlers
  const historyService = require('./features/history/historyService');
  ipcMain.handle('fahos:getHistory', async () => {
    return historyService.loadHistory();
  });

  ipcMain.handle('fahos:addHistory', async (_event, item) => {
    return historyService.addEntry(item);
  });

  ipcMain.handle('fahos:clearHistory', async () => {
    return historyService.clearHistory();
  });

  // Local-First Phonebook (Contacts) IPC Handlers
  const contactsService = require('./features/contacts/contactsService');
  const systemActions = require('./features/system/systemActions');
  ipcMain.handle('fahos:getContacts', async () => {
    return contactsService.getAllContacts();
  });

  ipcMain.handle('fahos:saveContact', async (_event, payload) => {
    return contactsService.saveContact(payload.name, payload.phone, payload.email);
  });

  ipcMain.handle('fahos:composeEmail', async (_event, payload) => {
    const target = payload && (payload.contactOrEmail || payload.target || payload.email || payload.name);
    return systemActions.composeEmail(target, payload && payload.subject, payload && payload.body);
  });

  ipcMain.handle('fahos:deleteContact', async (_event, name) => {
    return contactsService.deleteContact(name);
  });

  ipcMain.handle('fahos:openContactChat', async (_event, name, message = '') => {
    if (message && message.trim()) {
      return systemActions.openWhatsAppChat(name, message);
    }
    const contact = contactsService.getPhoneForContact(name);
    if (contact && contact.phone) {
      const url = `whatsapp://send?phone=${contact.phone}`;
      console.log('[FahOS Main] Opening WhatsApp via native shell.openExternal:', url);
      await shell.openExternal(url);
      return { ok: true, command: url, description: `Opened WhatsApp chat with **${name}**.` };
    }
    return systemActions.openWhatsAppChat(name);
  });

  // Real-Time Audio Capture & Buffer Resolution Handler (Phase 4A)
  ipcMain.handle('fahos:transcribeAudio', async (_event, payload) => {
    try {
      let audioBuffer = null;
      let float32Fallback = null;

      function resolveBuffer(raw) {
        if (!raw) return null;
        if (Buffer.isBuffer(raw)) return raw;
        if (raw instanceof ArrayBuffer) return Buffer.from(raw);
        if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
        if (Array.isArray(raw)) return Buffer.from(raw);
        if (typeof raw === 'object') {
          if (raw.type === 'Buffer' && Array.isArray(raw.data)) {
            return Buffer.from(raw.data);
          }
          if (raw.buffer instanceof ArrayBuffer) {
            return Buffer.from(raw.buffer, raw.byteOffset || 0, raw.byteLength || raw.buffer.byteLength);
          }
          const len = raw.length || Object.keys(raw).filter(k => !isNaN(k)).length;
          if (len > 0) {
            const arr = new Uint8Array(len);
            for (let i = 0; i < len; i++) arr[i] = raw[i] || 0;
            return Buffer.from(arr);
          }
        }
        return null;
      }

      function resolveFloat32(raw) {
        if (!raw) return null;
        if (raw instanceof Float32Array) return raw;
        if (raw instanceof ArrayBuffer) return new Float32Array(raw);
        if (ArrayBuffer.isView(raw)) {
          const byteOffset = raw.byteOffset || 0;
          const byteLength = raw.byteLength || 0;
          if (byteOffset % 4 === 0) {
            return new Float32Array(raw.buffer, byteOffset, Math.floor(byteLength / 4));
          } else {
            const sliced = raw.buffer.slice(byteOffset, byteOffset + byteLength);
            return new Float32Array(sliced, 0, Math.floor(byteLength / 4));
          }
        }
        if (Array.isArray(raw)) return new Float32Array(raw);
        if (typeof raw === 'object') {
          const len = raw.length || Object.keys(raw).filter(k => !isNaN(k)).length;
          if (len > 0) {
            const arr = new Float32Array(len);
            for (let i = 0; i < len; i++) arr[i] = raw[i] || 0;
            return arr;
          }
        }
        return null;
      }

      if (payload && typeof payload === 'object' && (payload.wav !== undefined || payload.float32 !== undefined)) {
        audioBuffer = resolveBuffer(payload.wav);
        float32Fallback = resolveFloat32(payload.float32);
      } else {
        audioBuffer = resolveBuffer(payload);
      }

      if (!audioBuffer || audioBuffer.length < 100) {
        return { ok: false, error: 'Audio buffer empty or too small' };
      }
      console.log('[FahOS Whisper] Transcribing', audioBuffer.length, 'bytes of audio (WAV PCM)');
      return await whisperService.transcribeAudio(audioBuffer, float32Fallback);
    } catch (err) {
      console.error('[FahOS] transcribeAudio error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Native Speech-to-Text IPC Handlers
  ipcMain.handle('fahos:startSpeech', async () => {
    nativeStt.startListening({
      onText: (data) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('fahos:speechText', data);
        }
      },
      onError: (err) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('fahos:speechError', err);
        }
      }
    });
    return { ok: true };
  });

  ipcMain.handle('fahos:stopSpeech', async () => {
    nativeStt.stopListening();
    return { ok: true };
  });

  // Ephemeral Vision Image Analysis IPC Handler (Phase 5A)
  ipcMain.handle('fahos:analyzeAttachedImage', async (_event, payload) => {
    const gemKey = cfg.geminiApiKey || (cfg.providers && cfg.providers.gemini && cfg.providers.gemini.apiKey);
    if (!gemKey) {
      return { ok: false, error: 'Gemini API key is not configured in FahOS settings.' };
    }
    const imageBase64 = payload && payload.image;
    const userPrompt = (payload && payload.prompt) || '';
    if (!imageBase64) {
      return { ok: false, error: 'No image attached.' };
    }
    try {
      console.log('[FahOS Vision] Analyzing attached image with prompt:', userPrompt || '(default)');
      const analysis = await visualAgent.analyzeImageWithPrompt(imageBase64, userPrompt, gemKey);
      return { ok: true, output: analysis };
    } catch (err) {
      console.error('[FahOS Vision] Analysis error:', err);
      return { ok: false, error: err.message || String(err) };
    }
  });

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
  nativeStt.killWorker();
});
