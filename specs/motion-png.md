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
- **Frontend**: Vite + Electron (Vanilla JS / React)
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
# Electron Application Settings
electron:
  port: 8080
  windows:
    ai: { width: 400, height: 600, alwaysOnTop: true }
    user: { width: 400, height: 600, alwaysOnTop: false }

# Avatar Visual Definitions
avatars:
  user:
    name: "User"
    micThreshold: 15
    idleAmplitude: "2px"
    assets:
      base: "./assets/user/base.png"
      eyes_open: "./assets/user/eyes_open.png"
      eyes_closed: "./assets/user/eyes_closed.png"
      mouth:
        closed: "./assets/user/mouth_0.png"
        open_a: "./assets/user/mouth_a.png"
        open_i: "./assets/user/mouth_i.png"
        open_u: "./assets/user/mouth_u.png"
  ai:
    name: "AI"
    wsUrl: "ws://localhost:8080"
    micThreshold: 10
    idleAmplitude: "3px"
    assets:
      base: "./assets/ai/base.png"
      eyes_open: "./assets/ai/eyes_open.png"
      eyes_closed: "./assets/ai/eyes_closed.png"
      mouth:
        closed: "./assets/ai/mouth_0.png"
        open_a: "./assets/ai/mouth_a.png"
        open_i: "./assets/ai/mouth_i.png"
        open_u: "./assets/ai/mouth_u.png"
```

## 5. リップシンク解析詳細
- **音圧取得 (RMS)**: 
  - `analyser.getByteTimeDomainData` を使用。
  - `Math.sqrt(sum((data[i]/128-1)^2)/len)` で算出し、 `micThreshold` を超えたら発話中と判定。
- **母音推定 (FFT)**: 
  - `analyser.getByteFrequencyData` からスペクトル重心を計算。
  - 推定された母音に基づき `config.json` の `assets.mouth` から適切な画像を選択。

## 6. 実装フェーズ (詳細ロードマップ)
### Phase 1: ユーザーボイス連動（UI基盤 & ローカルマイク）
- [ ] `mise` 命令で `Node v24` & `pnpm` をインストール。
- [ ] `Vite + Electron` プロジェクト初期化。
- [ ] `UserWindow` の透過・枠なし表示とマイク音量による口パク（開閉のみ）を実装。
- **Goal**: 自分の声で画像が動くのを確認。

### Phase 2: AIボイス連動（WebSocket 連携基盤）
- [x] Python側を `AIAvatarWebSocketServer` 形式にアップデート。
- [x] 音声Base64データをWebSocket経由でElectronへ飛ばし、再生。
- [x] **New**: 動的リクエストマージ（文字数に応じたしきい値調整）の実装。
- [x] **New**: サーバー側 First-Wins ロジック（Busy状態の管理）の実装。
- [x] **New**: `src/core` へのパッケージ化と Factory パターンの導入。
- **Goal**: AIの話し声に合わせてAIアバターが動き、自然な会話のキャッチボールができる。

### Phase 3: 高精度リップシンク & アニメーション
- [ ] FFTによる母音推定JSロジックの実装（あ・い・う の画像切り替え）。
- [ ] 呼吸揺れ(CSS)とまばたき(JS Timer)の追加。
- **Goal**: 実際に「喋っている」ような滑らかなアニメーション。

### Phase 4: チューニング・拡張・リファクタリング
- [ ] LLMの換装（Gemini から ChatGPT への切り替え対応）。
- [ ] STTの換装（Whisper から Azure STT への切り替え対応）。
- [ ] 全体的なレスポンス速度のプロファイリングと極限チューニング。
- [ ] コード全体の再設計とテストコードの拡充。
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
