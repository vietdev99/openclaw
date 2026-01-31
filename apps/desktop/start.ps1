# Clawdbot Desktop Launcher Script
# This script ensures Electron runs as a GUI app, not Node.js mode

# Remove the environment variable that causes Electron to run as Node.js
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Run Electron
& "$scriptDir\node_modules\electron\dist\electron.exe" "$scriptDir"
