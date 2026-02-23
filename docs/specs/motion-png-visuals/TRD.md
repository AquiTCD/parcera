# TRD: Motion PNG Visual System

## 1. システム構成 (Architecture)
ElectronのRendererプロセス（Web技術）を活用し、Web Audio APIとCanvas/HTML要素でアニメーションを実現する。

### 1.1 使用技術
- **Frontend Framework**: React + Vite (TypeScript)
- **Audio Analysis**: Web Audio API (AudioContext, AnalyserNode, AudioWorklet)
- **Animation**: `requestAnimationFrame`, CSS Keyframes (補助的), JS-driven transform updates.

## 2. 実装詳細 (Implementation Details)

### 2.1 リップシンク・エンジン
`electron/renderer/lib/audio.ts` および `audio-processor.ts` (AudioWorklet) で処理。

- **音圧解析 (RMS)**:
    - `analyser.getFloatTimeDomainData` から算出。
    - 閾値判断: `vad.volume_db_threshold` (dB) を以下の式で変換。
      `rms_threshold = 10 ^ (db / 20) * 100`
- **母音推定 (Vowel Estimation)**:
    - `analyser.getFloatFrequencyData` を使用。
    - スペクトル重心（Centroid）に基づく簡易的な5母音判定。
    - `200Hz` 以下のノイズをカットし、母音に対応するインデックスを出力。

### 2.2 アニメーション・ロジック
`electron/renderer/lib/visual.ts` で一括管理。

- **呼吸 (Natural Breathing)**:
    - 周期的な `translateY` と `scale` の微小変化。
    - 黄金比 $1.618$ を周波数成分に取り入れた「1/fゆらぎ」をシミュレートし、機械的な往復運動を回避。
- **まばたき (Blinking)**:
    - 設定された `blink_interval_min / max` に基づくランダムタイマー。
    - まばたき中は `eyes_closed.png` の `opacity` を切り替える。

## 3. データ定義 (ERD / Data Structures)

### 3.1 アセット構造 (Asset Hierarchy)
`/assets/{user | ai}/` 以下に規定のファイル名で配置。
- `base.png`: 体
- `eyes_open.png` / `eyes_closed.png`: 目
- `mouth_closed.png` / `mouth_a.png` / `mouth_i.png` ...: 口（5母音）

### 3.2 フロントエンド・ステート
```typescript
interface AvatarState {
  isSpeaking: boolean;
  vowel: "a" | "i" | "u" | "e" | "o" | "closed";
  volume: number;
  isBlinking: boolean;
  breatheOffset: number;
}
```

### 3.3 設定定義 (YAML)
`avatars` セクションで定義。
- `mouth_hold_time`: 口の形状を維持するミリ秒（ガタつき防止）。
- `breathe_amplitude`: 呼吸による移動距離(px)。
- `breathe_duration`: 呼吸の1周期の基本時間(ms)。
