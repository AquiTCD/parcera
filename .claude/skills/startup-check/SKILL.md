---
description: Mandatory Startup Check Procedure for Parcera
---

# Parcera Mandatory Startup Check (Quality Gate)

**Purpose**: To ensure that the agent does not confidently report a task as complete if the application fails to start up due to subtle runtime errors, dependency issues, or configuration bugs. This is a strict verification gate.

## When to Use This Skill

You **MUST** follow this procedure and verify its success before declaring any code refactoring, feature addition, or configuration change complete. A successful `pytest` run or `tsc` compilation is **not** enough. You must confirm the runtime environment stands up successfully.

> [!IMPORTANT]
> **Environment Dependency Check**:
> - 外部パッケージ (`python-multipart`等) が `pyproject.toml` に正しく追加されているか。
> - 外部オーディオバイナリ (`ffmpeg`, `ffprobe`, `afconvert`) が環境に存在するか。
> - もしバイナリがない場合、フォールバックパス（例: Macでの `afconvert` 使用）が正しく機能するかをランタイムで確認すること。

## Procedure

1. **Start the Application Stack**:
   Use the `Bash` tool with `run_in_background: true` to execute `mise run dev`. Allow sufficient time (e.g., 8000ms) to catch immediate startup crashes.
   ```bash
   mise run dev
   ```

2. **Verify Backend Status (`run_server.py`)**:
   Use the `TaskOutput` tool to read the background task's stdout. Wait for and explicitly confirm the presence of log lines analogous to:
   - `INFO: Application startup complete.`
   - `LLM: Warm-up complete.`
   - `TTS Engine is already running...`

3. **Verify Frontend Status (`vite` / `electron` builder)**:
   Ensure there are no compilation crashes or severe Electron runtime errors in the task output.

4. **Handle Failures**:
   If the process crashes with a stack trace (e.g. `ModuleNotFoundError`, `AttributeError`, `PydanticValidationError`), you MUST:
   - Acknowledge the failure.
   - Stop the background task using the `TaskStop` tool.
   - Debug and fix the root cause.
   - Re-run this procedure from Step 1 until success is achieved.

5. **Terminate Processes**:
   Once both backend and frontend have started and warmed up without fatal errors, use the `TaskStop` tool to terminate the background process before reporting completion to the user.
