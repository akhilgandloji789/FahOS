const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fahosAgent', {
  onTaskInit: (callback) => ipcRenderer.on('agent:init', (_, data) => callback(data)),
  onStepUpdate: (callback) => ipcRenderer.on('agent:step-update', (_, data) => callback(data)),
  onResultUpdate: (callback) => ipcRenderer.on('agent:result-update', (_, data) => callback(data)),
  stopTask: () => ipcRenderer.send('agent:stop'),
  closeWindow: () => ipcRenderer.send('agent:close')
});
