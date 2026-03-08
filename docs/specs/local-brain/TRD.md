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
ユーザーの好みに合わせて LLM 独自の LoRA アダプタを作成・適用する。
- **データ生成 (Teacher LLM 連携)**: 
  - **クレンジング**: 外部 LLM（Gemini 等）を使用し、誤字脱字の修正およびパルセラらしい回答への「自問自答形式 (Q&A)」への変換。
  - **添削ステータス**: DB 上で `pending / ok / correction / ignored` を管理。`ok` および `correction` のみを学習対象とする。
- **Web/Text インポート**: 
  - URL スクレイピングから得た情報を Teacher LLM もしくはローカル LLM で要約し、対話データに変換。
- **LoRA学習実行**:
  - `mlx_lm.lora --train` モジュールをバックグラウンドで実行。
  - **手動実行**: ユーザーが UI の「特訓開始」ボタンを押した際のみ実行。
- **独立したアダプタ管理**: 
  - `adapters/llm/{profile_id}/` 以下のフォルダ構成。
  - STT 用アダプタとは独立して管理し、粒度の異なる知識や性格を自由に組み合わせて適用可能にする。

## 4. 運用上の考慮事項 (Operational Notes)
- **メモリ消費**: 
  - Gemma 2 9B (4-bit) は推論に約 6GB 必要。
  - 学習時にはさらに 2-4GB 程度のヘッドルームが必要となる。
- **プロンプト最適化**: 
  - LoRA 側に性格や口調（ギャル風）を焼き込むことで、従来 LLM で必要だった長いシステムプロンプト（Context Injection）を削減し、推論速度の向上を狙う。
- **バリデーション**:
  - 学習後に知識が壊れていないか（Catastrophic Forgetting）を確認する、最小限のベンチマーク機能の検討。
