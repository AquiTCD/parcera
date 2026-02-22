# Implementation Plan - 1/fゆらぎを用いた自然な呼吸アニメーションの導入

黄金比（1.618）と1/fゆらぎの概念を取り入れ、従来の単純な往復運動（CSS Keyframes）から、より生命感のある自然な呼吸（JS-driven Fluctuations）にアップグレードする。

## 1. 現状分析
- **CSS (`style.css`)**: `@keyframes breathe` を使用し、一定周期（`--breathe-duration`）で `translateY` と `scale` をループさせている。
- **React (`Avatar.tsx`)**: 設定（`breathe_scale`, `breathe_amplitude`, `breathe_duration`）をロードし、CSS変数にセットしている。
- **Animation Loop (`visual.ts`)**: `requestAnimationFrame` によるループ（`updateVisuals`）が存在し、まばたきや口パクを制御している。

## 2. 変更内容

### 2.1 CSS の修正 (`electron/renderer/style.css`)
- `animation: breathe ...` を削除（またはコメントアウト）。
- `.avatar-main` の `transform` を、JSからリアルタイムに更新される変数（例: `--breathe-offset-y`, `--breathe-current-scale`）を参照するように変更する。

### 2.2 アニメーションロジックの追加 (`electron/renderer/lib/visual.ts`)
- `updateVisuals` ループ内で、黄金比 `1.618` を用いた波の計算を行う。
- 時間経過 `time` は、fpsに依存しないよう `performance.now()` 等を用いた経過時間ベースにする。
- 計算結果を CSS 変数に反映する。

### 2.3 設定の統合 (`electron/renderer/components/Avatar.tsx`)
- いまの `breathe_duration` 等の設定値を、新しいロジックの「周期」や「振幅」の係数として活用できるようにする。

## 3. 実行ステップ

1.  **[分離の儀] ☀️ Yang / 🌙 In の意見出し**: (実施済み)
2.  **[計画の儀]**: 本プランの提示と承認。
3.  **[具現・検証の儀]**:
    - `style.css` の修正。
    - `visual.ts` へのロジック実装。
    - 動作確認。
4.  **[確定の儀]**: アキさんの承認を得てコミット。

## 4. 懸念点と対策
- **パフォーマンス**: 毎フレーム CSS 変数を更新するため、低スペック環境での負荷を考慮する。基本的には `transform` の更新なので GPU 加速が効き、問題ないはず。
- **設定値の互換性**: 既存の設定（`breathe_scale` 等）が直感的に動くように計算式を調整する。
