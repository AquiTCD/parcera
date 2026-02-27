# TRD: Core Avatar Engine

## 1. システム構成 (Architecture)
Python 3.11+ 上で動作し、FastAPI による WebSocket サーバーを介してフロントエンドと通信する。

### 1.1 使用技術
- **Core Framework**: `aiavatar` (Python package)
- **API Framework**: FastAPI / WebSockets
- **LLM**: Gemini API (Google), OpenAI API
- **STT**: `faster-whisper` (Local), Google Cloud STT, Azure STT
- **TTS**: Voicevox / AivisSpeech (Local API)

## 2. 実装詳細 (Implementation Details)

### 2.1 コンポーネント・ファクトリ (`src/core/factory.py`)
`ParceraComponentFactory` クラスが設定に基づき各インスタンス（LLM/STT/TTS/VAD）を動的に生成する。
- **STT**: `KotobaWhisperRecognizer` (CTranslate2) を使用し、Macでの実行時はMPSの有無を自動判定（現在はCPU+int8に安全に倒す設定）。
- **LLM Wrapper**: プロファイリング（思考時間計測）やプロンプトの動的結合を行う。

### 2.2 通信プロトコル
WebSocket (`ws://localhost:{port}/ws`) を使用。
- **Downlink (Engine -> Frontend)**: 
    - `audio`: Base64エンコードされた音声データ。
    - `text`: 文字起こし結果やAIの回答テキスト。
    - `metadata`: 感情解析結果など（将来用）。
- **Uplink (Frontend -> Engine)**: 
    - 現在は音声は各Renderer（マイク）で処理されるため、主に「Busy状態」や「設定更新」の同期に使用。

## 3. データ定義 (Data Structures & Storage)

### 3.1 会話履歴 (ERD / Database Schema)
- **SQLite**: `~/Library/Application Support/Parcera/aiavatar.db`
- `aiavatar` ライブラリの `SQLiteContextManager` が管理する以下のテーブル構造を持つ。

#### テーブル: `message`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key (Auto Inc) |
| `session_id` | TEXT | 会話セッションID |
| `role` | TEXT | `user`, `assistant`, `system` |
| `content` | TEXT | 発話テキスト |
| `created_at` | TIMESTAMP | 発話日時 |

### 3.2 設定管理 (`src/core/config.py`)
- `configs/settings.default.yaml` とユーザー設定を `deep_merge`。
- プロンプトのプレースホルダ置換（`${userName}` など）を実行時に行う。

## 4. フィルタリング・アルゴリズム (`src/core/filters.py`)
- **ResponseWeightFilter**: 
    - 文長に基づく確率制御（短すぎる発話は無視）。
    - 登録された `force_keywords` が含まれる場合は確率 1.0 で反応。
    - `ignore_sentences` に含まれるフレーズは無視。

#### 4.1 反応確率プリセット (Response Probability Presets)
文の重み（Weight = 文字数 + 漢字数）に基づくシグモイド関数による確率制御。

| プリセット | midpoint | slope | max_prob | 特徴 |
| :--- | :---: | :---: | :---: | :--- |
| **high** (頻繁) | 12.0 | 0.15 | 0.80 | 短い言葉（W=10）で34%、長い言葉や重要な発言で約80%反応。 |
| **medium** (普通) | 18.0 | 0.10 | 0.60 | 短い言葉で18%、文字数が増えても最大60%に抑えた自然な反応。 |
| **low** (低い) | 20.0 | 0.12 | 0.50 | 短い言葉は10%程度、長くても最大50%に抑制された控えめな挙動。 |
