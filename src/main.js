const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { discover } = require('./clash-client');
const { scan } = require('./scanner');

let mainWindow;
let running = false;
const defaults = {
  groupName: 'ChatGPT', apiUrl: 'https://chatgpt.com/backend-api/', wsUrl: 'https://ws.chatgpt.com/',
  rounds: 6, timeoutMs: 5000, parallelism: 16, minimumSuccessRate: 1,
  maximumP90Ms: 2500, autoSwitch: true, verificationRounds: 2, actualTimeoutMs: 6500,
  secret: '', proxyPort: 7897,
};

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function loadSettings() { try { return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; } catch { return { ...defaults }; } }
function saveSettings(value) { const merged = { ...defaults, ...value }; fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2)); return merged; }

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1320, height: 860, minWidth: 980, minHeight: 680, show: false, backgroundColor: '#080b12', title: `Codex 网络稳定选择器 ${app.getVersion()}`, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:save', (_, value) => saveSettings(value));
  ipcMain.handle('clash:discover', async (_, secret = '') => { const endpoint = await discover(secret); return { label: endpoint.label, version: endpoint.version }; });
  ipcMain.handle('scan:start', async (_, input) => {
    if (running) throw new Error('检测正在进行中');
    running = true;
    const settings = saveSettings(input);
    try {
      const endpoint = await discover(settings.secret);
      return await scan(endpoint, settings, (state) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('scan:update', { ...state, endpoint: endpoint.label }); });
    } finally { running = false; }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
