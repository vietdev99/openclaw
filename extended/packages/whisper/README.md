# Whisper Speech-to-Text Package

Pre-built [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binaries for Windows with Vietnamese language support.

## Structure

```
whisper/
├── bin/
│   ├── ffmpeg.exe         # Bundled FFmpeg for audio conversion
│   ├── whisper-cli.exe    # Main executable
│   ├── whisper.dll        # Whisper library
│   ├── ggml.dll           # GGML library
│   ├── ggml-base.dll      # GGML base
│   └── ggml-cpu.dll       # CPU backend
├── models/
│   ├── download-model.ps1 # Model downloader
│   └── ggml-base.bin      # Multilingual model (after download)
├── transcribe_audio.ps1   # Main transcription script
└── README.md
```

## Usage

### Download Model

```powershell
# Download base model (recommended for Vietnamese)
.\models\download-model.ps1 -Model base

# Other available models:
# tiny, tiny.en, base, base.en, small, small.en, medium, medium.en
# large-v1, large-v2, large-v3, large-v3-turbo
```

### Transcribe Audio

```powershell
.\transcribe_audio.ps1 -InputAudioPath "path/to/audio.ogg"
```

The script will:
1. Convert audio to WAV format (16kHz, mono) using bundled FFmpeg
2. Transcribe using whisper-cli with Vietnamese language
3. Output the transcription text
4. Clean up temporary files

## Requirements

All dependencies are bundled:
- **FFmpeg**: Included in `bin/ffmpeg.exe` (no installation required)
- **Whisper**: Included in `bin/whisper-cli.exe`

## OpenClaw Integration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "audio": {
    "transcription": {
      "command": [
        "powershell.exe",
        "-ExecutionPolicy", "Bypass",
        "-File", "<path-to>/extended/packages/whisper/transcribe_audio.ps1",
        "-InputAudioPath", "${input}"
      ]
    }
  }
}
```

## Models

| Model | Size | Vietnamese Support | Speed |
|-------|------|-------------------|-------|
| tiny | ~75MB | Poor | Fastest |
| base | ~148MB | Good | Fast |
| small | ~488MB | Better | Medium |
| medium | ~1.5GB | Best | Slow |
| large-v3 | ~3GB | Best | Slowest |

**Recommended**: `base` for good balance of accuracy and speed.

## Build from Source

If you need to rebuild whisper.cpp:

```powershell
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build --config Release
```

Binaries will be in `build/bin/`.
