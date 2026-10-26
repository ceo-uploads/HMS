const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('hospital', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  chooseImage: category => ipcRenderer.invoke('asset:choose-image', category),
  storeImage: (sourcePath, category) => ipcRenderer.invoke('asset:store-image', sourcePath, category),
  getImagePath: file => webUtils.getPathForFile(file),
  savePdf: pageSize => ipcRenderer.invoke('document:save-pdf', pageSize),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  getUpdaterState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdaterState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  }
});