#!/usr/bin/env node
/**
 * Helper script to run Electron with proper environment.
 * This ensures ELECTRON_RUN_AS_NODE is not set, which would cause
 * Electron to run in Node.js mode instead of browser mode.
 */
const { spawn } = require('child_process');
const path = require('path');

// Get electron path
const electronPath = require('electron');

// Build the environment - explicitly delete ELECTRON_RUN_AS_NODE
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Get the app path (parent directory of this script)
const appPath = path.join(__dirname, '..');

console.log('Starting Electron...');
console.log('Electron path:', electronPath);
console.log('App path:', appPath);

// Spawn electron with the app directory
const child = spawn(electronPath, [appPath], {
  stdio: 'inherit',
  env: env,
  windowsHide: false
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code || 0);
});
