const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hospital', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  chooseImage: () => ipcRenderer.invoke('asset:choose-image'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close')
});