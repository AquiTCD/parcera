# Spec: Parcera Brush-up (STT/TTS/Prompt Enhancements)

## 1. Goal
Improve the quality and flexibility of Parcera's interaction by upgrading STT, fine-tuning TTS, and externalizing prompt management.

## 2. Requirements

### 2.1 STT (Speech-to-Text) Upgrade
- **Model**: Use `kotoba-whisper-v1.1` (`distil-large-v3`).
- **Implementation**: Needs to support Japanese effectively and handle the "distil" architecture.
- **Initial Prompt**: Load from `prompts/stt_initial_prompt.md`. Used to bias the STT towards specific words (frequent terms, names, etc.).

### 2.2 TTS (Text-to-Speech) Fine-tuning
- **Target**: AivisSpeech (VOICEVOX compatible).
- **Parameters**: 
  - `speedScale`: 1.25
  - `intonationScale`: 0.7
  - `volumeScale`: 0.50
  - `prePhonemeLength`: 0
  - `postPhonemeLength`: 0.20
- **Logic**: Ensure these are passed in the audio query to AivisSpeech.

### 2.3 Prompt Management
- **System Prompt (Persona)**: Move to `prompts/system_prompt.md`. Defines character traits and tone.
- **Additional Context**: Move to `prompts/context_prompt.md`. Any dynamic or auxiliary info.
- **Loading Logic**: Read these files at startup.

### 2.4 Response Filtering (Reactivity Control)
- **Objective**: Don't respond to every single sound; avoid being too talkative unless addressed.
- **Logic**:
  - **Weighting**: Probability of response increases with transcript length.
  - **Force Keywords**: If specific keywords (e.g., "パルセラ", "どう？") are detected, respond 100%.
  - **Threshold**: Set a base threshold or formula to decide.

## 3. Implementation Plan

### Phase 1: File Structure & Prompts
1. Create `prompts/` directory.
2. Create `prompts/stt_initial_prompt.md`.
3. Create `prompts/system_prompt.md`.
4. Create `prompts/context_prompt.md`.

### Phase 2: TTS & STT Upgrade
1. Update `LocalWhisperRecognizer` to use `kotoba-whisper-v1.1`.
2. Implement `initial_prompt` loading in `LocalWhisperRecognizer`.
3. Update TTS calling logic (or `AIAvatar` config) to include the new parameters.

### Phase 3: Response Filter
1. Create a `ResponseFilter` class or logic.
2. Integrate it into the turn-taking loop of `AIAvatar`.

### Phase 4: Integration
1. Update `src/run.py` to use the new components and load files.
