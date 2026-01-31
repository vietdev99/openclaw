// Test script to debug electron module resolution - alternative methods
console.log('=== ELECTRON DEBUG v2 ===');
console.log('process.versions.electron:', process.versions.electron);
console.log('process.type:', process.type);

// Try different ways to access electron
console.log('\n--- Method 1: Direct require ---');
try {
  const electron = require('electron');
  console.log('typeof electron:', typeof electron);
  console.log('Has app?:', !!electron.app);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n--- Method 2: Check Module._cache ---');
try {
  const Module = require('module');
  const electronCacheKey = Object.keys(Module._cache).find(k => k.includes('electron'));
  console.log('Electron cache key:', electronCacheKey);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n--- Method 3: Check require.resolve ---');
try {
  const resolved = require.resolve('electron');
  console.log('Resolved path:', resolved);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n--- Method 4: Process bindings ---');
console.log('Has process.electronBinding?:', typeof process.electronBinding);

// If running in electron main process
if (process.type === 'browser') {
  console.log('\n=== In Electron Main Process ===');
  const { app } = require('electron');
  if (app) {
    app.quit();
  }
} else {
  console.log('\nprocess.type is:', process.type);
  console.log('(Expected "browser" for main process)');
}

setTimeout(() => process.exit(0), 1000);
