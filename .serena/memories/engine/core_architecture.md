# Core Avatar Engine (Architecture & Data)
The engine is a Python-based system built on `aiavatar`, serving as a WebSocket bridge between AI providers (Gemini/OpenAI) and the Electron frontend.

## Components & Flow
- **Factory (`src/core/factory.py`)**: Dynamically instantiates LLM (Gemini/OpenAI), STT (Faster-Whisper), and TTS (AivisSpeech) based on settings.
- **WebSocket Protocol**: Runs on `ws://localhost:{port}/ws`. Delivers Base64 audio and text tokens to the UI.
- **Filtering (`src/core/filters.py`)**: Uses `ResponseWeightFilter` to control AI responsiveness based on sentence length and keywords.

## Storage
- **Database**: SQLite (`aiavatar.db`) stores conversation history in the `message` table (id, session_id, role, content, created_at).
- **Settings**: Merges `settings.default.yaml` with user overrides and populates prompt placeholders.
Reference: docs/specs/core-avatar-engine/TRD.md
