param(
    [switch]$SkipModelDownload,
    [string]$Model = "medium"
)

$ErrorActionPreference = "Stop"

# Force UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================"
Write-Host "  Whisper Package Installation"
Write-Host "========================================"
Write-Host ""

# Step 1: Check bin directory and required files
Write-Host "[1/4] Checking binary files..."
$binDir = Join-Path $scriptDir "bin"
$whisperCli = Join-Path $binDir "whisper-cli.exe"
$opusdec = Join-Path $binDir "opusdec.exe"

$missingFiles = @()

if (-not (Test-Path $whisperCli)) {
    $missingFiles += "whisper-cli.exe"
}

if (-not (Test-Path $opusdec)) {
    $missingFiles += "opusdec.exe"
}

# Check CUDA DLLs (optional but recommended)
$cudaDlls = @(
    "cublas64_12.dll",
    "cublasLt64_12.dll",
    "cudart64_12.dll",
    "ggml-cuda.dll"
)

$hasCuda = $true
foreach ($dll in $cudaDlls) {
    $dllPath = Join-Path $binDir $dll
    if (-not (Test-Path $dllPath)) {
        $hasCuda = $false
        break
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "  [ERROR] Missing required files:"
    foreach ($file in $missingFiles) {
        Write-Host "    - $file"
    }
    Write-Host ""
    Write-Host "  Please ensure the following files exist in $binDir"
    Write-Host "  Download from: https://github.com/ggml-org/whisper.cpp/releases"
    exit 1
}

Write-Host "  [OK] whisper-cli.exe found"
Write-Host "  [OK] opusdec.exe found"

if ($hasCuda) {
    Write-Host "  [OK] CUDA support detected (GPU acceleration enabled)"
} else {
    Write-Host "  [INFO] CUDA DLLs not found (CPU mode only)"
    Write-Host "        For GPU acceleration, download CUDA binaries from:"
    Write-Host "        https://github.com/ggml-org/whisper.cpp/releases"
}
Write-Host ""

# Step 2: Check/create models directory
Write-Host "[2/4] Checking models directory..."
$modelsDir = Join-Path $scriptDir "models"
if (-not (Test-Path $modelsDir)) {
    Write-Host "  Creating models directory..."
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}
Write-Host "  [OK] Models directory: $modelsDir"
Write-Host ""

# Step 3: Download model
Write-Host "[3/4] Checking Whisper model..."
$modelFile = "ggml-$Model.bin"
$modelPath = Join-Path $modelsDir $modelFile

if (Test-Path $modelPath) {
    $size = (Get-Item $modelPath).Length / 1MB
    Write-Host "  [OK] Model '$Model' already exists ($([math]::Round($size, 2)) MB)"
} elseif ($SkipModelDownload) {
    Write-Host "  [SKIP] Model download skipped (-SkipModelDownload flag)"
} else {
    Write-Host "  Downloading model: $Model"
    Write-Host "  This may take a while depending on your connection..."
    Write-Host ""

    $downloadScript = Join-Path $modelsDir "download-model.ps1"
    if (Test-Path $downloadScript) {
        & $downloadScript -Model $Model

        if (Test-Path $modelPath) {
            $size = (Get-Item $modelPath).Length / 1MB
            Write-Host "  [OK] Model downloaded successfully ($([math]::Round($size, 2)) MB)"
        } else {
            Write-Host "  [ERROR] Model download failed"
            exit 1
        }
    } else {
        Write-Host "  [ERROR] download-model.ps1 not found at $downloadScript"
        exit 1
    }
}
Write-Host ""

# Step 4: Test transcription (optional quick test)
Write-Host "[4/4] Verifying installation..."

# Quick check that whisper-cli runs
try {
    $whisperVersion = & $whisperCli --help 2>&1 | Select-String "usage:" -SimpleMatch
    if ($whisperVersion) {
        Write-Host "  [OK] whisper-cli is working"
    } else {
        Write-Host "  [WARN] Could not verify whisper-cli"
    }
} catch {
    Write-Host "  [WARN] Could not run whisper-cli: $($_.Exception.Message)"
}

# Check if model file is valid (basic size check)
if (Test-Path $modelPath) {
    $modelSize = (Get-Item $modelPath).Length
    $expectedMinSize = switch ($Model) {
        "tiny"    { 70MB }
        "tiny.en" { 70MB }
        "base"    { 140MB }
        "base.en" { 140MB }
        "small"   { 460MB }
        "small.en"{ 460MB }
        "medium"  { 1400MB }
        "medium.en" { 1400MB }
        default   { 100MB }
    }

    if ($modelSize -lt $expectedMinSize) {
        Write-Host "  [WARN] Model file seems too small. Expected > $([math]::Round($expectedMinSize/1MB, 0)) MB"
        Write-Host "        File may be corrupted. Consider re-downloading."
    } else {
        Write-Host "  [OK] Model file size verified"
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Installation Complete!"
Write-Host "========================================"
Write-Host ""
Write-Host "Model: $Model ($modelFile)"
Write-Host "Path:  $modelPath"
Write-Host ""
Write-Host "To test transcription:"
Write-Host "  .\transcribe_audio.ps1 -InputAudioPath <your-audio-file>"
Write-Host ""

if (-not $hasCuda) {
    Write-Host "TIP: For faster transcription, enable GPU acceleration:"
    Write-Host "  1. Download CUDA binaries from whisper.cpp releases"
    Write-Host "  2. Copy *.dll files to $binDir"
    Write-Host ""
}
