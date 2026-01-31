// Test script to debug electron module resolution
const electron = require('electron');
console.log('=== ELECTRON DEBUG ===');
console.log('typeof electron:', typeof electron);
console.log('electron keys:', Object.keys(electron));
console.log('electron.app:', electron.app);
console.log('process.versions.electron:', process.versions.electron);

if (electron.app) {
  console.log('SUCCESS: electron.app is defined');
  electron.app.whenReady().then(() => {
    console.log('App is ready!');
    electron.app.quit();
  });
} else {
  console.log('FAILURE: electron.app is undefined');
  console.log('Full electron object:', electron);
  process.exit(1);
}
