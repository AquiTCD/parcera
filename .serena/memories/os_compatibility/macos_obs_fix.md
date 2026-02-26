# macOS OBS Capture Fix
Implemented a fix to prevent animation throttling when the Electron window is in the background or occluded.
Key steps:
1. Added `--disable-renderer-backgrounding` and `--disable-backgrounding-occluded-windows` switches.
2. Set `backgroundThrottling: false` and `disableOcclusionTracking: true` in BrowserWindow webPreferences.
3. Implemented a 1px "heartbeat" animation in the renderer to keep frames updating.
Reference: docs/knowledge/obs_capture_mac_fix.md

# Git configuration
Root `build/` ignore was changed to `/build/` to prevent ignoring `electron/build` resources like `icon.icns`.
