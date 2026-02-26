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

## macOS/Electron Specifics
- **OBS Capture**: Always set `backgroundThrottling: false` and `disableOcclusionTracking: true`.
- **Updates**: Apply `--disable-renderer-backgrounding` and related CLI switches in `main/index.ts`.
- **Performance**: Use "Heartbeat" animations (1px/2s) to keep frames updating in background.

## Git Protocol
- **English Only**: All commit messages must be in English.
- **Atomic**: 1 logical task = 1 commit. NO mixed refactors/feats.
- **Conventional**: Use standard prefixes (`feat`, `fix`, `chore`, etc.).
