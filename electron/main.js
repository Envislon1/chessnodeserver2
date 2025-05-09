const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const isDev = process.env.NODE_ENV === 'development';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "PVTCloud",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // Load the app
  if (isDev) {
    // In development, load from the dev server
    mainWindow.loadURL('http://localhost:8080');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, '../dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS applications keep their menu bar active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create a window when dock icon is clicked and no other windows open
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle IPC messages between the renderer and main processes
ipcMain.on('app-message', (event, arg) => {
  console.log('Received message from renderer:', arg);
  event.reply('app-reply', 'Message received!');
});
