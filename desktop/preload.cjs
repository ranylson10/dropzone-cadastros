const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dropzoneLive', {
  listLives: () => ipcRenderer.invoke('lives:list'),
  createLive: (input) => ipcRenderer.invoke('lives:create', input),
  saveLive: (live) => ipcRenderer.invoke('lives:save', live),
  deleteLive: (id) => ipcRenderer.invoke('lives:delete', id),
  syncLive: (id) => ipcRenderer.invoke('lives:sync', id),
  exportPng: (id) => ipcRenderer.invoke('lives:export-png', id),
  outputUrl: (id) => ipcRenderer.invoke('output:url', id),
  copy: (text) => ipcRenderer.invoke('system:copy', text),
  open: (url) => ipcRenderer.invoke('system:open', url),
})
