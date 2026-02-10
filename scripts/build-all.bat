@echo off
setlocal enabledelayedexpansion
title OpenClaw - Full Build & Install

echo ============================================
echo   OpenClaw Full Build ^& Install
echo ============================================
echo.

cd /d "%~dp0.."

:: Step 1: Kill existing gateway
echo [1/6] Killing existing gateway on port 18789...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :18789 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    echo   Killed PID %%a
)
echo   Done.
echo.

:: Step 2: Git pull
echo [2/6] Pulling latest code...
git pull origin main
if errorlevel 1 (
    echo   ERROR: git pull failed. Resolve conflicts first.
    exit /b 1
)
git submodule update --init --recursive
echo   Done.
echo.

:: Step 3: Install dependencies
echo [3/6] Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo   ERROR: pnpm install failed.
    exit /b 1
)
echo   Done.
echo.

:: Step 4: Build core
echo [4/6] Building core...
call npm run build
if errorlevel 1 (
    echo   ERROR: Core build failed.
    exit /b 1
)
echo   Done.
echo.

:: Step 5: Build UI v2
echo [5/6] Building UI v2...
cd ui-v2
call pnpm run build
if errorlevel 1 (
    echo   WARNING: UI v2 build failed. Restoring pre-built assets...
    cd ..
    git checkout -- dist/control-ui/
) else (
    cd ..
)
echo   Done.
echo.

:: Step 6: Install CLI globally
echo [6/6] Installing CLI...
call npm link >nul 2>&1
echo   Done.
echo.

echo ============================================
echo   Build Complete!
echo ============================================
echo.
echo   Start gateway:  openclaw gateway
echo   UI:             http://localhost:18789
echo.
