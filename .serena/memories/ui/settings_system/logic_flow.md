# GUI Settings System (React & IPC)
The settings system is a React-based UI that communicates with the Electron Main process via IPC to manage YAML-based configurations.

## Flow & Components
- **Persistence**: Main process reads/writes YAML. Renderer uses `useSettingsState` (with `updateNested` helper) for immutable state management.
- **Syncing**: Saving settings triggers an IPC call to the Main process, which updates the file and notifies the Python sidecar via a POST request.
- **Tabs**:
  - `LogTab`: Streams real-time logs from Python (limited to 100 entries for performance).
  - `STTTab`: Manages model status and progress tracking (SSE/Polling).
Reference: docs/specs/gui-settings-system/TRD.md
