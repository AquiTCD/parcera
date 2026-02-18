# PRD/TRD: Parcera Motion PNG System (Dual Avatar)
Version: 1.3.0 (Feb 2026 Comprehensive Edition)

## 1. プロダクト概要 (PRD)
### 1.1 目的
デスクトップ上に「自分」と「AI」の2人のアバターを常駐させ、リアルタイムな会話と視覚的なリップシンクを提供することで、AIとの共存感を最大化する。

### 1.2 UX要件
- **透明性と没入感**: 背景を透過し、立ち絵だけが画面上に浮いている状態を実現。
- **リアルタイム性**: 会話の音声と口の動きが常に同期（ラグゼロ解析）。
- **反応性**: ユーザーが喋り始めた瞬間にそのアバターが即座に反応。

## 2. 技術要件 (TRD)
### 2.1 テクノロジースタック
- **Node.js**: v24 (Active LTS) / **pnpm** (Package Manager)
- **Frontend**: Vite + Electron (TypeScript)
- **Engine**: Python 3.11+ (`uv` managed)
- **Communication**: WebSocket (Port 8080) / Web Audio API

### 2.2 システム構成
- **Brain (Python Engine)**:
    - 既存の `run.py` ロジックを継承し、WebSocketサーバーとして動作。
    - 生成した音声をBase64エンコードして配信。
- **Body (Electron Frontend)**:
    - `Main Process`: Pythonエンジン（サイドカー）の起動管理。
    - `Renderer Processes`: 各アバターの描画と音声解析。

## 3. アプリケーション構造 & 透過設定
### 3.1 ウィンドウ管理
- **CharacterWindowA (User)**: ローカルマイク連動。
- **CharacterWindowB (AI)**: WebSocket経由のAI音声連動。
- **共通設定**:
  - `transparent: true`, `frame: false`, `alwaysOnTop: true`, `hasShadow: false`
  - macOS環境では `standardWindow: false` 設定等で影を完全にオフにする。

### 3.2 視覚構造 (Layers)
各キャラクターは以下の3レイヤー構造を持つ：
- **Base (立ち絵)**: 呼吸による微小な `translateY` (CSS Keyframes)。
- **Eyes (目)**: 普段は `opacity: 1` (`eyes_open.png`)、ランダムな `setTimeout` で一瞬 `eyes_closed.png` に切り替え。
- **Mouth (口)**: 音圧と母音推定に基づき、画像を高速切り替え。

## 4. データ定義 (configs/settings.yaml)
Python側と共通のYAMLファイルで一括管理する。Electron側は `js-yaml` 等を使用してこれを読み込む。

```yaml
# VAD (Voice Activity Detection) Settings
# volume_db_threshold: Single source of truth for audio sensitivity (dB).
# Used by both Python VAD (speech recognition) and JS lip-sync (mouth movement).
vad:
  volume_db_threshold: -20.0
  max_duration: 15.0

# Electron Application Settings
electron:
  port: 8080  # WebSocket URL is auto-derived: ws://localhost:{port}/ws
  windows:
    ai: { width: 400, height: 400, alwaysOnTop: true }
    user: { width: 400, height: 400, alwaysOnTop: true }

# Avatar Visual Definitions
avatars:
  show_debug: true
  blink_interval_min: 5000   # ms
  blink_interval_max: 15000  # ms
  mouth_hold_time: 120       # ms
  breathe_scale: 1.005
  breathe_amplitude: 2       # px
  breathe_duration: 5000     # ms
  user:
    name: "User"
    assets_dir: "/assets/user"
  ai:
    name: "AI"
    assets_dir: "/assets/ai"
```

## 5. リップシンク解析詳細
- **音圧取得 (RMS)**: 
  - `analyser.getFloatTimeDomainData` を使用（Float32 で高精度解析）。
  - `Math.sqrt(sum(data[i]^2)/len) * 100` で算出し、統一閾値（VAD dB → RMS×100 変換）を超えたら発話中と判定。
- **母音推定 (FFT)**: 
  - `analyser.getFloatFrequencyData` からスペクトル重心を計算。
  - 5母音（あ・い・う・え・お）に分類し、対応する口画像に切り替え。
  - 200Hz以下の低周波ノイズは除外。

## 6. 実装フェーズ (詳細ロードマップ)
### Phase 1: ユーザーボイス連動（UI基盤 & ローカルマイク）
- [x] `mise` 命令で `Node v24` & `pnpm` をインストール。
- [x] `Vite + Electron` プロジェクト初期化。
- [x] `UserWindow` の透過・枠なし表示とマイク音量による口パク（開閉のみ）を実装。
- **Goal**: 自分の声で画像が動くのを確認。

### Phase 2: AIボイス連動（WebSocket 連携基盤）
- [x] Python側を `AIAvatarWebSocketServer` 形式にアップデート。
- [x] 音声Base64データをWebSocket経由でElectronへ飛ばし、再生。
- [x] **New**: 動的リクエストマージ（文字数に応じたしきい値調整）の実装。
- [x] **New**: サーバー側 First-Wins ロジック（Busy状態の管理）の実装。
- [x] **New**: `src/core` へのパッケージ化と Factory パターンの導入。
- **Goal**: AIの話し声に合わせてAIアバターが動き、自然な会話のキャッチボールができる。

### Phase 3: 高精度リップシンク & アニメーション
- [x] FFTによる母音推定ロジックの実装（あ・い・う・え・お の5母音切り替え）。
- [x] 呼吸揺れ(CSS Keyframes)とまばたき(JS Timer)の追加。
- [x] **New**: 音声キューシステム導入（AI応答の重なり防止・シーケンシャル再生）。
- [x] **New**: 音声感度閾値の統一（VAD dB → RMS×100 自動変換）。
- [x] **New**: レンダラーのモジュール分割（state / audio / visual / comm）。
- [x] **New**: TypeScript 全面移行（型定義・Discriminated Union による型安全）。
- [x] **New**: ScriptProcessor → AudioWorklet 移行（音声処理の別スレッド化）。
- [x] **New**: Base64エンコード安全化（スタックオーバーフロー防止）。
- [x] **New**: Web Audio グラフ最適化（analyser→destination 重複接続修正）。
- [x] **New**: WebSocket URL を electron.port から自動導出（設定の重複排除）。
- [x] **New**: loadSettings() キャッシュ化、未使用コード除去。
- **Goal**: 実際に「喋っている」ような滑らかなアニメーション。

### Phase 4: チューニング・拡張・リファクタリング
1. - [x] Vite ボイラープレート残骸の削除（`counter.js`, `javascript.svg`）。
2. - [x] デバッグ用一時ファイルのクリーンアップ（`check_tts_output.wav` の除去。`*.wav` は既に .gitignore 済み）。
3. - [x] Electron Main Process (`main/index.js`) の TypeScript 化。
4. - [x] Electron Preload (`main/preload.js`) の TypeScript 化。
5. - [x] `vite.config.js` の TypeScript 化（`vite.config.ts`）。
6. - [x] `getSettings()` の戻り型を `Record<string, unknown>` → `ParceraSettings` に統一。
7. - [x] `ParceraSettings` 型の Single Source of Truth 化（`shared/types.ts` に集約、YAML構造との手動同期解消）。
8. - [ ] Settings キャッシュのリロード対応（開発中の設定変更を即反映）。
9. - [ ] AudioContext sampleRate のハードコード除去（`16000` → settings.yaml から読み込み）。
10. - [ ] Python側に健全性チェック用 `/health` エンドポイント追加（WebSocket再接続判断用）。
11. - [ ] WebSocket 再接続の指数バックオフ対応（固定3秒→指数バックオフ＋最大リトライ回数＋状態表示）。
12. - [ ] TTS失敗時のリトライ/フォールバック（空bytes握り潰し→1回リトライ＋エラー通知）。
13. - [ ] 全体的なレスポンス速度のプロファイリングと極限チューニング。
14. - [ ] LLMの換装（Gemini から ChatGPT への切り替え対応）。
15. - [ ] STTの換装（Whisper から Azure STT への切り替え対応）。
16. - [ ] GUI設定画面の実装（settings.yaml のパラメータをUIから変更可能に）。
17. - [ ] テストコードの拡充。
- **Goal**: 性能・安定性・拡張性においてプロダクトレベルの品質に到達。

### Phase 5: サイドカー化 & パッケージ化
- [ ] `child_process.spawn` でPythonエンジンを自動起動。
- [ ] `PyInstaller` でのPythonバイナリ化と `asarUnpack` 設定。
- [ ] `Electron Builder` で `.app` 化。
- **Goal**: アイコンクリックだけで全システムが起動。

### Phase 6: 統合動作テスト & 最適化
- [ ] OBS 連携テスト（「透過を許可」を有効にしたキャプチャ）。
- [ ] リソース（CPU/メモリ）使用率の最適化。
- **Goal**: Parcera AI Avatar システムの完成。

## 7. OBS連携ガイド
- **Electron側設定**: `transparent: true`, `frame: false`
- **OBS側設定**: 
  - 「ソース」に「ウィンドウキャプチャ」を追加。
  - プロパティで「透過を許可 (Allow Transparency)」にチェック。
  - ブルーバック等のクロマキー不要で、そのまま背景が抜ける。
