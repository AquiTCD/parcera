# Spec: Minimal Viable Avatar (MVA)

## 1. Goal
Implement a minimal end-to-end loop where:
1. User speaks into the microphone (STT).
2. The system generates a response using an LLM (Processor).
3. The avatar speaks the response back using AivisSpeech (TTS).

This milestone validates the core technological stack: `speech_recognition` (input), `OpenAI API` (processing), and `AivisSpeech` (output) within the `aiavatar` framework.

## 2. Components & Requirements

### 2.1 Speech-to-Text (STT)
- **Library**: `speech_recognition` (via `aiavatar.listeners.VoiceListener`).
- **Input**: Default system microphone on macOS.
- **Language**: Japanese (`ja-JP`).
- **Behavior**:
    - Listens for voice input.
    - Detects silence to determine end of utterance.
    - Converts audio to text.
    - Logs recognized text to console.

### 2.2 LLM Processor
- **Library**: `openai` (via `aiavatar.processors.ChatGPTProcessor`).
- **Model**: `gpt-3.5-turbo` or user-specified via env.
- **System Prompt**: Minimal persona (e.g., "You are an AI assistant named Parcera.").
- **Behavior**:
    - Receives text from STT.
    - Generates a text response.
    - Logs response text to console.

### 2.3 Text-to-Speech (TTS)
- **Library**: `aiohttp` / `aiavatar.speech.voicevox.VoicevoxSpeechSynthesizer`.
- **Engine**: AivisSpeech (running locally).
- **Configuration**:
    - URL: `http://127.0.0.1:10101` (from env `TTS_API_URL`).
    - Speaker ID: `888753760` (from env `TTS_SPEAKER_ID`).
- **Behavior**:
    - Receives text from LLM.
    - Synthesizes audio.
    - Plays audio via default output device (`sounddevice` / `portaudio`).

### 2.4 Application Entry Point
- **File**: `src/run.py`
- **Behavior**:
    - Loads environment variables.
    - Initializes STT, LLM, and TTS components.
    - Starts the `AIAvatar` application loop.
    - Gracefully handles shutdown (Ctrl+C).

## 3. Implementation Plan

### Step 1: TTS Validation (`specs/01_tts_validation.md`)
- Create `scripts/check_tts.py`.
- Verify connection to AivisSpeech.
- Verify audio output (file save or playback).
- **Success Criteria**: A WAV file is generated with audible speech.

### Step 2: Microphone Validation (`specs/02_mic_validation.md`)
- Create `scripts/check_mic.py`.
- Verify microphone access on macOS.
- Verify SpeechRecognition works.
- **Success Criteria**: Script prints recognized text from user's voice.

### Step 3: Integration (`specs/03_core_loop.md`)
- Create `src/run.py`.
- Assemble `AIAvatar` with VoiceListener, ChatGPTProcessor, and VoicevoxSpeechSynthesizer.
- **Success Criteria**: User speaks "こんにちは", Avatar responds with voice.

## 4. Environment Variables (Required in .env)
```
OPENAI_API_KEY=sk-...
TTS_API_URL=http://127.0.0.1:10101
TTS_SPEAKER_ID=888753760
```
