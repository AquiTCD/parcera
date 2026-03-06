# Personalized STT (MLX LoRA) TRD

## 1. アーキテクチャ概要 (Architecture Overview)
Electron（フロントエンド）とPython（MLXバックエンド）によるサイドカー構成を拡張し、
「データ収集（録音）」「MLX LoRA学習」「推論（アダプタ適用）」の3つのレイヤーを実装する。

## 2. 技術スタック (Technical Stack)
- **Learning Engine**: `mlx`, `mlx-examples` (Moonshine/Whisper LoRA実装)
- **Audio Processing**: `librosa`, `pydub` (16kHz, Mono, Normalized WAV)
- **Data Management**: JSONL (`{"audio": "path", "sentence": "text"}`)
- **Backend Communication**: HTTP POST or WebSocket (Fast API/Socket.IO)

## 3. 実装フェーズ (Implementation Phases)

### Phase 1: データ収集とバリデーション (Data Orchestration)
- **Electron側**: `Web Audio API` を使用し、学習用フレーズに対するユーザーの音声をWAV形式で録音。
- **データ転送**: 録音されたWAVと、対応するテキスト情報をPythonバックエンドへPOST送信。
- **Python側**: 受信したデータを `training_data/wavs/` に保存し、`data.jsonl` を自動生成・更新。
- **データ検証**: `librosa` 等を用いて、無音検出や振幅正規化を行う。

### Phase 2: モジュール型プロファイルと学習 (Profile-based Training)
- **プロファイル構造**:
  ```text
  adapters/{profile_id}/
    ├── adapter.safetensors # LoRA weights
    ├── metadata.json       # {name, author, base_model, created_at}
    ├── data.jsonl          # dataset index
    └── wavs/*.wav          # source audio
  ```
- **学習実行**: `mlx` による LoRA 全結合層の学習。
- **成果物**: `adapter.safetensors` (MLX標準形式、数MB)

### Phase 3: 推論エンジンへの統合 (Multi-Adapter Inference)
- **アダプタ・ロード**: Moonshineモデルのロード時に、複数の `adapter.safetensors` を動的にインジェクト。
- **マージ戦略 (MLX)**:
  - `mlx.core.add` または `weighted sum` による線形マージ。
  - 推論時に `adapters=[(path1, alpha1), (path2, alpha2)]` のようにリストで指定可能にする。
- **動的切り替え**: ユーザーがUIからプロファイルを有効/無効化するたびに、サイドカー側でモデルの重みを再構成。

## 5. 実装状況とロードマップ (Status & Roadmap)

### 5.1 フェーズ 3 の完了 (2026-03-06)
- **ステータス**: エンジン・ブロック (Engine Blocked)
- **完了した作業**: 
    - `TrainingService.merge_adapters` による LoRA 重みの合成ロジック。
    - アルファブレンディング用の UI コンポーネント。
- **課題**: Moonshine C-API の LoRA 対応待ちのため、実際の推論への反映は保留。

### 5.2 技術的ロードマップ
- **独立ウィンドウ化**:
    - Electron の `BrowserWindow` を新規作成し、メインウィンドウとは独立して学習プロセスを管理する。
    - メインスレッドの負荷を軽減し、音声録音の安定性を向上させる。
- **LLM 動的フレーズ生成**:
    - `IntelligenceService` (仮) 経由でローカル LLM に接続。
    - プロンプト：「以下の単語リストを含む、自然な話し言葉の例文を10個作成して：[単語リスト]」
- **フレーズ管理 DB**:
    - 学習フレーズを SQLite 等で管理し、ユーザーが CRUD 操作を行えるようにする。
    - カテゴリ（「日常会話」「ゲーム用語」）ごとの学習プロパティをサポート。
