/**
 * Quantum Hub Desktop App
 * Electron Main Process
 *
 * Creates the main application window and loads the web dashboard.
 * Provides native OS integration: system tray, notifications, and IPC.
 */

'use strict';

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain } = require('electron');
const path = require('path');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0a0a1a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Quantum Hub',
  });

  // Load the web dashboard
  mainWindow.loadURL(DASHBOARD_URL).catch(() => {
    // Fallback to local HTML if dashboard server is not running
    mainWindow.loadFile(path.join(__dirname, 'fallback.html'));
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  // Tray icon would be loaded from assets in production
  tray = new Tray(path.join(__dirname, '../assets/tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Quantum Hub', click: () => mainWindow?.show() },
    { label: 'System Health', click: checkHealth },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Quantum Hub');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

async function checkHealth() {
  try {
    const http = require('http');
    const req = http.get(`${GATEWAY_URL}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const health = JSON.parse(data);
        new Notification({
          title: 'Quantum Hub Health',
          body: `Status: ${health.orchestrator?.status} | Queue: ${health.orchestrator?.queueLength} | Coherence: ${(health.telemetry?.coherenceLevel * 100).toFixed(1)}%`,
        }).show();
      });
    });
    req.on('error', () => {
      new Notification({ title: 'Quantum Hub', body: 'Gateway unreachable' }).show();
    });
  } catch (e) {
    console.error('Health check failed:', e.message);
  }
}

// IPC handlers
ipcMain.handle('get-gateway-url', () => GATEWAY_URL);
ipcMain.handle('get-version', () => app.getVersion());

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  // createTray(); // Uncomment when tray icon assets are available
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
