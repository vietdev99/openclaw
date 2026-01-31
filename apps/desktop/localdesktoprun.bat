@echo off
echo ====================================
echo Clawdbot Desktop - Local Dev Restart
echo ====================================
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

REM Clean up any stuck ports (5173-5185 + 18789)
echo [2/5] Cleaning up ports...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5173') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5174') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5175') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5176') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5177') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5178') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5179') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5180') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5181') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5182') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5183') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5184') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :5185') DO taskkill /F /PID %%P 2>nul
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :18789') DO taskkill /F /PID %%P 2>nul
echo Done.
echo.

REM Extra wait for ports to release
echo [2.5/5] Waiting for ports to fully release...
timeout /t 3 /nobreak >nul
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
