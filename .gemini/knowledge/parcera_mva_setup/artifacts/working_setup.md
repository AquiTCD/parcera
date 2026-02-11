
# Parcera Minimal Viable Avatar (MVA) Setup

This document records the final working configuration for the Parcera MVA.

## Architecture
- **STT**: Local Whisper (`openai-whisper`, model: `base`). Implemented via `LocalWhisperRecognizer` in `src/run.py`.
- **LLM**: Google Gemini 2.5 Flash. Implemented via `FixedGeminiService` in `src/gemini_fix.py` to fix serialization issues during context updates.
- **TTS**: AivisSpeech/VOICEVOX compatible engine. Running on `http://127.0.0.1:10101` (Speaker ID: `888753760`).
- **VAD**: Standard volume-based VAD (`StandardSpeechDetector`). Threshold tuned to `-25.0dB` based on noise floor measurements.

## Core Files
- `src/run.py`: Entry point using custom recognizer and fixed Gemini service.
- `src/gemini_fix.py`: Contains `FixedGeminiService` which overrides `update_context` to handle dict/Pydantic model serialization for SQLite storage.
- `.env`: Contains `GOOGLE_API_KEY`, `TTS_API_URL`, and `TTS_SPEAKER_ID`.

## Key Fixes Applied
1. **Gemini 429/404 Errors**: Switched to `gemini-1.5-flash-latest` then `gemini-2.5-flash` to find a working quota/naming scheme.
2. **Context Persistence**: Fixed `Invalid context_id` by ensuring `update_context` correctly serializes messages to JSON-compatible dicts before SQLite insertion.
3. **TTS Connection**: Fixed connection error by using `tts_voicevox_url` and `tts_voicevox_speaker` parameters in `AIAvatar` constructor instead of the default `voicevox_url`.
4. **VAD Download Blocker**: Replaced `SileroSpeechDetector` (which requires downloading models) with `StandardSpeechDetector` for immediate offline usage.
