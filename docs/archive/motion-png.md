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
- **Communication**: WebSocket (Port 8676) / Web Audio API

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
  port: 8676  # WebSocket URL is auto-derived: ws://localhost:{port}/ws
  ai_audio_sample_rate: 16000  # Hz — must match TTS engine output
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

### Phase 4: チューニング・拡張・リファクタリング (Completed)
1. - [x] Vite ボイラープレート残骸の削除。
2. - [x] デバッグ用一時ファイルのクリーンアップ。
3. - [x] Electron Main/Preload/Vite Config の TypeScript 化。
4. - [x] `ParceraSettings` 型の Single Source of Truth 化。
5. - [x] Settings キャッシュのリロード対応（ホットリロード）。
6. - [x] AudioContext sampleRate のハードコード除去。
7. - [x] Python側に健全性チェック用 `/health` エンドポイント追加。
8. - [x] WebSocket 再接続の指数バックオフ対応。
9. - [x] TTS失敗時のリトライ/フォールバック。
10. - [x] レスポンス速度の最適化 (VAD閾値調整, Warm-up実装, 句読点戦略)。
11. - [x] LLM構成管理の強化 (履歴リセット設定, Gemini 3/2.5 切り替え基盤)。
12. - [x] パフォーマンス計測基盤 (`profile_mode` 実装)。
13. - [x] プロンプト改善: フィラー戦略（初速向上）。
14. - [x] フロントエンド音声遅延改善 (`AudioContext` latencyHint)。
15. - [x] リップシンク精度の向上（レイテンシ改善による反応速度向上）。
16. - [x] **New**: ログレベルの洗練（累積表示: INFO/WARNING/DEBUG）。
- **Goal**: 性能・安定性・拡張性においてプロダクトレベルの品質に到達。

### Phase 5: AIエンジンの換装・拡張 (Completed)
- [x] **LLM**: Gemini 以外のモデル (OpenAI GPT-4o) 対応基盤の実装。
- [x] **STT**: Whisper 以外のエンジン (Azure STT, Google STT) への切り替え対応。
- [x] **TTS**: Voicevox 以外のエンジン (AivisSpeech) への切り替え対応 (維持・整理)。
- **Goal**: ユーザーが好みのAIコンポーネントを自由に組み合わせられる柔軟性を提供する。

### Phase 6: GUI設定画面 (Settings UI) (Completed)
- [x] GUI設定画面の実装（settings.yaml のパラメータをUIから変更可能に）。
  - Electron IPC通信で YAML を読み書き。
  - フロントエンド(React)でのフォーム実装とバリデーション。
- [x] **STT**: 短い発話（相槌等）の無視ロジックとGUI管理 UI。
- [x] **Peak Meter**: dBベースのカラーメータと閾値インジケーターの追加。
- [x] **TTS Engine**: ローカルエンジンの起動・再起動をGUIから制御。
- **Goal**: テキストエディタを使わずに設定完結できるようにし、開発・調整時の利便性を最大化。

### Phase 7: パッケージ化 & 統合 (Portable Python Strategy) (Completed)
詳細は `docs/specs/packaging-strategy.md` を参照。
- [x] **Dependency Diet**: `torch` 無しの `faster-whisper` 環境への軽量化。
- [x] **Portable Python**: `python-build-standalone` を使った実行環境の同梱。
- [x] **Electron Sidecar Control**: Pythonエンジンの起動・監視・自動復旧ロジックの実装。
- [x] **Asset Management**: モデルデータのオンデマンドDL（初回起動時）の実装。
- [ ] **Signing & Notarization**: Apple Silicon (arm64) 専用署名と公証の実施（将来課題）。
- **Goal**: インストール不要、ポータブルで安定した Parcera AI Avatar システムの配布版完成。

## 7. OBS連携ガイド
- **Electron側設定**: `transparent: true`, `frame: false`
- **OBS側設定**: 
  - 「ソース」に「ウィンドウキャプチャ」を追加。
  - プロパティで「透過を許可 (Allow Transparency)」にチェック。
  - ブルーバック等のクロマキー不要で、そのまま背景が抜ける。
