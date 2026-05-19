# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.2] - 2026-05-19 - Twitch Follow Event Fix

### Fixed
- **Twitch follow events restored**: Added missing `MODERATOR_READ_FOLLOWERS` OAuth scope to `DEFAULT_SCOPES`; `listen_channel_follow_v2` silently dropped all follow events since this scope was omitted when switching from v1 in a prior commit
- **Eliminated duplicate EventSub subscription registration**: Removed subscription calls from `_on_eventsub_ready`; subscriptions are now registered exclusively by `_subscription_worker`, preventing race-condition double-registration errors on connect

> **Note**: Users must re-authenticate Twitch (re-issue token) to pick up the new scope.

## [0.14.1] - 2026-05-19 - Post-release Stabilization

### Fixed
- **Settings reload decoupled from save**: Python hot-reload no longer blocks save response; save button no longer stays stuck on "保存中" after mic device changes
- **`update_setting` made non-blocking**: Timer cleanup added to prevent dangling async tasks on rapid setting changes
- **Save status no longer sticks**: UI correctly resets save button state after both successful and failed reloads; window-op errors are now logged
- **Tauri window commands**: Fixed camelCase key mismatch (`windowLabel` → `label` etc.) in IPC bridge calls for `set_window_always_on_top`, `show_window`, `hide_window`
- **mypy type annotations in `MicAnalyzer`**: `_stream` typed as `Optional[Any]`, callbacks narrowed from `Awaitable[None]` to `Coroutine[Any, Any, None]`; `sounddevice` lazy-import suppressed with `type: ignore[import-untyped]`
- **`mypy.ini`**: Added `sounddevice` to ignore list via inline suppression

## [0.14.0] - 2026-05-07 - OBS Browser Source & Runtime Settings

### Added
- **OBS Browser Source support**: Standalone `obs.html` served as `file://` URI so OBS can load the avatar page before Parcera's HTTP server starts; JS retries WebSocket connection automatically on Parcera restart — no manual OBS refresh needed
- **AI avatar lipsync in OBS**: WebAudio `AnalyserNode` decodes TTS audio chunks received via WebSocket; spectral-centroid vowel detection (`getAIVowel`) drives mouth animation for all five Japanese vowels (u/o/a/e/i)
- **Python avatar asset proxy**: `GET /config/obs-asset/{type}/{filename}` serves sprite images through FastAPI, bypassing `file://` mixed-content restrictions; resolves configured `assets_dir` with fallback to bundled assets
- **`file://` URL display in settings UI**: Settings screen fetches `GET /config/obs-html-path` and shows a clickable `file://` URL for each OBS browser source, ready to paste into OBS without running Parcera first
- **SVG chroma key filter for OBS**: `feColorMatrix` + `feComponentTransfer` filter applied via CSS class to avatar image; matches the Tauri window chroma key implementation; supports green and blue key colors
- **`flip_horizontal` support in OBS**: Avatar image mirrored via `scaleX(-1)` in the per-frame transform, composing correctly with breathing and lip-sync transforms
- **Asset cache-busting**: `?v={timestamp}` appended to all asset URLs on each `applySettings` call, ensuring custom avatar changes reflect immediately without OBS restart
- **Python `MicAnalyzer`**: `sounddevice`-based capture runs from startup; broadcasts `user_lipsync` WebSocket events (amplitude + vowel + speaking flag) to all clients; feeds speech chunks to STT via energy-based VAD
- **OBS User avatar lipsync via WebSocket**: User window in OBS mode subscribes to `user_lipsync` events from `MicAnalyzer` instead of running `getUserMedia`, removing the browser permission requirement
- **Avatar window visibility toggle**: "アバターウィンドウを表示する" switch in Character Settings; when OFF, position/lock/size controls are disabled; changes applied to the Tauri window on save
- **`alwaysOnTop` runtime control**: `set_window_always_on_top` Tauri command applies window always-on-top state immediately on save and restores it on startup
- **Instant hot-reload for more settings**: VAD `silence_duration_threshold`, `max_duration`; STS `merge_request_threshold`; mic device (restarts `MicAnalyzer` on change); LLM model and temperature within the same provider — all take effect on save without restart
- **"要再起動" badges on settings labels**: Muted small badges mark settings that still require a restart (STT provider/model/device/quantization, TTS provider, port, GPU acceleration)
- **Contextual save message**: Save button shows "一部の変更は再起動後に反映されます" (8 s) when the Python reload endpoint signals `restart_required: true`, otherwise shows the standard confirmation (3 s)
- **`tauri-plugin-localhost`**: Frontend served on a dedicated `frontend_port` (default 8677) separate from the Python backend port (8676); enables reliable OBS HTTP-mode loading

### Fixed
- **Asset 404 in OBS**: `settings.default.yaml` stores Tauri virtual paths (e.g. `/assets/user`) that do not exist on the filesystem; asset proxy now checks `Path.is_dir()` before trusting the configured path and falls back to bundled assets
- **AI avatar mouthing user mic audio**: OBS `obs.html` was driving the AI avatar with `user_lipsync` WebSocket events regardless of `avatarType`; branched WS message handler and animation loop by type
- **Spectral vowel detection regression**: Initial OBS AI lipsync used only RMS amplitude (open/close); full spectral-centroid algorithm ported from `audio.ts`, matching Tauri window quality
- **Custom assets not reflected in OBS**: Browser cache prevented proxy URL changes from taking effect; fixed with per-reload `?v={Date.now()}` cache key
- **Chroma key showing green background**: Incorrect approach set `document.body.style.background` to the key color (opaque); reverted to CSS SVG filter that makes matched pixels transparent, matching Tauri behavior
- **Double USER log per utterance**: `on_recognized_callback` was assigned redundantly; when `MicAnalyzer` called `stt.recognize()` the STT fired the callback internally, then `_handle_stt_audio` also called `controller.on_recognized()`, logging every utterance twice
- **MicAnalyzer early flush losing next utterance**: VAD early flush (after `MAX_SPEECH_CHUNKS`) cleared buffer and count but left `_is_speaking=True`; the next silence chunk immediately entered the post-speech handler against a zero-length buffer, silently discarding trailing audio
- **`merge_request_threshold` default mismatch**: Constructor used `3.0` s as fallback while `apply_runtime_config` used `0.6` s (matching `settings.default.yaml`); now consistently `0.6` s
- **Credential leak via OBS settings endpoint**: `GET /config/settings` returned the full raw settings dict including LLM/STT/TTS API keys and Twitch `client_secret`; credentials are now stripped before the response is sent

### Changed
- **Build output separation**: Vite web output moved to `dist/web/`; DMG and `.app` bundles copied to `releases/` (gitignored); `emptyOutDir: true` no longer wipes previous release artifacts on each build
- **`alwaysOnTop` setting now applied at runtime**: Previously saved to YAML but never acted upon; now applied via Tauri command on save and restored on startup

## [0.13.0] - 2026-05-05 - Gemma 4 & Multi-Model MLX Support

### Added
- **Gemma 4 E4B support**: `gemma4` model family auto-detected from path; uses native system role (same as Qwen), `"model"` assistant role for history; Gemma 4 4B (MLX) preset added to UI model selector
- **Gemma 4 thinking-block filter**: `<channel>thought … <channel|>` blocks generated by Gemma 4's built-in reasoning mode are silently stripped from the TTS stream; rolling token-boundary buffer handles tags split across tokens
- **Dedicated MLX executor thread**: `ThreadPoolExecutor(max_workers=1)` ensures model loading and inference always run on the same thread, eliminating `RuntimeError: There is no Stream(gpu, N) in current thread` on long-prompt models (Gemma 4 prefill loop)
- **Window-state persistence**: `tauri-plugin-window-state` added; window sizes and positions now survive app restarts
- **Local Brain model selector presets**: Gemma 4 4B / Gemma 2 9B / Qwen3.5 9B / Qwen3.5 4B selectable from UI; model family detected and system-prompt handling adjusted automatically

### Fixed
- **STT mic blocked after AI response**: `'final'` and `'error'` WebSocket message types now reset `isAIPlaying`, unblocking mic audio that was silently dropped when the AI finished speaking
- **Gemma 4 max-token starvation**: Gemma 4 spending all 150 tokens on thinking and producing no audible reply; token floor raised to 512 automatically for `gemma4` family
- **Large model download SIGPIPE**: HuggingFace shard progress output flooding the Tauri sidecar pipe; `HF_HUB_DISABLE_PROGRESS_BARS` + `max_workers=1` prevent `[Errno 32] Broken pipe`
- **Sidecar dev-mode server reuse removed**: Startup always evicts port occupant and spawns a fresh Python process in both dev and release, ensuring consistent behaviour and log capture

### Changed
- **ServerMessage TypeScript type**: `'final'` and `'error'` variants added to the discriminated union (were missing, causing implicit `any` downstream)
- **Local Brain UI label**: "Gemma 2 / Qwen / MLX" → "Gemma / Qwen / MLX"

## [0.12.0] - 2026-05-04 - Tauri-Only Architecture & De-Electron

### Added
- **Local LLM repetition penalty**: `repetition_penalty=1.1` and `repetition_context_size=20` added to MLX generation via `make_repetition_penalty` logits processor; prevents infinite loop on garbled STT input; configurable via `llm.providers.local` in settings

### Changed
- **Complete Electron removal**: `electron-bridge.ts`, all Electron npm packages, and Electron-specific main process code deleted; `ParceraAPI` bridge is now Tauri-only
- **Directory renamed**: `electron/` → `ui/` across all paths, scripts, configs, and AI agent memories
- **Settings key renamed**: `electron:` section in `settings.yaml` → `app:` — **update custom configs if needed**
- **Python schema aligned with TypeScript**: `ElectronSettings` → `AppSettings`, `ElectronWindows` → `AppWindows`, root `AppSettings` → `ParceraSettings`
- **mise tasks**: `tauri-dev` → `dev`, `tauri-build` → `build`; `package` task restored to run `prepare_sidecar.sh` before `tauri build` (prevents DMG without bundled Python sidecar)
- **Scripts**: `prepare_sidecar.sh/.ps1` and `generate_icons.sh` paths corrected from `electron/` to `ui/`

### Fixed
- **Mic worklet double-setup**: Concurrent `AudioWorklet` initializations no longer send duplicate PCM streams
- **PCM sample rate mismatch**: `audioContext.sampleRate` passed explicitly to worklet for WKWebView compatibility
- **Sidecar port eviction**: Stale process holding the port is killed on startup instead of failing silently
- **Avatar hover controls and log capture**: Fixed in release builds
- **STT sample rate / log export**: WKWebView sample rate mismatch resolved; log export via UI added
- **User lip-sync and zombie Python process**: Fixed audio pipeline and stale process handling
- **Dead code cleanup**: Removed breathe CSS remnants, unused state fields, diagnostic logging, and dead init message protocol

## [0.11.0] - 2026-04-30 - Tauri v2 Migration

### Added
- **Tauri v2 support**: Full migration from Electron to Tauri v2 as the primary desktop runtime; `ParceraAPI` bridge layer abstracts IPC so both Electron and Tauri renderers share the same API surface
- **Production Python sidecar**: `SidecarPaths` / `resolve_paths(app)` resolves Python binary and script paths from the bundled `resource_dir()` at runtime; `tauri.conf.json` bundles `python-runtime`, `site-packages`, and `python_src`
- **Preferences window**: Native macOS menu item (Cmd+,) opens a dedicated Preferences window via `open_preference_window` Tauri command
- **Training window**: `open_training_window` command and `broadcast_profiles_updated` IPC event for live profile reloads
- **Twitch OAuth → Python sync**: After token exchange, Rust backend calls `/twitch/init` with up to 10 retries so the Python sidecar is always in sync after authentication

### Changed
- **IPC abstraction**: All renderer code routes through `api` bridge; `tauri-bridge.ts` and `electron-bridge.ts` are selected at runtime via `__TAURI_INTERNALS__` detection
- **Model download/check URLs**: Fixed `tauri-bridge.ts` to use correct query-param endpoints (`/models/check?name=`, `/models/download?name=`) matching the Python FastAPI router
- **Port default unified**: `comm.ts` fallback corrected from 8080 → 8676; `buildWsUrl` / `buildServerUrl` pure helpers standardize all server URLs to `127.0.0.1`
- **Rust URL centralization**: `python_url(port, path)` helper in `python_client.rs` replaces five scattered `format!("http://127.0.0.1:...")` calls

### Fixed
- **AudioContext suspension in WKWebView**: Multiple event types (`pointerdown`, `click`, `keydown`) now attempt resume; retry after `getUserMedia` succeeds; debug overlay shows `ctx:state` for diagnosis
- **Peak meter blank lines**: Python stdout/stderr trimmed with `trim_end()` before `eprintln!` to remove double newlines
- **Zombie Python process detection**: `is_server_healthy()` TCP probe reuses an externally running server and emits `sidecar-ready` without double-spawning
- **RUST_LOG propagation**: `mise run tauri-dev` now sets `RUST_LOG=info`; startup diagnostic logs `[Parcera] Starting (RUST_LOG=...)` on launch

## [0.10.0] - 2026-04-28 - Windows Support & Library Updates

### Added
- **Windows support**: Python backend now runs cross-platform; `prepare_sidecar.ps1` script for Windows build preparation; Electron build config includes NSIS x64 target
- **Platform utilities**: New `src/core/platform_utils.py` as single source of truth for OS detection (`IS_WINDOWS`, `IS_MACOS`, `app_support_base()`)
- **`platform` API**: Exposed `window.electronAPI.platform` via contextBridge for renderer-side platform detection

### Changed
- **Local LLM hidden on Windows**: Settings UI no longer shows "Local Brain" option when running on Windows (mlx-lm is macOS/Apple Silicon only)
- **Optional packages path**: Now resolves to `%APPDATA%\Parcera\optional-packages` on Windows instead of macOS-only `~/Library/Application Support`
- **`xattr` quarantine removal**: Guarded by `IS_MACOS` so it doesn't run on Windows
- **Dependencies bumped**: `aiavatar`, `mlx-lm`, `google-genai`, `openai`, `azure-cognitiveservices-speech`, `fastapi`, `uvicorn`, `pydantic`, `moonshine-voice` updated to latest stable

### Fixed
- **Missing LoRA adapter crash**: `LocalLLMService._load_model` now falls back to base model instead of crashing when the configured adapter path no longer exists (e.g. after training run cleanup)
- **Repeated adapter-missing warnings**: Warning is now emitted once per path per session; `clear_cache()` resets the seen-set so a re-installed adapter is picked up after model reload

## [0.9.0] - 2026-04-27 - UI Refresh Completion & Local LLM Feature Restoration

### Added
- **LoRA profile manager**: New `LocalLLMProfileManager` component with blend-weight sliders, main-profile toggle (⭐), per-profile training window launch (📝), export (📤), delete (🗑️), and blend apply with intensity indicator
- **Inline import confirmation**: Replacing `window.prompt` (blocked by `contextIsolation`), import now shows an inline name field after directory selection
- **Google TTS voice settings**: Voice model dropdown, speaking rate, pitch, and volume gain sliders restored in CharacterSection
- **Local LLM model presets**: Gemma 2 9B, Qwen3.5 9B, Qwen3.5 4B (MLX) selectable in AdvancedSection

### Changed
- **Training UI consolidated**: Inline TrainingTab in AdvancedSection removed; all training access goes through the standalone training window
- **Blend intensity threshold**: Yellow warning now triggers at >120% (was >100%) to match the hint text about auto-balance
- **UI label**: "LoRA プロファイル管理" renamed to "追加学習" for clarity; create/import row moved above profile list

### Fixed
- **Local LLM model selection**: Provider branch was inverted — Gemma/Qwen presets were unreachable when `local` provider was selected
- **Speaker select NaN**: Radix UI `SelectItem` value cannot be empty string; replaced with `__none__` sentinel and guard in `onValueChange`
- **Training window background**: `body { background-color: transparent }` from chroma key CSS leaked into training window; wrapped in `bg-background` div
- **`blendWeights` state sync**: Weights now update on every `profileList` change (add/delete) instead of only on first load
- **HTTP error handling**: `handleDeleteProfile` and `handleCreateProfile` now check response status and surface errors instead of silently proceeding
- **`handleCreateProfile` race**: Removed fragile `setTimeout` — `openTrainingWindow` is now called synchronously after broadcast
- **Dead code removal**: 22 unused Tab-based components and their tests deleted (`LLMTab`, `TTSTab`, `VisualTab`, `TwitchTab`, `LocalLLMSettings`, and related sub-components)

## [0.7.1] - 2026-04-14 - AI Lip-Sync Fix & Type Safety Refactor

### Fixed
- **AI lip-sync**: Noise gate threshold (`vad.volume_db_threshold`) was incorrectly applied to AI window audio analysis, silencing clean TTS audio and preventing mouth animation. Fixed by skipping noise gate in `getEnvelope()` and `setNoiseGateDb()` for the AI avatar window
- **DevTools in production**: DevTools auto-opened in packaged builds. Re-commented `openDevTools()` call and added `devtools-opened` event handler to immediately close DevTools in non-dev builds (both avatar and settings windows)

### Changed
- **Type safety**: Replaced `settings: any` / `twitchSettings: any` / callback `any` props with proper `ParceraSettings` / `TwitchSettings` types across 15 settings components
- **TTSTab**: Added local `RawSpeaker`, `SpeakerOption`, `GoogleVoiceOption` interfaces; removed `spk: any` / `v: any` annotations
- **alert() → setStatus**: Replaced 10 browser `alert()` calls with `setStatus?.()` in TrainingTab (4), LocalLLMSettings (5), WindowSettingsSection (1); wired `setStatus` prop from parent components

## [0.7.0] - 2026-04-13 - Settings UI Redesign with shadcn/ui

### Added
- Full Settings UI redesign: replaced legacy tab-based layout with a responsive sidebar + section layout using shadcn/ui components
- New Information Architecture (IA) with 5 sidebar sections: キャラクター / マイク・入力 / 連携 / 詳細設定 / 開発者
- Tailwind CSS v4 + shadcn/ui component library (Button, Card, Select, Switch, Slider, Badge, Progress, Input, Textarea, Separator)
- Sidebar layout components: `SidebarLayout` and `SidebarNav` with "高度な設定" separator group and `aria-current` accessibility
- "このセクションをリセット" per-section restore-defaults button in footer
- `TrainingStatus` interface for type-safe training progress state
- Shared test mock helper `createBaseMockElectron()` for DRY test setup
- Specs: `docs/specs/ui-redesign/` (PRD + IA) and `docs/specs/optional-runtime-packages/` (PRD + TRD)

### Changed
- TrainingTab: shadcn UI rewrite with step sidebar (STEP 1–3), profile rename inline, `STEPS` constant hoisted to module scope
- TrainingTab: now visible only when LLM provider is set to `local` (LoRA fine-tuning is local-only)
- AvatarColumn: replaced legacy `CheckboxSetting` / inline styles with `Switch`, `Select`, `FieldRow`; `settings: any` → `settings: ParceraSettings`
- WindowSettingsSection: replaced `btn btn-primary` (cyan) with `Button variant="outline"`
- BreatheAnimationSettings: replaced `InputSetting`/`SettingGroup` with `Input` + `Label`; restored full label text
- `FieldRow` extended with optional `htmlFor` prop for label-input accessibility association
- `IntegrationSection`: removed `as any` casts — `getTwitchStatus()` now typed directly; event key array cast with explicit union type
- All 7 section test files migrated to use `createBaseMockElectron()` shared helper

### Fixed
- Right-side white space: added `w-full` to Settings root div (`#app` is flex container)
- Footer overlap: `SidebarLayout` changed from `h-screen` to `h-full`
- Select dropdown transparency: added missing `--color-popover` / `--color-popover-foreground` to `@theme inline` in Tailwind v4 config
- Sidebar active state contrast: `bg-primary/10` → `bg-primary/20` + `font-semibold`
- Step nav visual flash: always apply `rounded-r-md` regardless of active state (border-left flush)
- `persist_history` toggle: added description and cost warning text

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
