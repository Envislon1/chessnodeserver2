
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
      nodeIntegration: false,
      contextIsolation: true,
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
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadURL(url.format({
      pathname: indexPath,
      protocol: 'file:',
      slashes: true
    }));
    
    // Log the path being loaded to help with debugging
    console.log('Loading from:', indexPath);
  }

  // Handle loading errors
  mainWindow.webContents.on('did-fail-load', () => {
    console.error('Failed to load application');
    // Show a message to the user
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head>
          <title>Error Loading Application</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h2 { color: #c00; }
            code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h2>Error Loading Application</h2>
          <p>The application could not be loaded. Possible reasons:</p>
          <ul>
            <li>The application has not been built. Try running <code>npm run build</code> first.</li>
            <li>The development server is not running. Try running <code>npm run dev</code>.</li>
            <li>There's an error in the application code.</li>
          </ul>
          <p>Check the console for more details.</p>
        </body>
      </html>
    `);
  });

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
