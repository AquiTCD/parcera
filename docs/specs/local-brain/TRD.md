# Local Brain (Gemma 2 MLX) TRD

## 1. アーキテクチャ概要 (Architecture Overview)
Python サイドカーサーバーに `mlx-lm` を統合。
推論（Inference）と学習（Fine-tuning）の双方を MLX フレームワークで完結させる。

## 2. 技術スタック (Technical Stack)
- **LLM Library**: `mlx-lm`
- **Model**: `google/gemma-2-9b-it` (4-bit quantization推奨)
- **Framework**: `mlx` (Metal Performance Shaders)

## 3. 実装フェーズ (Implementation Phases)

### Phase 1: ローカル推論の統合 (Inference Pipeline)
学習なしで Gemma 2 を動かす基盤を構築する。
- **モデル・プロビジョニング**: 初回起動時に Hugging Face から量子化モデルを自動ダウンロードする仕組み。
- **mlx-lm 統合**: Python バックエンドに推論用クラスを実装。
- **ストリーミング API**: Electron フロントエンドへ文字単位でトークンを送信する WebSocket/SSE エンドポイント。
- **初期パラメータ**: `max_tokens: 50-100`, `temperature: 0.7-0.8` (ギャルらしい揺らぎの創出)。

### Phase 2: 学習機能とパーソナライズ (Training Pipeline)
ユーザーの好みに合わせて LoRA アダプタを作成・適用する。
- **データ生成**: 
  - 会話ログから `{"text": "<start_of_turn>user\n[Q]<end_of_turn>\n<start_of_turn>model\n[A]<end_of_turn>"}` 形式の JSONL を出力。
- **LoRA学習実行**:
  - `mlx_lm.lora` モジュールをサブプロセスとしてキック。
  - **リソース制限**: GPU メモリ占有率を監視し、学習中のシステム安定性を確保。
- **アダプタ管理**: 
  - 生成された `adapters.npz` のメタデータ管理。
  - 推論モデルロード時に `--adapter-path` を指定して動的に適用。

## 4. 運用上の考慮事項 (Operational Notes)
- **メモリ消費**: 
  - Gemma 2 9B (4-bit) は推論に約 6GB 必要。
  - 学習時にはさらに 2-4GB 程度のヘッドルームが必要となる。
- **プロンプト最適化**: 
  - LoRA 側に性格や口調（ギャル風）を焼き込むことで、従来 LLM で必要だった長いシステムプロンプト（Context Injection）を削減し、推論速度の向上を狙う。
- **バリデーション**:
  - 学習後に知識が壊れていないか（Catastrophic Forgetting）を確認する、最小限のベンチマーク機能の検討。
