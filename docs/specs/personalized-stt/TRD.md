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

## 4. セキュリティと安定性 (Security & Stability)
- **完全ローカル実行**: 録音データおよび学習済みアダプタはユーザーのマシン内にのみ保持される。
- **VRAM制御**: 学習中のメモリ不足（OutOfMemory）を防ぐため、他プロセスの負荷を監視し、必要に応じてバッチサイズやスケジューリングを調整。
- **優先度制御**: フロントエンドのレンダリングを阻害しないよう、学習プロセスは低優先度（Low Priority）で実行する。
