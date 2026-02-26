# Natural Breathing Mechanics (1/f Fluctuation & Golden Ratio)
Implemented breathing animations using 1/f fluctuation (pink noise) and the golden ratio (1.618...) to create a natural, "living" feel for the avatar.

## Implementation Details
- Uses `performance.now()` for frame-rate independent timing.
- Combines two sine waves at frequencies related by the golden ratio to prevent repetitive resonance.
- Values are injected into CSS variables (`--breathe-offset-y`, etc.) for efficient GPU rendering via `transform`.
Reference: docs/knowledges/breathing_mechanics.md
