# Spec: Integrated TTS Engine Management

## 1. Goal
Integrate the lifecycle management of the AivisSpeech TTS engine into the Parcera application. 
The user should only need to run `uv run python src/run.py` to start both the TTS engine and the AI Avatar, and stopping the Python process should also stop the TTS engine.

## 2. Requirements

### 2.1 Engine Startup
- **Path**: `/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run`
- **Mechanism**: Use `asyncio.create_subprocess_exec` to run the engine as a background process.
- **Health Check**: Before starting the AI Avatar's main loop, the system must wait for the TTS engine to be ready (i.e., the API at `http://127.0.0.1:10101` returns a successful response).
- **Retry Logic**: If the engine fails to start or the API isn't ready within a reasonable timeout (e.g., 30 seconds), the application should log an error and exit gracefully.

### 2.2 Engine Shutdown
- **Mechanism**: The TTS engine process must be terminated when the main Python process receives a shutdown signal (e.g., `KeyboardInterrupt` / `SIGINT`).
- **Cleanup**: Ensure no orphaned AivisSpeech processes are left running.

### 2.3 Configuration
- The path to the AivisSpeech engine should be configurable via environment variables, defaulting to the provided macOS path.
- **New Env Var**: `TTS_ENGINE_PATH`

## 3. Implementation Plan

### Step 1: Update `.env` / Environment Handling
- Add `TTS_ENGINE_PATH` with the default macOS path.

### Step 2: Implement `TTSEngineManager`
- Create a class or utility to handle the subprocess lifecycle.
- Functions: `start()`, `stop()`, `is_ready()`.

### Step 3: Integrate into `ParceraAvatar` in `src/run.py`
- Modify `ParceraAvatar.__init__` or `ParceraAvatar.start` to initialize and start the engine.
- Wrap the main loop in a try-finally block to ensure `engine.stop()️` is called.

## 4. Acceptance Criteria
1. Running `uv run python src/run.py` starts the AivisSpeech engine automatically.
2. The application waits until AivisSpeech is ready before listening for audio.
3. Pressing `Ctrl+C` stops both the Python script and the AivisSpeech engine.

---
## Implementation Status: **Completed** ✅
- [x] Engine Management Service
- [x] Configurable Engine Paths
- [x] Auto-Health Check before startup
- [x] Graceful shutdown of subprocesses
- [x] Multi-engine support (Aivis/VOICEVOX)
