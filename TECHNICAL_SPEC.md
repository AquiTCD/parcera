# Technical Specification: Parcera

## 1. System Overview

Parcera is a real-time AI Avatar system running locally on macOS. It captures audio input, processes it through an LLM, and outputs audio and visual (avatar) feedback using AivisSpeech for high-quality voice synthesis.

## 2. Architecture

### 2.1 Technology Stack
- **OS**: macOS
- **Runtime**: Python 3.11+ (Managed by `mise`)
- **Dependency Management**: `uv` (Standard `pyproject.toml`)
- **Core Framework**: `aiavatar` (Python package)

### 2.2 Data Flow
1.  **Audio Input (STT)**:
    - Microphone captures user voice.
    - Converted to text via standard STT providers (Google/OpenAI Whisper).
2.  **Processing (LLM)**:
    - Text sent to LLM Service (OpenAI/Anthropic/Local).
    - System prompt defines the avatar's persona.
3.  **Output Generation (TTS & Animation)**:
    - **TTS Engine**: [AivisSpeech](https://github.com/Aivis-Project/AivisSpeech) (Local API).
    - **Port**: Default `10101` (VOICEVOX compatible).
    - Audio analysis drives Lip-Sync.
    - Sentiment analysis drives Expressions/Motions.
4.  **Presentation Layer**:
    - Standalone Window (PyQt / PySide / Custom UI).
    - Transparent background option for OBS overlay.

## 3. Environment & Development

### 3.1 Dependency Strategy
- **Python Version**: Locked in `.python-version` (for `mise`).
- **Virtual Environment**: Managed by `uv` in `.venv`.
- **Dependencies**:
    - `aiavatar`
    - `python-dotenv` (for secrets)
    - `aiohttp` (often needed for API calls)

### 3.2 Configuration
- **Secrets**: `.env` (API Keys).
- **TTS Config**: Connects to AivisSpeech at `http://127.0.0.1:10101`.
- **Avatar Config**: `config.yaml` or python dict setup.

## 4. Milestones

1.  **Environment Setup**: `mise` + `uv` configured. `aiavatar` installed. **(Done)**
2.  **Hello World**: Script that listens, thinks, and speaks back (CLI only, verifying STT/LLM/TTS pipeline).
3.  **Avatar GUI**: Basic window showing the avatar image/model.
4.  **Animation Sync**: Lip-sync working with AivisSpeech audio.
5.  **OBS Integration**: Transparency and layout refinement.
6.  **(Bonus) User Avatar**: Reactivity to user audio.

## 5. Security Note regarding API Keys
- Never commit `.env` files.
- Use `python-dotenv` to load keys.
