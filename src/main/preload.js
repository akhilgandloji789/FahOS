'use strict';
// The ONLY bridge between the web page (renderer) and Node/main. contextIsolation is on,
// nodeIntegration is off, so the renderer cannot touch the filesystem, env vars or API keys.
// It can only call the small, explicit surface we expose here.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fahos', {
  // Ask the AI router to run an action ("explain" | "summarize" | ... | "ask")
  runAction: (payload) => ipcRenderer.invoke('fahos:runAction', payload),
  // Which provider / shortcut are active (for the UI badge)
  getInfo: () => ipcRenderer.invoke('fahos:getInfo'),
  // Dismiss the overlay
  hide: () => ipcRenderer.send('fahos:hide'),
  // Smooth Window Dragging
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('fahos:moveWindow', { deltaX, deltaY }),
  // Main tells the renderer to focus its input each time the overlay is summoned
  onFocusInput: (cb) => ipcRenderer.on('fahos:focusInput', () => cb()),
  // Main tells the renderer that it appeared (to trigger top slide-down animation)
  onAppear: (cb) => ipcRenderer.on('fahos:appear', () => cb()),
  // Main tells renderer to play smooth twinkle exit before hiding
  onPrepareHide: (cb) => ipcRenderer.on('fahos:prepareHide', () => cb()),
  // Local-First Persistent History
  getHistory: () => ipcRenderer.invoke('fahos:getHistory'),
  addHistory: (item) => ipcRenderer.invoke('fahos:addHistory', item),
  clearHistory: () => ipcRenderer.invoke('fahos:clearHistory'),
  setHeight: (h) => ipcRenderer.invoke('fahos:setHeight', h),
  // Local-First Phonebook (Contacts)
  getContacts: () => ipcRenderer.invoke('fahos:getContacts'),
  saveContact: (payload) => ipcRenderer.invoke('fahos:saveContact', payload),
  deleteContact: (name) => ipcRenderer.invoke('fahos:deleteContact', name),
  openContactChat: (name, message) => ipcRenderer.invoke('fahos:openContactChat', name, message),
  composeEmail: (payload) => ipcRenderer.invoke('fahos:composeEmail', payload),
  // Local Built-in Whisper Transcription
  transcribeAudio: (samples) => ipcRenderer.invoke('fahos:transcribeAudio', samples),
  // Screen Snipper & Multimodal AI Vision
  startSnipper: () => ipcRenderer.invoke('fahos:startSnipper'),
  onImageSnipped: (cb) => ipcRenderer.on('fahos:imageSnipped', (_e, data) => cb(data)),
  analyzeAttachedImage: (payload) => ipcRenderer.invoke('fahos:analyzeAttachedImage', payload),
  // Autonomous Browser Control & Window
  openBrowserWindow: (url) => ipcRenderer.invoke('fahos:openBrowserWindow', url),
  runBrowserTask: (payload) => ipcRenderer.invoke('fahos:browserTask', payload),
  cancelBrowserTask: () => ipcRenderer.invoke('fahos:cancelBrowserTask'),
  // AI Model Orchestrator
  orchestrate: (payload) => ipcRenderer.invoke('fahos:orchestrate', payload),
  getTierInfo: (tier) => ipcRenderer.invoke('fahos:getTierInfo', tier),
  // Legacy stubs
  toggleVoiceTyping: () => ipcRenderer.invoke('fahos:toggleVoiceTyping'),
  startSpeech: () => ipcRenderer.invoke('fahos:startSpeech'),
  stopSpeech: () => ipcRenderer.invoke('fahos:stopSpeech'),
  onSpeechText: (cb) => ipcRenderer.on('fahos:speechText', (_e, data) => cb(data)),
  onSpeechError: (cb) => ipcRenderer.on('fahos:speechError', (_e, err) => cb(err))
});


