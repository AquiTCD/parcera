# Idea: Windows 対応

## 方針

macOS版と完全な機能同等は目指さない。**Local LLM・Local TTS（Voicevox/AivisSpeech）はmacOS専用**とし、WindowsはAPIプロバイダーのみをサポートする。

| 機能 | macOS | Windows |
|------|-------|---------|
| LLM | Gemini / OpenAI / **Local (mlx-lm)** | Gemini / OpenAI のみ |
| STT | Google / Azure / **Faster-Whisper** / **Moonshine** | Google / Azure / **Moonshine** |
| TTS | Voicevox / AivisSpeech / Google | Google のみ（初期） |

> Faster-Whisper（CTranslate2ベース）はWindows+CUDA環境では動作するため、将来的に対応拡大の余地はある。

---

## ブロッカー分析

### 1. `mlx-lm` — **Critical（macOS専用）**

`local_llm.py` で `from mlx_lm.utils import load_model` を lazy import しているため、設定で `provider: local` を選ばない限り import されない。
Windows では `pyproject.toml` から除外するか、`prepare_sidecar` スクリプトで `--exclude mlx-lm` する。

**解決策**: `prepare_sidecar` の Windows 版で `mlx-lm` を install リストから外す。UIの設定画面でも `local` LLMプロバイダーをWindows時は非表示にする。

### 2. `prepare_sidecar.sh` — **Critical（bash / arm64 専用）**

現在のスクリプトはハードコードされた `aarch64-apple-darwin` タグと `.sh` 形式。

```bash
PLATFORM="aarch64-apple-darwin"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/..."
```

`python-build-standalone` はWindowsビルドも公開しているため、以下で差し替え可能。

| OS/Arch | Platform タグ |
|---------|-------------|
| macOS arm64 | `aarch64-apple-darwin` |
| Windows x64 | `x86_64-pc-windows-msvc` |

**解決策**: シェルスクリプトをOS検出で分岐させるか、`prepare_sidecar.ps1`（PowerShell）を別途作成する。`uv` はWindows対応済みなので `uv pip install` 部分はそのまま使える。

### 3. Electron ビルド設定 — **High**

`electron/package.json` の `build` セクションに `mac` しかない。

```json
"win": {
  "target": [{ "target": "nsis", "arch": ["x64"] }]
}
```

`electron-builder-squirrel-windows` は既に `node_modules` に存在するため追加コストは低い。

### 4. `moonshine-voice` — **解決済み ✅**

PyPIの配布wheelを確認したところ `win_amd64.whl` が存在する。macOS / Linux / Windows 全対応。
`pyproject.toml` へのplatform marker追加は不要。設定UIでの非表示制御も不要。

### 5. TTS（Voicevox / AivisSpeech）— **Low**

TTS実装（`tts.py`）は HTTP APIコール（`httpx`）のみ。エンジンのプロセス管理は `electron/main` 側が担う。
Voicevox / AivisSpeech はWindows版バイナリが存在するため、将来的にWindows向けエンジン自動起動にも対応できる。
初期実装では「ユーザーが別途インストール・起動」または「Google TTSを使う」方針で問題ない。

### 6. パス区切り文字 — **Low**

Python 側は `os.path.join` を使っており問題なし。
Electron main 側（TypeScript）のパス結合を `path.join()` で統一しているか確認が必要。

---

## 実装タスクリスト

### Phase A: Python バックエンド

- [ ] `prepare_sidecar.sh` をOS分岐対応にする（または `prepare_sidecar.ps1` を新規作成）
  - Windows 用 Python standalone URL・プラットフォームタグの設定
  - `mlx-lm` を Windows ビルドから除外
  - `moonshine-voice` を Windows ビルドから除外（動作確認できるまで）
- [ ] `pyproject.toml` に platform marker を追加（`mlx-lm ; sys_platform == "darwin"`）
- [ ] `factory.py` の `local` LLMプロバイダー選択時にエラーメッセージを改善（Windows非対応の旨を表示）

### Phase B: Electron フロントエンド

- [ ] `electron/package.json` に `win` ビルドターゲット（NSIS x64）を追加
- [ ] Electron main プロセスのパス解決を Windows で検証（Python実行バイナリのパス）
- [ ] 設定UIで `sys_platform` をバックエンドから取得し、非対応プロバイダーを非表示にする
  - Windows では Local LLM プロバイダーを非表示
  - Windows では Moonshine STT を非表示（初期）

### Phase C: CI / リリース

- [ ] GitHub Actions に Windows ビルドジョブを追加（`windows-latest` runner）
- [ ] `prepare_sidecar` の Windows 版をCIで実行する手順の整備

---

## 優先実装順

1. `prepare_sidecar` の Windows 対応（ここが動けば Python サイドカーが起動できる）
2. Electron ビルド設定に `win` ターゲット追加
3. UIの非対応プロバイダー制御
4. CI整備
