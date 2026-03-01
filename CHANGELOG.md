# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2026-03-01 - Python 3.13 & Library Optimization

### Changed
- **Runtime Environment**: Upgraded Python from `3.11` to `3.13.12` for better performance and modern C-API support.
- **Dependency Optimization**: Updated core libraries to their latest versions for Python 3.13 compatibility:
    - `aiavatar` (0.8.7 -> 0.8.9)
    - `faster-whisper` (1.2.0 -> 1.2.1)
    - `azure-cognitiveservices-speech` (1.48.1 -> 1.48.2)
    - `fastapi` (0.129.0 -> 0.135.0)
- **Deployment**: Updated `prepare_sidecar.sh` to bundle Python 3.13 based standalone runtime (Astral build tag: `20260203`).

## [0.2.1] - 2026-02-28 - Refactor & Component Optimization

### Changed
- **Backend Architecture**: Decoupled server logic into specialized routers (`model_router.py`) and services (`TwitchService`), removing God Object from `run_server.py`.
- **Frontend Architecture**: Extracted complex audio, WebSocket, and side-effect logic from `Avatar.tsx` into a reusable `useAvatar` hook.
- **Frontend Optimization**: Moved `useSettingsState` hook to `lib/hooks` for better separation of concerns, adopting the Container/Presenter pattern.
- **Code Maintainability**: Extracted magic constants (e.g., `TWITCH_SESSION_ID`) into `src/core/constants.py` to ensure DRY principles.

### Fixed
- **Testing Stability**: Fixed test suite hanging issues caused by uncancelled FastAPI background lifespan tasks.
- **Test Integrity**: Updated unit tests for Twitch logic and interaction priority to match the new architecture.

## [0.2.0] - 2026-02-28 - Twitch Integration Phase 1

### Added
- **Twitch Integration Core**: Complete implementation of Twitch chat monitoring and AI response system.
- **Twitch OAuth 2.0 Flow**: Secure authorization flow within Electron, including token encryption and automatic refresh.
- **IRC Chat Listener**: Real-time IRC integration for monitoring wake words and reading chat messages.
- **Twitch Settings UI**: Dedicated settings tab in the GUI to manage Twitch credentials, wake words, and ignored users.
- **Background Thinking (Zero-Wait)**: High-performance parallel processing, allowing LLM to think while user is speaking.
- **Dynamic Response Timing**: Human-like "reading wait" presets (Instant, Fast, Natural, Slow) with character-weighted calculation.
- **Twitch Action Guidelines**: Specialized persona rules for audience engagement and role separation between Broadcaster/Viewer.
- **Robust Startup Synchronization**: 20-second automatic retry mechanism for reliable backend discovery and token syncing.

### Fixed
- **Interaction Priority**: Resolved concurrent access issues between voice-to-voice sessions and background Twitch thinking.
- **Engine Stability**: Fixed race conditions and session deadlocks observed during high-load multi-modal interactions.

## [0.1.0] - 2026-02-26 - Initial Release

### Added
- **Core Avatar Engine**: Real-time voice interaction infrastructure using Faster-Whisper, Gemini, and high-quality TTS.
- **Intelligent STT Pipeline**: Implementation of "First-Wins" logic, VAD, and sensitivity-based audio filtering.
- **Modern Settings UI**: Slim, reactive desktop interface for managing AI profiles, user settings, and engine configuration.
- **Persona System**: Hot-reloading system for system prompts and action guidelines (Soliloquy and Normal modes).
- **Persistent Logging**: Centralized LogManager for tracking conversation history and system debugging.
- **Auto-Update Configuration**: YAML-based hot-reloading of runtime settings and keywords.
