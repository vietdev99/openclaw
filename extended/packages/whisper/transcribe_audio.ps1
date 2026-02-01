param([string]$InputAudioPath)

$ErrorActionPreference = "Stop"

# Force UTF-8 encoding for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory for relative paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$tempDir = [System.IO.Path]::GetTempPath()
$fileNameWithoutExtension = [System.IO.Path]::GetFileNameWithoutExtension($InputAudioPath)
$tempWavPath = Join-Path $tempDir "$fileNameWithoutExtension.wav"
# whisper-cli appends .txt to the WAV file name, so the output will be like file.wav.txt
$outputTxtPath = "$tempWavPath.txt"

Write-Host "Converting '$InputAudioPath' to '$tempWavPath' using FFmpeg..."
try {
    $ffmpegArgs = "-i `"$InputAudioPath`" -ar 16000 -ac 1 -c:a pcm_s16le `"$tempWavPath`" -y"
    Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru | Out-Null

    if (-not (Test-Path $tempWavPath)) {
        throw "FFmpeg failed to create WAV file."
    }
}
catch {
    Write-Host "Error: Failed to convert audio to WAV. $($_.Exception.Message)"
    exit 1
}

Write-Host "Transcribing '$tempWavPath' using whisper-cli..."
try {
    $whisperCliPath = Join-Path $scriptDir "bin\whisper-cli.exe"
    $whisperModelPath = Join-Path $scriptDir "models\ggml-base.bin"

    # Check if model exists
    if (-not (Test-Path $whisperModelPath)) {
        Write-Host "Model not found. Downloading ggml-base.bin..."
        $downloadScript = Join-Path $scriptDir "models\download-model.ps1"
        & $downloadScript -Model "base"
    }

    # Use --language vi for Vietnamese transcription
    $whisperArgs = "-m `"$whisperModelPath`" -f `"$tempWavPath`" --output-txt --language vi"
    Start-Process -FilePath $whisperCliPath -ArgumentList $whisperArgs -NoNewWindow -Wait -PassThru | Out-Null

    if (-not (Test-Path $outputTxtPath)) {
        throw "Whisper-cli failed to create transcription file at '$outputTxtPath'."
    }

    # Output the content of the transcription file with UTF-8 encoding
    Get-Content $outputTxtPath -Encoding UTF8
}
catch {
    Write-Host "Error: Transcription failed. $($_.Exception.Message)"
    exit 1
}
finally {
    # Clean up temporary files
    if (Test-Path $tempWavPath) { Remove-Item $tempWavPath -ErrorAction SilentlyContinue }
    if (Test-Path $outputTxtPath) { Remove-Item $outputTxtPath -ErrorAction SilentlyContinue }
}
