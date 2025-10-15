// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  runJob: (folderpath) => ipcRenderer.invoke('run-job', folderpath),
});
