#Requires -Version 5.1
<#
.SYNOPSIS
    OpenClaw One-Line Installer for Windows

.DESCRIPTION
    Install OpenClaw with a single command:
    iwr -useb https://vietdev99.github.io/openclaw/install.ps1 | iex

.PARAMETER InstallDir
    Installation directory (default: ~/Code/openclaw)

.PARAMETER Branch
    Git branch to clone (default: main)

.PARAMETER SkipModel
    Skip Whisper model download

.PARAMETER SkipGlobal
    Skip global npm install
#>

param(
    [string]$InstallDir = "$env:USERPROFILE\Code\openclaw",
    [string]$Branch = "main",
    [switch]$SkipModel,
    [switch]$SkipGlobal
)

$ErrorActionPreference = "Stop"

# GitHub repo URLs
$CLAWDBOT_REPO = "https://github.com/vietdev99/openclaw.git"
$PIMONO_REPO = "https://github.com/anthropics/claude-code.git"

# Colors
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[X] $msg" -ForegroundColor Red }

Write-Host @"

   ___                    ____ _
  / _ \ _ __   ___ _ __  / ___| | __ ___      __
 | | | | '_ \ / _ \ '_ \| |   | |/ _` \ \ /\ / /
 | |_| | |_) |  __/ | | | |___| | (_| |\ V  V /
  \___/| .__/ \___|_| |_|\____|_|\__,_| \_/\_/
       |_|

       One-Line Installer for Windows

"@ -ForegroundColor Magenta

# ============================================
# Prerequisites
# ============================================
Write-Step "Checking prerequisites..."

# Node.js
Write-Host "  Checking Node.js..." -NoNewline
try {
    $nodeVer = (node --version 2>$null) -replace 'v',''
    if ([version]$nodeVer -ge [version]"22.12.0") {
        Write-Host " v$nodeVer" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Err "Node.js $nodeVer is too old. Need >= 22.12.0"
        Write-Host "  Install: https://nodejs.org/" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host ""
    Write-Err "Node.js not found"
    Write-Host "  Install: https://nodejs.org/" -ForegroundColor Gray
    exit 1
}

# pnpm
Write-Host "  Checking pnpm..." -NoNewline
try {
    $pnpmVer = pnpm --version 2>$null
    Write-Host " v$pnpmVer" -ForegroundColor Green
} catch {
    Write-Host " installing..." -ForegroundColor Yellow
    npm install -g pnpm@10.23.0 | Out-Null
    Write-OK "pnpm installed"
}

# Git
Write-Host "  Checking Git..." -NoNewline
try {
    $gitVer = (git --version 2>$null) -replace 'git version ',''
    Write-Host " v$gitVer" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Err "Git not found"
    Write-Host "  Install: https://git-scm.com/" -ForegroundColor Gray
    exit 1
}

# FFmpeg
Write-Host "  Checking FFmpeg..." -NoNewline
try {
    ffmpeg -version 2>$null | Out-Null
    Write-Host " found" -ForegroundColor Green
} catch {
    Write-Host " installing via winget..." -ForegroundColor Yellow
    try {
        winget install FFmpeg.FFmpeg --accept-source-agreements --accept-package-agreements 2>$null | Out-Null
        Write-OK "FFmpeg installed"
    } catch {
        Write-Warn "Could not install FFmpeg. Install manually: winget install FFmpeg.FFmpeg"
    }
}

# ============================================
# Clone repositories
# ============================================
$parentDir = Split-Path -Parent $InstallDir

if (-not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}

# Clone clawdbot
Write-Step "Cloning OpenClaw..."
if (Test-Path $InstallDir) {
    Write-Warn "Directory exists: $InstallDir"
    $response = Read-Host "  Remove and re-clone? [y/N]"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Remove-Item -Recurse -Force $InstallDir
    } else {
        Write-Host "  Using existing directory"
    }
}

if (-not (Test-Path $InstallDir)) {
    git clone --branch $Branch $CLAWDBOT_REPO $InstallDir
    Write-OK "Cloned to: $InstallDir"
}

# Clone pi-mono (sibling directory)
$piMonoDir = Join-Path $parentDir "pi-mono"
Write-Step "Cloning pi-mono..."
if (-not (Test-Path $piMonoDir)) {
    git clone --branch main $PIMONO_REPO $piMonoDir
    Write-OK "Cloned to: $piMonoDir"
} else {
    Write-OK "Already exists: $piMonoDir"
}

# ============================================
# Apply pi-ai fix
# ============================================
Write-Step "Applying Claude Code compatibility fix..."

$validationSrc = Join-Path $InstallDir "scripts\patches\pi-ai-validation.patch.ts"
$validationDst = Join-Path $piMonoDir "packages\ai\src\utils\validation.ts"

if (Test-Path $validationSrc) {
    Copy-Item -Path $validationSrc -Destination $validationDst -Force
    Write-OK "Patched: validation.ts"

    # Build pi-ai
    Push-Location (Join-Path $piMonoDir "packages\ai")
    pnpm install 2>$null | Out-Null
    pnpm build 2>$null | Out-Null
    Pop-Location
    Write-OK "Built pi-ai"
} else {
    Write-Warn "Patch file not found, skipping"
}

# ============================================
# Build project
# ============================================
Write-Step "Installing dependencies..."
Push-Location $InstallDir
pnpm install
Write-OK "Dependencies installed"

Write-Step "Building project..."
pnpm build
Write-OK "Build complete"
Pop-Location

# ============================================
# Download Whisper model
# ============================================
if (-not $SkipModel) {
    Write-Step "Downloading Whisper model (Vietnamese speech-to-text)..."

    $modelScript = Join-Path $InstallDir "extended\packages\whisper\models\download-model.ps1"
    if (Test-Path $modelScript) {
        & $modelScript -Model "base"
        Write-OK "Model downloaded"
    } else {
        Write-Warn "Model download script not found"
    }
}

# ============================================
# Setup config
# ============================================
Write-Step "Setting up configuration..."

$openclawDir = "$env:USERPROFILE\.openclaw"
$configPath = Join-Path $openclawDir "openclaw.json"
$whisperScript = Join-Path $InstallDir "extended\packages\whisper\transcribe_audio.ps1"

if (-not (Test-Path $openclawDir)) {
    New-Item -ItemType Directory -Path $openclawDir -Force | Out-Null
}

if (-not (Test-Path $configPath)) {
    @{
        gateway = @{
            port = 18789
            mode = "local"
            bind = "loopback"
            auth = @{ mode = "token"; token = "" }
        }
        audio = @{
            transcription = @{
                command = @(
                    "powershell.exe", "-ExecutionPolicy", "Bypass", "-File",
                    $whisperScript, "-InputAudioPath", "`${input}"
                )
            }
        }
    } | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
    Write-OK "Config created: $configPath"
} else {
    Write-OK "Config exists: $configPath"
}

# ============================================
# Global install
# ============================================
if (-not $SkipGlobal) {
    Write-Step "Installing global CLI..."
    Push-Location $InstallDir
    npm install -g ./ 2>$null | Out-Null
    Pop-Location

    try {
        $ver = openclaw --version 2>$null
        Write-OK "Installed: openclaw $ver"
    } catch {
        Write-Warn "Global install may have failed. Use: pnpm --dir $InstallDir openclaw"
    }
}

# ============================================
# Done!
# ============================================
Write-Host @"

============================================
        Installation Complete!
============================================

Installation: $InstallDir
Config:       $configPath

Next steps:
  1. Add your API key to config:
     notepad $configPath

  2. Start the gateway:
     openclaw gateway

  3. Run diagnostics:
     openclaw doctor

============================================

"@ -ForegroundColor Green
