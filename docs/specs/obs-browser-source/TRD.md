# OBS Browser Source 対応 TRD

## 1. アーキテクチャ概要

```
Tauri アプリ（起動中）
  ├── tauri-plugin-localhost → フロントエンドを HTTP 配信（ポート 8677）
  └── Python サイドカー（ポート 8676）
        ├── sounddevice でマイク直接収音
        ├── STT パイプライン（既存 STT エンジンへバッファを渡す）
        ├── 振幅 + スペクトル重心母音解析 → WS broadcast（user_lipsync）
        └── FastAPI
              ├── WS /ws                      ← TTS 音声 + AI lipsync
              ├── GET /config/obs.html        ← obs.html をサーブ
              ├── GET /config/obs-html-path   ← file:// URI を返す
              ├── GET /config/obs-asset/{type}/{file} ← スプライト画像プロキシ
              └── GET /config/settings        ← 設定 JSON（OBS 用）

OBS
  ├── Browser Source: file:///...obs.html?type=ai
  │     └── JS 内蔵 WS 再接続ループ → ws://127.0.0.1:8676/ws
  │         → TTS 音声受信（WebAudio）+ スペクトル重心母音解析 → 口パク
  └── Browser Source: file:///...obs.html?type=user
        └── JS 内蔵 WS 再接続ループ → ws://127.0.0.1:8676/ws
            → user_lipsync イベント受信 → 口パク描画
```

### file:// アプローチの理由

従来案（`http://localhost:{FRONTEND_PORT}/?obs=1`）に対して `file://` URI を一次 URL とした理由：

- OBS を先に起動してから Parcera を起動するワークフローに対応できる
- HTTP サーバー起動前でも `file://` からページが即座に読み込まれ、JS の WS 再接続ループが始まる
- Parcera 再起動時も OBS 側の手動更新が不要

## 2. コンポーネント別設計

### 2-1. standalone `obs.html`

**目的**: OBS Browser Source 専用の自己完結 HTML ページ。`file://` 読み込みでも動作する。

- `src/static/obs.html`（カノニカル） / `ui/public/obs.html`（Tauri 配信コピー）として管理
- `ui/vite.config.ts` の `syncObsHtml` プラグインがビルド時に自動同期
- ビルドツール不使用（インライン JS / CSS / vanilla）
- ポート解決: `window.location.port` から `pythonPort` を導出（`file://` の場合は NaN → デフォルト 8676）

**AI アバター**: WebAudio `AnalyserNode` で受信 TTS 音声を解析し、スペクトル重心母音検出で口パク

**User アバター**: WS `user_lipsync` イベントを購読してスプライトを切り替え

**再起動耐性**: 内蔵の WS 再接続ループ（指数バックオフ）が Parcera の起動・再起動を検出して自動再接続

### 2-2. フロントエンド HTTP 配信（`tauri-plugin-localhost`）

React フロントエンドの Tauri 埋め込みアセットを HTTP 公開するために使用。

- ポート: `settings.app.frontend_port`（デフォルト 8677 = python_port + 1）
- `src-tauri/Cargo.toml` に `tauri-plugin-localhost = "2"` 追加
- `src-tauri/src/lib.rs` でポートを設定から読んで起動
- `src-tauri/capabilities/default.json` に `localhost:default` 追加

### 2-3. Python マイク直接収音（`MicAnalyzer`）

**ファイル**: `src/core/mic_analyzer.py`

`sounddevice` でマイク音声をコールバック方式で収音し、2つの役割を果たす：

1. **lipsync ブロードキャスト**: 各フレームで RMS + スペクトル重心 → 母音判定し WS 全クライアントへ送信
2. **STT VAD**: エネルギーベース VAD で発話区間を検出し STT パイプラインへ渡す

```json
// user_lipsync イベント形式
{"type": "user_lipsync", "vowel": "a", "amplitude": 0.72, "speaking": true}
```

**VAD パラメータ**:
- `SILENCE_CHUNKS_TO_FLUSH = 15`（約 480ms の無音でフラッシュ）
- `MIN_SPEECH_CHUNKS = 5`（約 160ms 未満の短い音は棄却）
- `MAX_SPEECH_CHUNKS = 300`（約 9.6s でバッファを強制フラッシュ）

**母音検出**: スペクトル重心（Hz）で分類。`audio.ts` の `VOWEL_BOUNDARIES_HZ` と同じ閾値を使用。

### 2-4. アセットプロキシ（`GET /config/obs-asset/{type}/{filename}`）

`obs.html` が `http://` で配信されるため、`file://` のスプライト画像を直接読み込むと Chromium の mixed-content ポリシーでブロックされる。FastAPI がプロキシとして中継する。

- `avatar_type` は `{"user", "ai"}` に限定（パストラバーサル防止）
- `assets_dir` は設定値が実在するディレクトリか確認してから使用（Tauri 仮想パス除外）
- 実在しない場合はバンドル済みアセットにフォールバック

### 2-5. 設定エンドポイント（`GET /config/settings`）

OBS Browser Source は Tauri IPC を使えないため、Python 経由で設定 JSON を取得する。

`src/routers/config_router.py` に追加（既存 `/config/reload` と同じルーター）。

### 2-6. OBS URL の設定画面表示

`ui/renderer/components/sections/AdvancedSection.tsx` で `GET /config/obs-html-path` を呼び出し、`file://` URI を優先表示。Parcera が未起動の場合は HTTP フォールバック URL を表示。

```
OBS Browser Source URL
AI アバター:   file:///...obs.html?type=ai   [コピー]
User アバター: file:///...obs.html?type=user  [コピー]
```

### 2-7. フロントエンド lipsync 購読（Tauri React アプリ）

`ui/renderer/lib/comm.ts` の `startLipsyncWebSocket()` が WS `user_lipsync` イベントを購読し、`audio.ts` の `setExternalLipsync()` を呼び出して `visual.ts` に渡す。

- Tauri の User アバターウィンドウ・OBS User アバターの両方が使用
- WS 切断時に `clearExternalLipsync()` を呼び出し口パクをリセット

## 3. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/static/obs.html` | 新規: OBS Browser Source 専用スタンドアロンページ |
| `ui/public/obs.html` | 同上（Tauri 配信コピー。ビルド時自動同期） |
| `src/core/mic_analyzer.py` | 新規: sounddevice 収音 + 振幅/母音解析 + WS broadcast + STT VAD |
| `src/routers/config_router.py` | 追加: `GET /config/obs.html`, `/obs-html-path`, `/obs-asset/`, `/settings` |
| `src/run_server.py` | 追加: MicAnalyzer 起動・停止管理、STT → STS パイプライン連携 |
| `ui/renderer/lib/obs-bridge.ts` | 新規: OBS 用 API ブリッジ（HTTP による設定取得・更新） |
| `ui/renderer/lib/api.ts` | 追加: `?obs=1` 検出で obs-bridge へルーティング |
| `ui/renderer/lib/audio.ts` | 追加: `setExternalLipsync` / `clearExternalLipsync` / `getExternalLipsync` |
| `ui/renderer/lib/comm.ts` | 追加: `startLipsyncWebSocket()`, `startObsServerWatcher()` |
| `ui/renderer/lib/visual.ts` | 追加: external lipsync 優先ロジック |
| `ui/renderer/lib/hooks/useAvatar.ts` | 変更: OBS モード分岐（getUserMedia スキップ、WS lipsync 購読） |
| `ui/renderer/components/sections/AdvancedSection.tsx` | 追加: OBS URL 表示 UI |
| `configs/settings.default.yaml` | 追加: `app.frontend_port: 8677` |
| `src-tauri/Cargo.toml` | 追加: `tauri-plugin-localhost = "2"` |
| `src-tauri/src/settings_store.rs` | 追加: `get_frontend_port()` |
| `src-tauri/src/lib.rs` | 追加: localhost プラグイン登録・frontend_port 読み込み |
| `ui/vite.config.ts` | 追加: `syncObsHtml` プラグイン（obs.html 自動同期） |

## 4. 制約・注意点

- `tauri-plugin-localhost` ポート（8677）と Python ポート（8676）は別。`obs.html` は常に Python ポートへ接続
- `sounddevice` は macOS で `portaudio` バインディングを使用
- マイクデバイス選択は既存の `settings.app.mic_device_id` を Python 側でも参照
- OBS Browser Source の WS は同一ホスト `127.0.0.1` のため CORS 不要
- アセットキャッシュ: `applySettings` 呼び出しごとに `?v={timestamp}` でキャッシュバスト
