const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('codexNet', {
  version: () => ipcRenderer.invoke('app:version'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (value) => ipcRenderer.invoke('settings:save', value),
  discover: (secret) => ipcRenderer.invoke('clash:discover', secret),
  start: (settings) => ipcRenderer.invoke('scan:start', settings),
  onUpdate: (handler) => ipcRenderer.on('scan:update', (_, state) => handler(state)),
});
