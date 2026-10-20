const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let dataFile;
let assetsDirectory;
const updateState = {
  appVersion: app.getVersion(),
  supported: false,
  status: 'starting',
  currentVersion: app.getVersion(),
  availableVersion: null,
  percent: 0,
  transferred: 0,
  total: 0,
  error: null,
  logs: []
};

function publishUpdateState(message, status, details = {}) {
  Object.assign(updateState, details);
  if (status) updateState.status = status;
  if (message) {
    updateState.logs.push({ time: new Date().toISOString(), message, level: updateState.status === 'error' ? 'error' : 'info' });
    updateState.logs = updateState.logs.slice(-80);
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:state', { ...updateState, logs: [...updateState.logs] });
}

function configureAutoUpdater() {
  updateState.supported = app.isPackaged;
  updateState.status = app.isPackaged ? 'idle' : 'unsupported';
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  publishUpdateState(app.isPackaged ? `Updater ready for version ${app.getVersion()}.` : 'Updater is available in the installed release.', updateState.status);

  autoUpdater.on('checking-for-update', () => publishUpdateState('Checking GitHub Releases for a newer version.', 'checking', { error: null, availableVersion: null, percent: 0 }));
  autoUpdater.on('update-available', info => publishUpdateState(`Version ${info.version} is available to download.`, 'available', { availableVersion: info.version, releaseName: info.releaseName || '', releaseDate: info.releaseDate || null, releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '', error: null }));
  autoUpdater.on('update-not-available', info => publishUpdateState(`You are up to date. Latest version is ${info.version}.`, 'not-available', { availableVersion: null, latestVersion: info.version, error: null }));
  autoUpdater.on('download-progress', progress => publishUpdateState(`Downloading update: ${Math.round(progress.percent)}% (${progress.transferred} of ${progress.total} bytes).`, 'downloading', { percent: progress.percent, transferred: progress.transferred, total: progress.total }));
  autoUpdater.on('update-downloaded', info => publishUpdateState(`Version ${info.version} is ready to install. Restart to apply it.`, 'downloaded', { availableVersion: info.version, percent: 100, error: null }));
  autoUpdater.on('error', error => publishUpdateState(`Update error: ${error.message}`, 'error', { error: error.message }));
}

function initialData() {
  return {
    users: [{ username: 'admin', password: 'admin123', name: 'Administrator' }],
    tests: [
      { id: 'T-001', code: 'CBC', name: 'Complete Blood Count', price: 600 },
      { id: 'T-002', code: 'BS-01', name: 'Blood Sugar (Fasting)', price: 250 },
      { id: 'T-003', code: 'LFT', name: 'Liver Function Test', price: 1400 },
      { id: 'T-004', code: 'LIPID', name: 'Lipid Profile', price: 1100 },
      { id: 'T-005', code: 'TSH', name: 'Thyroid Stimulating Hormone', price: 850 }
    ],
    doctors: [
      { id: 'D-001', name: 'Dr. Amina Rahman', title: 'MBBS, FCPS', specialty: 'Internal Medicine', contact: '01700000001', visits: '09:00 - 13:00', newPrice: 800, oldPrice: 500, photo: '' },
      { id: 'D-002', name: 'Dr. Farhan Ahmed', title: 'MBBS, MS', specialty: 'Cardiology', contact: '01700000002', visits: '16:00 - 20:00', newPrice: 1000, oldPrice: 700, photo: '' }
    ],
    agents: [{ id: 'A-001', name: 'Community Health Desk', contact: '01700000003' }],
    referrers: [{ id: 'R-001', agentId: 'A-001', name: 'Nusrat Jahan', contact: '01700000004' }],
    cabins: [
      { id: 'C-01', name: 'Cabin 01', price: 2500 }, { id: 'C-02', name: 'Cabin 02', price: 2500 },
      { id: 'C-03', name: 'Cabin 03', price: 3000 }, { id: 'C-04', name: 'Cabin 04', price: 3000 },
      { id: 'C-05', name: 'Cabin 05', price: 3500 }, { id: 'C-06', name: 'Cabin 06', price: 3500 }
    ],
    labOrders: [], appointments: [], bookings: []
  };
}

async function loadData() {
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const data = initialData();
    await saveData(data);
    return data;
  }
}

async function saveData(data) {
  const temporary = `${dataFile}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(temporary, dataFile);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 760,
    minHeight: 620,
    frame: false,
    backgroundColor: '#f5f7f6',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'UI', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.on('context-menu', event => event.preventDefault());
}

app.whenReady().then(async () => {
	app.setPath('userData', path.join(app.getPath('appData'), 'hmss-desktop'));
  dataFile = path.join(app.getPath('userData'), 'hospital-data.json');
  assetsDirectory = path.join(app.getPath('userData'), 'assets');
  await fs.mkdir(assetsDirectory, { recursive: true });

  ipcMain.handle('data:load', loadData);
  ipcMain.handle('data:save', (_event, data) => saveData(data));
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:toggle-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('updates:get-state', () => ({ ...updateState, appVersion: app.getVersion(), supported: app.isPackaged, logs: [...updateState.logs] }));
  ipcMain.handle('updates:check', async () => {
    if (!app.isPackaged) {
      publishUpdateState('Update checks are available in the installed release, not development mode.', 'unsupported');
      return { ...updateState, logs: [...updateState.logs] };
    }
    if (['checking', 'downloading'].includes(updateState.status)) return { ...updateState, logs: [...updateState.logs] };
    publishUpdateState('Starting update check.', 'checking', { error: null });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      publishUpdateState(`Update check failed: ${error.message}`, 'error', { error: error.message });
    }
    return { ...updateState, logs: [...updateState.logs] };
  });
  ipcMain.handle('updates:download', async () => {
    if (!app.isPackaged || updateState.status !== 'available') throw new Error('No downloadable update is available.');
    publishUpdateState(`Starting download for version ${updateState.availableVersion}.`, 'downloading', { percent: 0, transferred: 0, total: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      publishUpdateState(`Update download failed: ${error.message}`, 'error', { error: error.message });
      throw error;
    }
    return true;
  });
  ipcMain.handle('updates:install', () => {
    if (!app.isPackaged || updateState.status !== 'downloaded') throw new Error('The update has not finished downloading.');
    publishUpdateState('Restarting to install the update.', 'installing');
    autoUpdater.quitAndInstall(false, true);
  });
  ipcMain.handle('asset:choose-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const extension = path.extname(result.filePaths[0]).toLowerCase();
    const storedName = `${crypto.randomUUID()}${extension}`;
    const destination = path.join(assetsDirectory, storedName);
    await fs.copyFile(result.filePaths[0], destination);
    return pathToFileURL(destination).href;
  });

  configureAutoUpdater();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});