# Packaging & Runtime (Portable Sidecar)
Parcera is packaged as a standalone arm64 `.app` using a portable Python interpreter (stable sidecar approach).

## Key Strategy
- **Runtime**: `python-build-standalone` (arm64-apple-darwin).
- **Dependency Diet**: Swaps standard `torch` for `faster-whisper` (CTranslate2) to reduce bloat by ~600MB.
- **Python Structure**: Resources include a portable interpreter, source code, and a pre-installed `site-packages` directory.

## Lifecycle Management
- **Guardian Process**: Electron manages the sidecar lifecycle (Auto-boot, Health checks, Zombie prevention via SIGTERM).
- **Distribution**: Uses Hardened Runtime and Notarization. Models are downloaded on-demand to User Data paths.
Reference: docs/specs/packaging-runtime/TRD.md
