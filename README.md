# Parcera

**Parcera** は、macOS上で動作するAIアバタープロジェクトです。
あなたの声を認識し、LLM（大規模言語モデル）で生成された応答を、アニメーション付きのアバターが音声合成（TTS）で返します。

最終的には、OBSなどの配信ソフトでキャプチャ可能な独立したウィンドウとして動作することを目指しています。

## コア技術

- **コアライブラリ**: [aiavatar](https://github.com/uezo/aiavatarkit) (PyPI名: `aiavatar`)
- **言語**: Python (3.11+)
- **パッケージマネージャ**: `uv` (`mise`管理下のPythonで動作)
- **環境**: macOS (最適化対象)
- **TTS**: VOICEVOX 互換API (本プロジェクトでは [AivisSpeech](https://github.com/Aivis-Project/AivisSpeech) を推奨)

## 機能

- **STT (音声認識)**: ユーザーの声をリアルタイムで認識。
- **LLM 統合**: 会話の応答を生成。
- **TTS (音声合成)**: VOICEVOX互換エンジン（AivisSpeech等）を使用してアバターが発話。
- **アバターアニメーション**: リップシンク（口パク）と待機/アクションモーション。
- **OBS 対応**: 背景透過などでOBSのソースとして利用可能。
- **(Planned) ユーザーアバター**: ユーザーの声や動きに反応する別のアバターも同時表示。

## セットアップ

### 前提条件

- **Python**: `mise` で管理 (v3.11系推奨)。
- **パッケージマネージャ**: `uv`。
- **システム依存**: `portaudio` (音声入出力に必須)。
- **TTSエンジン**: [AivisSpeech](https://github.com/Aivis-Project/AivisSpeech) または [VOICEVOX](https://voicevox.hiroshiba.jp/) がインストールされ、起動していること。

**PortAudioのインストール (必須):**
```bash
brew install portaudio
```

### インストール

```bash
# 依存関係のインストール
uv sync
```

### 設定

環境変数を設定するために、`.env` ファイルを作成してください。

```bash
cp .env.example .env
```

`.env` を開き、必要な設定を行ってください。
TTSの設定は、使用するエンジン（AivisSpeechやVOICEVOX）に合わせて `TTS_API_URL` と `TTS_SPEAKER_ID` を調整してください。

### 実行方法

(TBD)
