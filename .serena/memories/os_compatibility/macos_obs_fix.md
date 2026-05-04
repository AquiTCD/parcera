# macOS OBS Capture Fix
Implemented a fix to prevent animation throttling when the Tauri window is in the background or occluded.
Key steps:
1. Implemented a 1px "heartbeat" animation in the renderer to keep frames updating.
Reference: docs/knowledge/obs_capture_mac_fix.md

# Git configuration
Root `build/` ignore was changed to `/build/` to prevent ignoring `ui/build` resources like `icon.icns`.
