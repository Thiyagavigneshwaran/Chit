const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

function startBackend() {
  const backendPath = path.join(__dirname, 'chit-fund-app', 'backend', 'server.js');
  const cwd = path.join(__dirname, 'chit-fund-app', 'backend');
  const backendCommand = app.isPackaged ? process.execPath : 'node';
  const backendEnv = { ...process.env, PORT: '5000' };

  // A packaged Electron app already includes a Node.js runtime. Use it so the
  // client does not need a separate system-wide Node.js installation.
  if (app.isPackaged) {
    backendEnv.ELECTRON_RUN_AS_NODE = '1';
  }

  console.log(`Starting Express backend server: ${backendPath}`);
  
  backendProcess = spawn(backendCommand, [backendPath], {
    cwd: cwd,
    env: backendEnv
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'logo.ico') // Peacock icon
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    // Dev mode: load hot reloading Vite frontend server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Production mode: load static built frontend assets
    mainWindow.loadFile(path.join(__dirname, 'chit-fund-app', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

// Terminate Express server when the Electron window is closed
app.on('window-all-closed', () => {
  if (backendProcess) {
    console.log('Terminating Express backend server...');
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
