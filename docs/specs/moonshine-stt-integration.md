# PRD/TRD: Moonshine STT Integration [APPROVED]

## 1. 目的 (Objective)
Google DeepMind (Moonshine AI) が公開した新世代の ASR モデル **Moonshine** を Parcera に統合し、特にユーザーの「短い発話」に対するレスポンス速度を極限まで高める。

## 2. 背景 (Background)
Parcera の現在の主力である Kotoba-Whisper (Faster-Whisper) は非常に高精度ですが、入力音声が短くても一定のオーバーヘッド（30秒パディング等）が発生する特性があり、対話のテンポを阻害する要因となっていました。Moonshine は「可変長入力」に対応しており、数秒の短い声ならそれに応じた極めて短時間で推論が完了するため、会話の「鮮度」を高めることができます。

## 3. 実装要件 (Requirements)

### 3.1 機能要件
- **MoonshineRecognizer の追加**: `src/core/stt.py` に `SpeechRecognizer` インターフェースを実装した新クラスを追加。
- **モデル選択**: `tiny-ja` (高速・軽量) と `base-ja` (精度重視) を選択可能にする。精度と速度のバランスから、**`base-ja` を推奨デフォルト**とする。
- **手動ダウンロード管理**: `faster-whisper` と同様、Settings画面のボタン押下でダウンロードを開始し、進捗をSSE（Server-Sent Events）で通知する。
- **サンプリングレート変換**: Parcera が扱う 16kHz PCM (int16) を、Moonshine が期待する float32 配列 (-1.0 to 1.0) に変換して渡す。
- **既存 VAD との連携**: 既設の音声区間検出 (StandardSpeechDetector) が切り出した音声データをそのまま処理対象とする。

### 3.2 非機能要件
- **低遅延 (Low Latency)**: 1秒程度の発話に対し、300ms 以内の推論完了を目指す（`base-ja` 使用時でも十分達成可能）。
- **Apple Silicon 最適化**: MacBook 等の Apple Silicon 上で、ONNX / CoreML (利用可能な場合) または MPS を通じた効率的な推論。
- **軽量性**: `tiny-ja` モデルのバイナリサイズが 150MB 程度であることを活かし、ディスク容量負担を抑える。

## 4. アーキテクチャ (Architecture)

### 4.1 データの流れ
1. VAD が音声区間を検出 -> `bytes` (PCM int16)
2. `src/core/stt.py` 内で `np.frombuffer` -> `float32` 変換
3. `moonshine-voice` の推論エンジン実行
4. テキスト結果を連結

### 4.2 設定 (Settings)
`config.yaml` 経由で以下の設定を注入可能にする：
- `stt.provider`: "moonshine"
- `stt.providers.moonshine.model`: "tiny-ja" | "base-ja"
- `stt.providers.moonshine.flags`: 推論時の動作フラグ（デフォルト0: 一般的な推論）。

## 5. 設計詳細：モデルダウンロード
Moonshine の `download()` 関数は `faster-whisper` とは異なるキャッシュ先を持つため、`src/core/download.py` を共通化し、以下のフローを実装する：
1. `check_model_cached`: モデル名から Moonshine か否かを判別し、適切なキャッシュディレクトリを確認。
2. `download_model_with_progress`: `moonshine_voice.download()` のラッパーを実装し、SSE への進捗報告を行う。

## 5. 検証プラン (Verification)
- **動作確認**: `tests/test_stt_moonshine.py` による推論成功の確認。
- **ベンチマーク**: Kotoba-Whisper との推論時間比較ログの採取。
- **日本語精度**: 日本語の語彙（特に格闘ゲーム用語など）の誤認識率の主観評価。
