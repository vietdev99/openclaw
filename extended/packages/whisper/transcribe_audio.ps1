param([string]$InputAudioPath)

$ErrorActionPreference = "Stop"

# Force UTF-8 encoding for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory for relative paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$tempDir = [System.IO.Path]::GetTempPath()
$fileNameWithoutExtension = [System.IO.Path]::GetFileNameWithoutExtension($InputAudioPath)
# whisper-cli appends .txt to the input file name
$outputTxtPath = Join-Path $tempDir "$fileNameWithoutExtension.txt"
$tempWavPath = Join-Path $tempDir "$fileNameWithoutExtension.wav"

# Log file for debugging
$logFile = Join-Path $tempDir "whisper-transcribe.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $logMessage -ErrorAction SilentlyContinue
    # Write to STDERR to avoid polluting stdout (which is captured for transcript)
    [Console]::Error.WriteLine($logMessage)
}

Write-Log "=== Starting transcription ==="
Write-Log "Input: $InputAudioPath"
Write-Log "Script dir: $scriptDir"

# Check if input file needs conversion (Opus/OGG from Telegram uses Opus codec)
function Test-NeedsConversion {
    param([string]$Path)
    $ext = [System.IO.Path]::GetExtension($Path).ToLower()
    # OGG files from Telegram typically use Opus codec which miniaudio doesn't support
    # WAV and MP3 are supported directly by miniaudio
    return $ext -eq ".ogg" -or $ext -eq ".oga" -or $ext -eq ".opus"
}

function Convert-ToWav {
    param([string]$InputPath, [string]$OutputPath)

    # Try bundled opusdec first (for Opus/OGG files from Telegram)
    $opusdecPath = Join-Path $scriptDir "bin\opusdec.exe"

    if (Test-Path $opusdecPath) {
        Write-Log "Converting Opus audio to WAV using opusdec..."
        Write-Log "opusdec path: $opusdecPath"
        # opusdec outputs WAV by default, --rate resamples to 16kHz for whisper
        $opusdecArgs = "--rate 16000 `"$InputPath`" `"$OutputPath`""
        Write-Log "opusdec args: $opusdecArgs"
        $process = Start-Process -FilePath $opusdecPath -ArgumentList $opusdecArgs -NoNewWindow -Wait -PassThru
        Write-Log "opusdec exit code: $($process.ExitCode)"
        if ($process.ExitCode -eq 0 -and (Test-Path $OutputPath)) {
            Write-Log "opusdec success, output: $OutputPath"
            return $OutputPath
        }
        Write-Log "opusdec failed, trying ffmpeg fallback..."
    } else {
        Write-Log "opusdec not found at: $opusdecPath"
    }

    # Fallback to ffmpeg (for other formats or if opusdec fails)
    $ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $ffmpegPath) {
        $ffmpegPath = Join-Path $scriptDir "bin\ffmpeg.exe"
    }

    if (-not (Test-Path $ffmpegPath)) {
        throw "Audio conversion failed. opusdec could not convert the file and FFmpeg is not available. Please install FFmpeg and add it to PATH."
    }

    Write-Log "Converting audio to WAV using ffmpeg..."
    $ffmpegArgs = "-y -i `"$InputPath`" -ar 16000 -ac 1 -c:a pcm_s16le `"$OutputPath`""
    $process = Start-Process -FilePath $ffmpegPath -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "FFmpeg conversion failed with exit code $($process.ExitCode)"
    }

    if (-not (Test-Path $OutputPath)) {
        throw "FFmpeg failed to create output file at '$OutputPath'"
    }

    return $OutputPath
}

Write-Log "Transcribing '$InputAudioPath' using whisper-cli..."
try {
    $whisperCliPath = Join-Path $scriptDir "bin\whisper-cli.exe"
    $whisperModelPath = Join-Path $scriptDir "models\ggml-medium.bin"

    Write-Log "whisper-cli path: $whisperCliPath"
    Write-Log "model path: $whisperModelPath"

    # Check if input file exists
    if (-not (Test-Path $InputAudioPath)) {
        throw "Input audio file not found: $InputAudioPath"
    }
    Write-Log "Input file exists: $(Test-Path $InputAudioPath)"

    # Check if model exists
    if (-not (Test-Path $whisperModelPath)) {
        Write-Log "Model not found. Downloading ggml-medium.bin (~1.5GB)..."
        $downloadScript = Join-Path $scriptDir "models\download-model.ps1"
        & $downloadScript -Model "medium"
    }

    # Determine input file (convert if needed)
    $audioPath = $InputAudioPath
    $needsConversion = Test-NeedsConversion -Path $InputAudioPath
    Write-Log "Needs conversion: $needsConversion"

    if ($needsConversion) {
        $audioPath = Convert-ToWav -InputPath $InputAudioPath -OutputPath $tempWavPath
        Write-Log "Converted audio path: $audioPath"
    }

    # whisper-cli with miniaudio supports WAV/MP3/Vorbis
    # Use --language vi for Vietnamese transcription
    # Use -of to specify output file path
    $whisperArgs = "-m `"$whisperModelPath`" -f `"$audioPath`" --output-txt -of `"$tempDir$fileNameWithoutExtension`" --language vi"
    Write-Log "whisper args: $whisperArgs"

    # Redirect whisper-cli stdout to null to avoid polluting output
    # Only capture the .txt file output
    $whisperProcess = Start-Process -FilePath $whisperCliPath -ArgumentList $whisperArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput "NUL"
    Write-Log "whisper-cli exit code: $($whisperProcess.ExitCode)"

    if (-not (Test-Path $outputTxtPath)) {
        Write-Log "ERROR: Output file not found at: $outputTxtPath"
        throw "Whisper-cli failed to create transcription file at '$outputTxtPath'."
    }

    # Output the content of the transcription file with UTF-8 encoding
    $rawTranscript = Get-Content $outputTxtPath -Encoding UTF8 -Raw

    # Strip timestamp format [HH:MM:SS.mmm --> HH:MM:SS.mmm] from whisper output
    # Also strip leading/trailing whitespace from each line
    $cleanedLines = $rawTranscript -split "`n" | ForEach-Object {
        # Remove timestamp prefix like [00:00:00.000 --> 00:00:01.820]
        $line = $_ -replace '^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*', ''
        $line.Trim()
    } | Where-Object { $_ -ne "" }

    $transcript = ($cleanedLines -join " ").Trim()

    Write-Log "Transcript: $transcript"
    Write-Log "=== Transcription complete ==="

    # Output transcript to stdout (this is what openclaw captures)
    $transcript
}
catch {
    Write-Log "ERROR: Transcription failed. $($_.Exception.Message)"
    Write-Log "Error: Transcription failed. $($_.Exception.Message)"
    exit 1
}
finally {
    # Clean up temporary files
    if (Test-Path $outputTxtPath) { Remove-Item $outputTxtPath -ErrorAction SilentlyContinue }
    if (Test-Path $tempWavPath) { Remove-Item $tempWavPath -ErrorAction SilentlyContinue }
}
