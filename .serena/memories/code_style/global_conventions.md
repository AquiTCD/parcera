# Global Coding Standards & Conventions

## Python (Backend)
- **Style**: PEP 8.
- **Async**: Mandatory use of `asyncio`.
- **Logging**: Centrally managed in `src/core/config.py`. Always use `logging.getLogger(__name__)`.
- **Patterns**: Component instantiation MUST go through `ParceraComponentFactory`.

## TypeScript/React (Frontend)
- **Type Safety**: Strict typing with TypeScript. Prefer interfaces over types for objects.
- **State**: Use immutable updates (e.g., spread operators or helper utilities).
- **Style**: Vanilla CSS with CSS Variables for theme consistency.

## macOS/Tauri Specifics
- **OBS Capture**: Keep "Heartbeat" animations (1px/2s) active to prevent WebView throttling in the background.
- **Window**: Tauri window settings (always-on-top, transparency) are configured via `src-tauri/tauri.conf.json`.

## Git Protocol
- **English Only**: All commit messages must be in English.
- **Atomic**: 1 logical task = 1 commit. NO mixed refactors/feats.
- **Conventional**: Use standard prefixes (`feat`, `fix`, `chore`, etc.).
