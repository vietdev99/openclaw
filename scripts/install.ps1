#Requires -Version 5.1
<#
.SYNOPSIS
    OpenClaw Installation Script for Windows

.DESCRIPTION
    This script installs OpenClaw (clawdbot) on a Windows machine, including:
    - Prerequisites check (Node.js, pnpm, Git, FFmpeg)
    - Project build
    - Whisper model download for Vietnamese speech-to-text
    - pi-ai validation fix for Claude Code compatibility
    - Default workspace configuration

.PARAMETER SkipPrerequisites
    Skip prerequisites check

.PARAMETER SkipBuild
    Skip project build

.PARAMETER SkipModel
    Skip Whisper model download

.PARAMETER Force
    Force reinstall even if already installed

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Force
    .\install.ps1 -SkipPrerequisites -SkipModel
#>

param(
    [switch]$SkipPrerequisites,
    [switch]$SkipBuild,
    [switch]$SkipModel,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step { param($msg) Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor White }

# Get script and project directories
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$piMonoDir = Join-Path (Split-Path -Parent $projectDir) "pi-mono"
$homeDir = $env:USERPROFILE
$openclawDir = Join-Path $homeDir ".openclaw"

Write-Host @"
===============================================
     OpenClaw Installation Script
===============================================
Project: $projectDir
pi-mono: $piMonoDir
Config:  $openclawDir
===============================================
"@ -ForegroundColor Magenta

# ============================================
# STEP 1: Check Prerequisites
# ============================================
if (-not $SkipPrerequisites) {
    Write-Step "Checking prerequisites..."

    # Check Node.js
    Write-Info "Checking Node.js..."
    try {
        $nodeVersion = (node --version 2>$null)
        if ($nodeVersion) {
            $version = [version]($nodeVersion -replace 'v', '')
            if ($version -ge [version]"22.12.0") {
                Write-Success "Node.js $nodeVersion (>= 22.12.0 required)"
            }
            else {
                Write-Error "Node.js $nodeVersion is too old. Please install Node.js >= 22.12.0"
                Write-Info "Download from: https://nodejs.org/"
                exit 1
            }
        }
    }
    catch {
        Write-Error "Node.js not found. Please install Node.js >= 22.12.0"
        Write-Info "Download from: https://nodejs.org/"
        exit 1
    }

    # Check/Install pnpm
    Write-Info "Checking pnpm..."
    try {
        $pnpmVersion = (pnpm --version 2>$null)
        if ($pnpmVersion) {
            Write-Success "pnpm $pnpmVersion"
        }
    }
    catch {
        Write-Warning "pnpm not found. Installing..."
        npm install -g pnpm@10.23.0
        Write-Success "pnpm installed"
    }

    # Check Git
    Write-Info "Checking Git..."
    try {
        $gitVersion = (git --version 2>$null)
        if ($gitVersion) {
            Write-Success "$gitVersion"
        }
    }
    catch {
        Write-Error "Git not found. Please install Git."
        Write-Info "Download from: https://git-scm.com/"
        exit 1
    }

    # Check FFmpeg
    Write-Info "Checking FFmpeg..."
    try {
        $ffmpegVersion = (ffmpeg -version 2>$null | Select-Object -First 1)
        if ($ffmpegVersion) {
            Write-Success "FFmpeg found"
        }
    }
    catch {
        Write-Warning "FFmpeg not found. Attempting to install via winget..."
        try {
            winget install FFmpeg.FFmpeg --accept-source-agreements --accept-package-agreements
            Write-Success "FFmpeg installed via winget"
        }
        catch {
            Write-Warning "Could not install FFmpeg automatically."
            Write-Info "Please install FFmpeg manually:"
            Write-Info "  winget install FFmpeg.FFmpeg"
            Write-Info "  OR download from: https://ffmpeg.org/download.html"
        }
    }
}

# ============================================
# STEP 2: Check pi-mono exists
# ============================================
Write-Step "Checking pi-mono package..."

if (-not (Test-Path $piMonoDir)) {
    Write-Warning "pi-mono not found at: $piMonoDir"
    Write-Info "Cloning pi-mono from GitHub..."

    $parentDir = Split-Path -Parent $projectDir
    Push-Location $parentDir
    try {
        # You may need to update this URL to your fork
        git clone https://github.com/anthropics/claude-code.git pi-mono 2>$null
        if (-not $?) {
            Write-Error "Failed to clone pi-mono. Please clone it manually to: $piMonoDir"
            exit 1
        }
        Write-Success "pi-mono cloned"
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Success "pi-mono found at: $piMonoDir"
}

# ============================================
# STEP 3: Apply pi-ai validation fix
# ============================================
Write-Step "Applying pi-ai validation fix (Claude Code compatibility)..."

$validationFile = Join-Path $piMonoDir "packages\ai\src\utils\validation.ts"

if (Test-Path $validationFile) {
    $content = Get-Content $validationFile -Raw

    if ($content -match "normalizeClaudeCodeParams") {
        Write-Success "Fix already applied"
    }
    else {
        Write-Info "Patching validation.ts..."

        # Read the patch content
        $patchFile = Join-Path $scriptDir "patches\pi-ai-validation.patch.ts"

        if (Test-Path $patchFile) {
            $patchContent = Get-Content $patchFile -Raw
            # Apply patch logic here - for now just warn
            Write-Warning "Please apply the patch manually or run:"
            Write-Info "  Copy content from: $patchFile"
            Write-Info "  To: $validationFile"
        }
        else {
            Write-Warning "Patch file not found. The fix needs to be applied manually."
            Write-Info "Add normalizeClaudeCodeParams function to: $validationFile"
        }
    }

    # Build pi-ai
    Write-Info "Building pi-ai..."
    Push-Location (Join-Path $piMonoDir "packages\ai")
    try {
        pnpm install 2>$null
        pnpm build 2>$null
        Write-Success "pi-ai built"
    }
    catch {
        Write-Warning "Could not build pi-ai: $($_.Exception.Message)"
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Warning "validation.ts not found at: $validationFile"
}

# ============================================
# STEP 4: Install dependencies and build
# ============================================
if (-not $SkipBuild) {
    Write-Step "Installing dependencies..."

    Push-Location $projectDir
    try {
        pnpm install
        Write-Success "Dependencies installed"

        Write-Step "Building project..."
        pnpm build
        Write-Success "Project built"
    }
    catch {
        Write-Error "Build failed: $($_.Exception.Message)"
        exit 1
    }
    finally {
        Pop-Location
    }
}

# ============================================
# STEP 5: Download Whisper model
# ============================================
if (-not $SkipModel) {
    Write-Step "Downloading Whisper model for Vietnamese speech-to-text..."

    $whisperDir = Join-Path $projectDir "extended\packages\whisper"
    $modelScript = Join-Path $whisperDir "models\download-model.ps1"
    $modelPath = Join-Path $whisperDir "models\ggml-base.bin"

    if ((Test-Path $modelPath) -and (-not $Force)) {
        Write-Success "Whisper model already exists"
    }
    else {
        if (Test-Path $modelScript) {
            & $modelScript -Model "base"
            Write-Success "Whisper model downloaded"
        }
        else {
            Write-Warning "Download script not found: $modelScript"
        }
    }
}

# ============================================
# STEP 6: Setup workspace configuration
# ============================================
Write-Step "Setting up workspace configuration..."

# Create .openclaw directory
if (-not (Test-Path $openclawDir)) {
    New-Item -ItemType Directory -Path $openclawDir -Force | Out-Null
    Write-Success "Created: $openclawDir"
}

# Create default config
$configPath = Join-Path $openclawDir "openclaw.json"
$whisperScript = Join-Path $projectDir "extended\packages\whisper\transcribe_audio.ps1"

if ((Test-Path $configPath) -and (-not $Force)) {
    Write-Success "Config already exists: $configPath"
}
else {
    $config = @{
        gateway = @{
            port = 18789
            mode = "local"
            bind = "loopback"
            auth = @{
                mode = "token"
                token = ""
            }
        }
        audio = @{
            transcription = @{
                command = @(
                    "powershell.exe",
                    "-ExecutionPolicy", "Bypass",
                    "-File", $whisperScript,
                    "-InputAudioPath", "`${input}"
                )
            }
        }
        logging = @{
            level = "info"
        }
    }

    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath -Encoding UTF8
    Write-Success "Created default config: $configPath"
}

# ============================================
# STEP 7: Install global CLI (optional)
# ============================================
Write-Step "Installing global CLI..."

Push-Location $projectDir
try {
    npm install -g ./ 2>$null
    Write-Success "OpenClaw CLI installed globally"

    # Verify
    $version = (openclaw --version 2>$null)
    if ($version) {
        Write-Success "Verified: openclaw $version"
    }
}
catch {
    Write-Warning "Could not install globally. You can run locally with: pnpm openclaw"
}
finally {
    Pop-Location
}

# ============================================
# Done!
# ============================================
Write-Host @"

===============================================
     Installation Complete!
===============================================

Next steps:
  1. Configure your API keys in: $configPath
  2. Start the gateway: openclaw gateway
  3. Run diagnostics: openclaw doctor

For speech-to-text (Vietnamese):
  - Model: ggml-base.bin (multilingual)
  - Script: $whisperScript

Documentation: https://github.com/anthropics/claude-code

===============================================
"@ -ForegroundColor Green
