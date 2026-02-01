@echo off
REM Change to script directory
cd /d "%~dp0"

echo ====================================
echo Clawdbot Desktop - Local Dev Restart
echo ====================================
echo.
echo This script will:
echo   1. Kill all Electron/Node processes
echo   2. Clean up ports (5173, 18789)
echo   3. Rebuild main process
echo   4. Rebuild preload script
echo   5. Start Vite + Electron dev server
echo.

REM Kill all related processes
echo [1/5] Killing existing processes...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM moltbot.exe 2>nul
echo Done.
echo.

REM Wait a bit for processes to fully terminate
timeout /t 2 /nobreak >nul

REM Clean up any stuck ports (5173 = Vite, 18789 = Gateway)
echo [2/5] Cleaning up ports...
echo Killing Vite dev server (port 5173)...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') DO (
    echo   Killing PID %%P
    taskkill /F /PID %%P 2>nul
)
echo Killing Gateway (port 18789)...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :18789 ^| findstr LISTENING') DO (
    echo   Killing PID %%P
    taskkill /F /PID %%P 2>nul
)
echo Done.
echo.

REM Extra wait for ports to release
echo [2.5/5] Waiting for ports to fully release...
timeout /t 3 /nobreak >nul
echo Done.
echo.

REM Clear Vite cache to ensure new files are detected
echo [2.7/5] Clearing Vite cache...
if exist "node_modules\.vite" (
    echo   Removing node_modules\.vite...
    rmdir /S /Q "node_modules\.vite" 2>nul
)
if exist ".vite" (
    echo   Removing .vite...
    rmdir /S /Q ".vite" 2>nul
)
echo Done.
echo.

REM Rebuild main process
echo [3/5] Rebuilding main process...
call pnpm run build:main
if %errorlevel% neq 0 (
    echo ERROR: Main build failed!
    pause
    exit /b 1
)
echo Done.
echo.

REM Rebuild preload
echo [4/5] Rebuilding preload...
call pnpm run build:preload
if %errorlevel% neq 0 (
    echo ERROR: Preload build failed!
    pause
    exit /b 1
)
echo Done.
echo.

REM Start dev server
echo [5/5] Starting dev server...
echo.
echo ====================================
echo   App should open in a few seconds
echo   Press Ctrl+C to stop
echo ====================================
echo.
call pnpm run dev
