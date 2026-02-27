# Knowledge: 自然な呼吸アニメーションの実装 (1/fゆらぎと黄金比)

## 1. 概要
Parcera のアバターに「生命感」を与えるため、単純な往復運動ではない、自然界の揺らぎ（1/fゆらぎ）をシミュレートした呼吸アニメーションを実装している。この知見は、静止画をベースとしたアニメーションにおいて、ユーザーが感じる「機械的な違和感」を排除するために重要となる。

## 2. 理論的背景

### 1/fゆらぎ (Pink Noise)
規則正しさと不規則さが適度に調和した揺らぎのこと。心拍、川のせせらぎ、木漏れ日など、多くの自然現象に含まれており、人間に心地よさやリラックス感を与える。

### 黄金比 (1.618...)
呼吸の周期や振幅の周波数成分に黄金比を用いることで、複数の波が干渉したときでも「不快な共鳴」が起きず、常に複雑で予測不可能な、しかし調和のとれた動きを維持できる。

## 3. 具体的な計算手法

JavaScript の `requestAnimationFrame` ループ内で、以下のような計算を行い、アバターの `translateY` と `scale` を毎フレーム更新する。

```javascript
// 時間 t に基づく波の計算例
const time = performance.now() / 1000;
const gold = 1.61803398875;

// メインの波と、黄金比でずらしたサブの波を合成
const wave1 = Math.sin(time * 0.5);
const wave2 = Math.sin(time * 0.5 * gold);
const combinedWave = (wave1 + wave2) / 2;

// 振幅(amplitude)と倍率(scale)に反映
const offsetY = combinedWave * amplitude;
const currentScale = 1.0 + (combinedWave * (scaleFactor - 1.0));
```

## 4. 実装のポイント (Tips)
- **FPSへの不依存**: アニメーションの速度が PC のリフレッシュレート（60Hz/144Hz等）に依存しないよう、`delta time` ではなく `performance.now()` 等の絶対時間を用いる。
- **CSS変数との連携**: JS で計算した値を `element.style.setProperty('--breathe-offset-y', ...)` のように CSS 変数へ流し込むことで、DOM の再構築を最小限にしつつ、GPU による滑らかな描画 (`transform`) を実現する。
- **状態の分離**: 「話しているとき」と「待機中」で、振幅（amplitude）を微妙に変えることで、心理状況を表現することも可能。
