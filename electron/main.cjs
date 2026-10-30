// Electron-skal: visar den byggda webbappen som en skrivbordsapplikation
// på Windows, macOS och Linux. All logik finns i webbappen (src/).
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

// I den installerade appen är utvecklarverktygen avstängda.
const isDev = !app.isPackaged;

function setMenu() {
  if (process.platform === 'darwin') {
    // macOS behöver en programmeny för Kopiera/Klistra in och Avsluta.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]),
    );
  } else if (!isDev) {
    Menu.setApplicationMenu(null);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'LinuxLearningTool',
    backgroundColor: '#14171c',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
    },
  });

  // Under utveckling kan man peka mot Vite-servern: VITE_DEV_SERVER_URL=http://localhost:5173
  const devUrl = isDev ? process.env.VITE_DEV_SERVER_URL : undefined;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Externa länkar öppnas i användarens vanliga webbläsare.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Appen ska aldrig navigera bort från sin egen sida.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
}

app.whenReady().then(() => {
  setMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
