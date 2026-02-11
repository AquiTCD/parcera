---
description: Start the Parcera AI Avatar (Gemini + Local Whisper + AivisSpeech)
---
// turbo-all
# Parcera Execution Workflow

This workflow starts the AI Avatar with the current configuration.

## Prerequisites
1. Ensure **AivisSpeech** is running at `http://127.0.0.1:10101`.
2. Ensure `.env` has a valid `GOOGLE_API_KEY`.

## Steps
1. Synchronize dependencies
```bash
uv sync
```

2. Run the Avatar
```bash
uv run python src/run.py
```

3. Enjoy talking with Parcera!
