const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dropzoneLive', {
  session: () => ipcRenderer.invoke('auth:session'),
  login: (input) => ipcRenderer.invoke('auth:login', input),
  logout: () => ipcRenderer.invoke('auth:logout'),
  championships: () => ipcRenderer.invoke('auth:championships'),
  listLives: () => ipcRenderer.invoke('lives:list'),
  createLive: (input) => ipcRenderer.invoke('lives:create', input),
  saveLive: (live) => ipcRenderer.invoke('lives:save', live),
  deleteLive: (id) => ipcRenderer.invoke('lives:delete', id),
  syncLive: (id) => ipcRenderer.invoke('lives:sync', id),
  importImage: () => ipcRenderer.invoke('assets:import-image'),
  exportPng: (id) => ipcRenderer.invoke('lives:export-png', id),
  outputUrl: (id) => ipcRenderer.invoke('output:url', id),
  copy: (text) => ipcRenderer.invoke('system:copy', text),
  open: (url) => ipcRenderer.invoke('system:open', url),
})
