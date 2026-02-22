# Parcera Project Purpose
Parcera is an AI Avatar project running on macOS. It uses aiavatar as the core library, providing STT (Whisper), LLM (Gemini/OpenAI), and TTS (AivisSpeech/VOICEVOX) integration with lip-sync and animations.

# Tech Stack
- **Language**: Python 3.11+
- **Manager**: `uv`, `mise`
- **Frontend**: Electron + React/Vite
- **Core**: `aiavatar`
- **STT**: `faster-whisper` (Kotoba-Whisper)
- **TTS**: AivisSpeech (VOICEVOX compatible)
- **LLM**: Gemini, OpenAI, etc.

# Codebase Structure
- `src/`: Core Python logic
  - `src/core/`: Component factory, config management, avatar base
  - `src/run_server.py`: FastAPI server for WebSocket communication
- `electron/`: Frontend UI
- `configs/`: Configuration files
- `prompts/`: AI personality prompts
- `specs/`: Technical specifications

# Development Commands
- **Install**: `uv sync`
- **Run Server**: `uv run python src/run_server.py`
- **Run Avatar (Full)**: `/run-avatar` (custom workflow)
