# Technical Spec: Packaging & Deployment Strategy (Phase 7)

## 1. Overview
This document outlines the strategy for packaging Parcera as a standalone macOS application (`.app`). The goal is to provide a seamless user experience while managing the complexity of a Python-based AI backend (Sidecar).

## 2. Selected Strategy: Portable Python (The "Stable Sidecar" Approach)
Based on the complexity of AI libraries (Faster-Whisper, PyTorch, etc.) and macOS security requirements, we have selected **Plan 2: Portable Python 同梱方式**.

### 2.1 Core Components
- **Runtime**: [python-build-standalone](https://github.com/indygreg/python-build-standalone) (arm64-apple-darwin).
- **Architecture**: **Apple Silicon (arm64) Native Only**. Intel Mac support is deprecated to optimize for Neural Engine performance and reduce package complexity.
- **Dependency Management**: A pre-installed `site-packages` directory within the app bundle, referenced by the portable interpreter.
- **Process Management**: Electron Main process acts as a "Guardian" for the Python sidecar.

### 2.2 Optimization: Dependency Diet
To ensure stability and reduce package size (Goal: < 300MB excluding models):
- **Remove `torch` & `openai-whisper`**: Currently, `faster-whisper` (CTranslate2) is the primary engine. By removing the standard `torch` dependency, we eliminate ~600MB of bloat and avoid common C-extension loading issues.
- **On-demand Assets**: AI models (Whisper, etc.) are NOT bundled. They are downloaded on first run to `~/Library/Application Support/Parcera/models/`.

## 3. Implementation Details

### 3.1 Python Sidecar Structure
```text
Parcera.app/Contents/Resources/
├── bin/
│   └── python-engine/       # Portable Python Interpreter
├── src/                     # Python Source Code
└── site-packages/           # Pre-installed Dependencies
```

### 3.2 Electron Guardian (Process Lifecycle)
The Electron Main process will manage the Python backend:
- **Auto-Boot**: Spawn Python server on app startup.
- **Health Check**: Monitor `/health` endpoint.
- **Zombie Prevention**: Ensure `SIGTERM` is sent to the sidecar on app quit.
- **Recovery**: Automatic restart if the engine crashes (with a threshold).
- **Live Log Streaming**: Stream Python's `stdout`/`stderr` to the Electron UI (Settings > Logs) via IPC for real-time monitoring and troubleshooting.

### 3.3 Security & Entitlements
- **Hardened Runtime**: Enabled.
- **Entitlements**: `com.apple.security.device.audio-input` (Microphone) and `com.apple.security.network.client/server`.
- **Deep Signing**: Every `.dylib`, `.so`, and binary in the Python bundle must be signed before Notarization.

## 4. Alternative Strategies (Backups)

### Plan 1: PyInstaller (`--onedir`)
- **Method**: Bundle Python into a single executable folder.
- **Why rejected**: High risk of "Missing Dependency" errors with ML libraries. PyTorch/Whisper dynamic imports are notoriously difficult for PyInstaller to trace.
- **Status**: Backup plan if Portable Python has unexpected path-resolution issues.

### Plan 3: uv-Managed Runtime
- **Method**: Bundle the `uv` binary and build the environment on the user's machine at first run.
- **Why rejected**: Requires internet for first run; user has to wait for a 1GB+ download before the first "Hello".
- **Status**: Potential option for "Developer Edition" or future updates.

## 5. Success Criteria
1. The app launches and shows the "Initializing AI..." screen.
2. Faster-Whisper models download successfully to the User Data directory.
3. The avatar responds to voice input without requiring a pre-installed Python environment.
4. The `.app` passes Apple's Notarization check.
