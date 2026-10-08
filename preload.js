const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ss', {
  getShips: () => ipcRenderer.invoke('ships:snap'),
  setShipBox: (box) => ipcRenderer.invoke('ships:setbox', box),
  setPin: (mode) => ipcRenderer.invoke('widget:pin', mode),
  close: () => ipcRenderer.invoke('widget:close'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (p) => ipcRenderer.invoke('config:set', p),
  open: (u) => ipcRenderer.invoke('open:external', u),
});