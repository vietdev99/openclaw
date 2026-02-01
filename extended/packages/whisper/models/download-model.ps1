param(
    [string]$Model = "base"
)

$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Available models
$models = @(
    "tiny", "tiny.en",
    "base", "base.en",
    "small", "small.en",
    "medium", "medium.en",
    "large-v1", "large-v2", "large-v3", "large-v3-turbo"
)

if ($models -notcontains $Model) {
    Write-Host "Invalid model: $Model"
    Write-Host "Available models:"
    $models | ForEach-Object { Write-Host "  $_" }
    exit 1
}

$modelFile = "ggml-$Model.bin"
$modelPath = Join-Path $scriptDir $modelFile
$modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$modelFile"

if (Test-Path $modelPath) {
    Write-Host "Model $Model already exists at $modelPath"
    exit 0
}

Write-Host "Downloading $modelFile from Hugging Face..."
Write-Host "URL: $modelUrl"
Write-Host "Destination: $modelPath"
Write-Host ""

try {
    # Use BITS for better download experience (resume support, progress)
    Start-BitsTransfer -Source $modelUrl -Destination $modelPath -Description "Downloading Whisper model: $Model"

    if (Test-Path $modelPath) {
        $size = (Get-Item $modelPath).Length / 1MB
        Write-Host ""
        Write-Host "Download complete! Model saved to: $modelPath"
        Write-Host "Size: $([math]::Round($size, 2)) MB"
    }
    else {
        throw "Download failed - file not created"
    }
}
catch {
    Write-Host "Error downloading model: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Try manual download:"
    Write-Host "  Invoke-WebRequest -Uri '$modelUrl' -OutFile '$modelPath'"
    exit 1
}
