const fs = require('fs');
const path = require('path');

// Write to a file to confirm we ran
const logFile = path.join(__dirname, 'test-output.txt');
fs.writeFileSync(logFile, `Test started at ${new Date().toISOString()}\n`);

try {
  const { app, BrowserWindow } = require('electron');
  fs.appendFileSync(logFile, `process.type: ${process.type}\n`);
  fs.appendFileSync(logFile, `app defined: ${!!app}\n`);

  if (!app) {
    fs.appendFileSync(logFile, 'FAIL: app is undefined\n');
    process.exit(1);
  }

  fs.appendFileSync(logFile, 'Waiting for app ready...\n');

  app.whenReady().then(() => {
    fs.appendFileSync(logFile, 'SUCCESS: App is ready!\n');

    const win = new BrowserWindow({ width: 400, height: 300 });
    win.loadURL('data:text/html,<h1>Hello Electron!</h1>');

    fs.appendFileSync(logFile, 'Window created!\n');

    // Auto-close after 2 seconds for testing
    setTimeout(() => {
      fs.appendFileSync(logFile, 'Closing app...\n');
      app.quit();
    }, 2000);
  });

  app.on('window-all-closed', () => app.quit());
} catch (e) {
  fs.appendFileSync(logFile, `ERROR: ${e.message}\n`);
  process.exit(1);
}
