# AI Interaction Pipeline TRD

## 1. Component State Management

### 1.1 State Holder (`ParceraAvatarBase`)
- **Storage**: `_busy_sessions: dict[str, asyncio.TimerHandle]`
- **Interface**:
  - `is_busy(session_id)`: Bool check for key existence.
  - `set_busy(session_id, busy_state, timeout)`:
    - If `busy_state=True`: Clear old timer, inject new one.
    - If `busy_state=False`: Clear old timer, remove key.

### 1.2 STT Pre-processing Logic (`stt.py`)
- **Hook Placement**: `KotobaWhisperRecognizer.recognize` must perform the `is_busy` check **before** entering the `transcribe` block.
- **Immediate Flagging**: Call `set_busy_handler(True)` immediately after the initial `is_busy` check.

### 1.3 Duration Estimator (`run_server.py`)
- **Weight Logic Implementation**:
  ```python
  def calculate_weight(text: str) -> float:
      kanji_pattern = r'[\u4E00-\u9FFF]'
      kanji_count = len(re.findall(kanji_pattern, text))
      return len(text) + kanji_count
  ```
- **Application**: 
  - Weight Filter uses this to judge responsiveness.
  - `on_response` uses this to estimate `timeout = (weight / 6.0) + 1.0`.

## 2. Interaction Sequence

1.  **VAD Segment Arrival**: `aiavatar` calls `stt.recognize`.
2.  **Busy Guard**:
    -   If `avatar.is_busy()` -> Return `EmptyResult`. **Crucial**: No logs, no Whisper.
3.  **Busy Initiation**: Call `avatar.set_busy(True)` (Default 60s safety).
4.  **Transcription**: Whisper runs in thread executor.
5.  **Filter Logic**:
    -   If `filters.should_respond(text)` is `False`:
        -   Call `on_recognized(text, is_filtered=True)`.
        -   *Server Behavior*: Log in **White**, call `avatar.set_busy(False)`.
        -   Return `EmptyResult`.
    -   If `True`:
        -   Call `on_recognized(text, is_filtered=False)`.
        -   *Server Behavior*: Log in **Cyan**.
        -   Return `text`.
6.  **AI Cycle**: `aiavatar` sends prompt to LLM -> LLM streams to TTS.
7.  **Completion Hook**: `on_response(final)`:
    -   Calculate weight-based duration.
    -   Update `avatar.set_busy(True, timeout=estimation)`.

## 3. Safety & Edge Cases
- **Safety Timeout**: Every `set_busy(True)` has a 60s hard limit to prevent the avatar from getting stuck in an "engine hang" state.
- **Filter Precision**: The `ResponseWeightFilter` and the `DurationEstimator` must use the exact same Weight logic to maintain perceptual consistency.
