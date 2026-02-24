# Motion PNG Visual System (Lip-Sync & Animation)
The visual system handles lip-sync, blinking, and natural movement in the Electron renderer.

## Core Features
### 1. Lip-Sync & Audio Analysis
- **RMS Power**: Calibrates volume detection using settings like `volume_db_threshold`.
- **Vowel Estimation**: Detects "a, i, u, e, o" by analyzing spectral centroids with the Web Audio API. 
- **Persistence**: Uses `mouth_hold_time` to prevent jittery mouth movements.

### 2. Animation Engine
- **Breathing**: Uses JS-driven transform updates with 1/f fluctuation logic (see `avatar/animation/breathing_mechanics`).
- **Blinking**: Randomized based on `blink_interval_min` and `max`.

## Assets & State
- **Structure**: Static PNG layers (`base.png`, `eyes_*.png`, `mouth_*.png`) are toggled based on the reactive `AvatarState`.
Reference: docs/specs/motion-png-visualS/TRD.md
