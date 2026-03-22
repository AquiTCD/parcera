# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-03-22 - Multi-Model Local Brain & Qwen3.5 Support

### Added
- Support for Qwen3.5 (4B / 9B) as selectable local LLM via model dropdown in settings UI
- Model family detection (`_detect_model_family`) enabling family-aware prompt construction
- Family-aware `compose_messages`: Gemma embeds system prompt in user message; Qwen uses native system role
- Family-aware `update_context`: role name switches between `"model"` (Gemma) and `"assistant"` (Qwen)
- Qwen special tokens (`<|im_end|>`, `<|im_start|>`, `<think>`, `</think>`) added to `SPECIAL_TAGS`
- `enable_thinking=False` applied to Qwen chat template to suppress reasoning preamble in responses
- `strict=False` model loading via low-level mlx_lm APIs, allowing VL models (Qwen3.5) to load as text-only
- Model preset dropdown (Gemma 2 9B / Qwen3.5 9B / Qwen3.5 4B) replacing free-text input in settings UI
- LoRA profile list now filtered by `base_model` compatibility with the selected model
- `base_model` field added to profile API response (read from `adapter_config.json`)
- Automatic `adapter_path` clear when switching models to prevent architecture mismatch

### Changed
- `export_to_jsonl` now uses model-agnostic `messages` format instead of Gemma-specific turn format
- `check_model_cached` for HuggingFace models now verifies `.safetensors` weight files exist (not just `config.json`)

### Fixed
- Vision tower parameter mismatch error when loading Qwen3.5 (VL model) with mlx_lm
- Download button not appearing after live model switch due to metadata-only cache false positive

## [0.5.0] - 2026-03-22 - LoRA Management & Multi-Adapter Blending

### Added
- **Multi-Adapter Blending**: Implemented advanced weighted blending for multiple LoRA adapters with smart auto-balancing logic.
- **Auto-Discovery**: Added automatic detection of LoRA adapters placed directly in the `adapters/llm/` directory.
- **Import/Export UI**: Added "Import External Profile" and "Export Profile" buttons to allow easy sharing and management of LoRA adapters.
- **Status Badges**: Added visual indicators for adapter presence and training status in the profile list.

### Changed
- **UX Simplification**: Removed the manual "Adapter Path" input field in favor of a unified, self-managing profile list.
- **Backend Architecture**: Enhanced `TrainingService` with robust file operations (copying/renaming) and background cleanup of temporary fused adapters.
- **FastAPI Routing**: Added dedicated endpoints for profile importing and exporting in `training_router.py`.

### Fixed
- **Adapter Compatibility**: Improved discovery logic to support both `adapters.safetensors` and `adapter_model.safetensors` filenames.
- **Stability**: Fixed memory leaks and stale files by implementing startup cleanup for temporary directories.

## [0.4.0] - 2026-03-07 - Twitch EventSub & Architecture Refactoring

### Added
- **Twitch EventSub**: Implemented comprehensive EventSub support in `TwitchClient` to react to new channel events.
- **Queueing & Rate Limiting**: Added robust rate limiting and refined queueing to `TwitchService` with configurable cooldowns and queue sizes.
- **EventSub UI**: Added UI toggles for EventSub reactions and a dedicated test event trigger within the Twitch settings tab.
- **Agent Workflows**: Introduced heavy-duty `deep-refactor` markdown workflow for systematic codebase auditing and structural improvements.

### Changed
- **UI Architecture**: Refactored the monolithic `TwitchTab.tsx` by splitting it into specialized subcomponents (`TwitchAuthCard`, `TwitchEventsCard`, `TwitchResponseLogicCard`) to improve maintainability.
- **Backend Architecture**: Applied DRY principles and extracted magic numbers in `TwitchClient` and `TwitchService` to class-level constants.

### Fixed
- **Testing Stability**: Addressed flakiness in EventSub tests by exposing the `_subscription_worker` and creating comprehensive rate-limiting and queueing tests.
- **Audio/Thinking Signals**: Restored correct AI invocation methods, updated EventSub OAuth scopes, and re-enabled audio/thinking signals during Twitch events.

## [0.3.1] - 2026-03-05 - Codebase Stabilization & Refactoring

### Changed
- **Backend Configuration**: Integrated `pydantic` into the core configuration engine (`src/core/config.py`) for strict schema validation and safe UI-default fallback capability.
- **Frontend Architecture**: Split monolithic Electron settings tabs (`AIProfileTab.tsx`, `VisualTab.tsx`) into concise presenter components (e.g., `AvatarColumn.tsx`, `BreatheAnimationSettings.tsx`) for performance and maintainability.
- **Test Infrastructure**: Designed full-stack integration mocks (`test_integration.py`) verifying the Twitch to LLM to TTS audio pipeline.

### Fixed
- **Electron Console**: Cleaned up the sidecar logging mechanism, accurately resolving python log prefixes and halting duplicate `[Python Error]` tags.
- **Backend Stability**: Fastened logic around transient networking errors in the Twitch Client (`ClientConnectorDNSError`) to prevent unhandled HTTP tracebacks.

## [0.2.3] - 2026-03-03 - Real-time Interaction Control & Optimization

### Added
- **Real-time Interaction Controls**: Added direct sensitivity selection (Low/Medium/High) buttons to the AI avatar window for instant behavior adjustment.
- **Lightweight IPC Mechanism**: Implemented `update-setting` IPC handler for partial, high-speed configuration updates without requiring a full settings reload.
- **Layered Configuration**: Established a robust three-tier configuration hierarchy: `system_vitals.yaml` (Internal) -> `settings.default.yaml` (UI Defaults) -> `config.json` (User).
- **Automated Migration**: Added silent config migration to clean up legacy internal constants from user configuration files.

### Changed
- **Interaction Performance**: Refactored Microphone Mute and Conversation Mode toggles to use the new lightweight update mechanism, significantly reducing UI latency.
- **Sensitivity Presets**: Updated `ResponseWeightFilter` parameters to a more balanced "Medium" default [16.0, 0.15, 0.45] and decoupled presets from UI settings.

### Fixed
- **Code Integrity**: Removed redundant `useEffect` hooks and corrected state synchronization logic in `useAvatar`.
- **Testing**: Added comprehensive test suites for configuration hierarchy and front-end sensitivity controls.

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
