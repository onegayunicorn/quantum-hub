/**
 * Electron Preload Script
 * Exposes safe IPC bridge to the renderer process.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quantumHub', {
  getGatewayUrl: () => ipcRenderer.invoke('get-gateway-url'),
  getVersion: () => ipcRenderer.invoke('get-version'),
});
