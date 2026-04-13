# PRD: Optional Runtime Packages & Lazy Import Optimization

## 1. 目的 (Objective)

アプリバンドルサイズと起動時メモリ使用量を削減する。
現状 ~960MB のアプリサイズを ~500MB 以下に、Gemini/OpenAI 使用時の起動メモリを削減することを目標とする。

`packaging-runtime` TRD で掲げた「< 300MB (excluding models)」の目標を達成するための具体的な施策。

## 2. 背景 (Context)

現状のアプリバンドル構成（実測値）:

| コンポーネント | サイズ | 問題 |
|---|---|---|
| Electron Framework (Chromium) | 258MB | Tauri移行で削減予定（別spec） |
| moonshine_voice (ライブラリ+onnxランタイム) | 114MB | STT=moonshine を使わない人にも配布 |
| Python runtime | 51MB | 不可避 |
| transformers (HuggingFace) | 47MB | faster-whisperの依存、Parcera本体は未使用 |
| av / PyAV (ffmpeg) | 53MB | faster-whisperの依存 |
| Azure Speech SDK | 13MB | Azure STT を使わない人にも配布 |

加えて、**使用しない STT/LLM プロバイダーのライブラリが起動時にメモリへロードされる問題**がある（`factory.py` のトップレベル import による）。

## 3. ユーザーストーリー (User Stories)

- ユーザーとして、Gemini や OpenAI を使うだけなのに、ローカルSTT用の大きなライブラリを一緒にダウンロードしたくない。
- ユーザーとして、ローカルSTTやローカルLLMを初めて使うとき、必要なライブラリが自動でダウンロードされてほしい。
- ユーザーとして、使用しないプロバイダーのライブラリがバックグラウンドでメモリを消費しないようにしてほしい。

## 4. 機能要件 (Requirements)

### 4.1 Optional Package Bundling

以下のパッケージをバンドルから除外し、初回使用時にダウンロードする方式に変更する:

| パッケージ群 | 対象プロバイダー | 削減量 |
|---|---|---|
| `moonshine_voice` (onnxランタイム含む) | STT: moonshine | ~114MB |
| `faster_whisper` + `av` + `ctranslate2` | STT: faster_whisper | ~70MB |
| `transformers` | faster_whisperの依存 | ~47MB |

- バンドルから除外したパッケージは、ユーザーが対象プロバイダーを Settings で選択・保存した時点でダウンロードを開始する
- ダウンロード先: `~/Library/Application Support/Parcera/optional-packages/`
- ダウンロード中は UI にプログレス表示を行い、完了後にアプリの再起動を促す

### 4.2 Lazy Import によるメモリ最適化

`src/core/factory.py` のトップレベル import を各 `build_*` メソッド内の条件分岐内に移動する。

対象:
- `from core.stt import KotobaWhisperRecognizer, MoonshineRecognizer` → `build_stt()` 内へ
- `from core.local_llm import LocalLLMService` は既存のまま（factory.py L13 確認）→ 実際のプロバイダー分岐内に閉じ込める

効果: 使用しないプロバイダーのライブラリがメモリにロードされない。

## 5. 非機能要件 (Non-Functional Requirements)

- **ダウングレード安全性**: optional packages の Python ABI は同梱の python-build-standalone と一致していること
- **オフライン復元**: ダウンロード済みの optional packages は再インストール後も `~/Library/Application Support/` に残ること（モデルデータと同じ扱い）
- **フォールバック**: ダウンロード未完了の状態でプロバイダーを選択した場合、`NoOpRecognizer` 相当のフォールバックで起動を継続すること

## 6. 成功基準 (Success Criteria)

1. Gemini + Google STT の構成でアプリバンドルサイズが 700MB 未満
2. Gemini + Google STT の構成で起動時 RAM が現状比 300MB 以上削減
3. moonshine STT を初めて選択したユーザーが、ダウンロード完了後に正常に使用できる
4. 既存ユーザー（moonshine 使用中）がアップデート後も動作継続できる
