# TRD: Optional Runtime Packages & Lazy Import Optimization

## 1. Overview

アプリバンドルから Optional なライブラリを除外し、ユーザーのプロバイダー選択に応じてオンデマンドでダウンロード・インストールする仕組みを構築する。合わせて、不要ライブラリの起動時ロードを lazy import で回避する。

## 2. アーキテクチャ

### 2.1 Optional Package の配置と `sys.path` 戦略

```
~/Library/Application Support/Parcera/
├── models/                    # 既存: AIモデルウェイト
└── optional-packages/         # 新規: optional な Python ライブラリ
    ├── moonshine/             # moonshine プロバイダー選択時にDL
    └── faster_whisper/        # faster_whisper プロバイダー選択時にDL
```

Python サーバー起動時に以下を実行し、optional-packages を `sys.path` に追加する:

```python
# run_server.py または run.py の起動処理に追加
import sys, os
OPTIONAL_PACKAGES_DIR = os.path.expanduser(
    "~/Library/Application Support/Parcera/optional-packages"
)
for pkg_dir in os.listdir(OPTIONAL_PACKAGES_DIR):
    path = os.path.join(OPTIONAL_PACKAGES_DIR, pkg_dir)
    if os.path.isdir(path) and path not in sys.path:
        sys.path.insert(0, path)
```

### 2.2 Python ABI 互換性の担保

Optional packages は `pip` や `uv` で直接インストールするのではなく、**アプリ内の python-build-standalone バイナリを使ってインストール**する。

```python
# Python バックエンド側のインストール処理
import subprocess, sys

def install_optional_package(package_name: str, target_dir: str):
    python_bin = sys._base_executable  # 同梱の portable python を指す
    subprocess.run([
        python_bin, "-m", "pip", "install",
        "--target", target_dir,
        "--no-deps",  # 依存はセットごと管理
        package_name
    ], check=True)
```

これにより `.so` / `.dylib` の ABI が同梱 Python と一致することを保証する。

### 2.3 Optional Package セット定義

プロバイダーと必要パッケージを明示的にセット管理する:

```python
OPTIONAL_PACKAGE_SETS = {
    "moonshine": {
        "packages": ["moonshine-voice"],
        "install_dir": "moonshine",
        "install_with_deps": True,   # onnxruntime 等の C 拡張依存を含む
        "size_mb": 120,
    },
    "faster_whisper": {
        # --no-deps でインストールする 4 パッケージを明示列挙
        # huggingface-hub / tokenizers / tqdm はバンドル済みのため除外
        # transformers は inference 不要（conversion extra のみ）
        # onnxruntime は Requires-Dist に記載のある VAD (Silero) 用 C 拡張（TRD 初版から追加）
        "packages": ["faster-whisper", "ctranslate2", "av", "onnxruntime"],
        "install_dir": "faster_whisper",
        "install_with_deps": False,  # 純粋 Python 依存はバンドル済み
        "size_mb": 200,
    },
}
```

> **Note:** `faster_whisper` の `Requires-Dist` を実測した結果、`transformers` は `[conversion]` extra にのみ含まれ推論時には不要。代わりに `onnxruntime>=1.14`（VAD 用 Silero ONNX ランタイム）が必須依存として存在するため追加。

## 3. 変更対象ファイル

### 3.1 `src/core/factory.py` — Lazy Import 化

**変更前（現状）:**
```python
# トップレベル: 全プロバイダーのライブラリが常にロードされる
from core.stt import KotobaWhisperRecognizer, NoOpRecognizer, MoonshineRecognizer
from core.local_llm import LocalLLMService
```

**変更後:**
```python
# トップレベルの import は最小限に
# build_stt() / build_llm() の各分岐内でのみ import する

def build_stt(self, ...):
    ...
    if provider == "faster_whisper":
        from core.stt import KotobaWhisperRecognizer  # ← ここで初めてロード
        ...
    elif provider == "moonshine":
        from core.stt import MoonshineRecognizer      # ← ここで初めてロード
        ...

def build_llm(self):
    ...
    elif provider == "local":
        from core.local_llm import LocalLLMService    # ← ここで初めてロード
        ...
```

### 3.2 `src/core/stt.py` — トップレベル import の除去

**変更前:**
```python
from faster_whisper import WhisperModel   # L6: 常にロード
import moonshine_voice                    # L7: 常にロード
from moonshine_voice.moonshine_api import ModelArch  # L9
```

**変更後:** 各クラスの `__init__` または `_load_model` 内で lazy import に変更。

### 3.3 新規: `src/core/optional_packages.py`

Optional package の管理（インストール状態確認・インストール実行・進捗通知）を担う新モジュール。

主要 API:
- `is_installed(provider: str) -> bool`
- `install(provider: str, progress_callback) -> None`
- `get_install_dir(provider: str) -> str`

### 3.4 新規 API エンドポイント: `src/routers/`

Electron GUI からの操作に対応するエンドポイントを追加:
- `GET /optional-packages/status` — 各プロバイダーのインストール状態
- `POST /optional-packages/install` — インストール開始（SSE or WebSocket でプログレス送信）

### 3.5 `electron/` — UI 側の対応

Settings の STT タブで未インストールのプロバイダーを選択した場合:
1. 「このプロバイダーには追加のダウンロードが必要です（約XXX MB）」と表示
2. 「ダウンロード開始」ボタン → プログレスバー表示
3. 完了後「アプリを再起動してください」メッセージを表示

## 4. バンドル変更

`electron/prepare_sidecar.sh` または相当するビルドスクリプトで、以下を `site-packages/` から除外:

```bash
# 除外対象
EXCLUDE_PACKAGES=(
  "moonshine_voice"
  "faster_whisper"
  "av"
  "transformers"
  "ctranslate2"
)
```

- `torch` は既に `torch_stub_marker` として実質スタブ化済み → 引き続き除外維持
- `mlx_lm` はサイズが小さく（1.7MB）、macOS arm64 限定ライブラリのため現状バンドル維持でよい

## 5. マイグレーション（既存ユーザー向け）

アプリ起動時に以下を確認:
1. `site-packages/moonshine_voice` が存在する（旧バンドル）かつ `optional-packages/moonshine` が存在しない場合 → 旧 site-packages からコピーして移行
2. STT プロバイダーが `moonshine` または `faster_whisper` に設定されているが optional-packages が未インストールの場合 → Settings 画面を前面に出し、インストールを促す

## 6. リスクと対応

| リスク | 対応 |
|---|---|
| ネットワーク不通でインストール失敗 | エラーメッセージ + リトライボタン。`NoOpRecognizer` で継続起動 |
| PyPI パッケージのバージョン変動 | インストール時のバージョンをピン留め（`packaging-runtime` の `prepare_sidecar.sh` と揃える） |
| Apple Notarization（signing） | optional-packages ディレクトリの `.dylib` / `.so` はユーザー領域のため署名対象外。ただし Gatekeeper の挙動は要検証 |

## 7. 成功基準（技術的）

1. `python3 -c "import sys; print(sys.path)"` で optional-packages が含まれることを確認
2. Gemini + Google STT 選択時に `faster_whisper` / `moonshine_voice` の import が発生しないことをログで確認
3. moonshine を初回選択 → インストール → 再起動 → STT 動作 の E2E が通ること
4. 既存ユーザーの自動マイグレーションが無操作で完了すること
