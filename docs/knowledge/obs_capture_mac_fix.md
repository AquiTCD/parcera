# macOSでのOBSキャプチャ時の描画停止対策

## 概要
macOS上のElectronでは、ウィンドウが非アクティブであったり、他のウィンドウに隠れたり（Occlusion）すると、OSがリソース節約のために描画フレームの更新を停止・抑制する場合がある。
これにより、OBSでアバターをキャプチャしている際にアニメーションが止まったり、カクついたりする現象が発生する。

## 解決策

### 1. Mainプロセスでの抑制解除
以下の設定をMainプロセス（`BrowserWindow` 生成時など）に適用し、OSに描画を継続させる。

*   **コマンドライン引数**:
    *   `disable-renderer-backgrounding`: バックグラウンドでのレンダラー抑制を無効化。
    *   `disable-background-timer-throttling`: タイマーの抑制を無効化。
    *   `disable-backgrounding-occluded-windows`: 隠れたウィンドウのバックグラウンド化を無効化。
*   **WebPreferences**:
    *   `backgroundThrottling: false`: 非アクティブ時のスロットリングを解除。
    *   `disableOcclusionTracking: true`: macOS固有のOcclusion Tracking（隠れたウィンドウの描画停止）を無効化。

### 2. Rendererプロセスでの「心拍（Heartbeat）」実装
画面が「完全な静止画」であるとOSが判断すると更新が止まることがあるため、微細なアニメーションを常に回し続ける。

*   **実装例**:
    *   画面の隅に1pxの極小要素を配置。
    *   CSSアニメーションなどで透明度（`opacity`）を `0.01` 〜 `0.02` 程度でループさせる。
    *   これにより、人間の目には見えないがOSレベルでは「画面が更新され続けている」と認識され、ビデオバッファの更新が維持される。

### 3. OBS側の設定
*   **ウィンドウキャプチャ**: macOS Sonoma以降は「アプリケーションキャプチャ（ScreenCaptureKit）」が推奨されるが、Electronとの相性で止まる場合は「ウィンドウキャプチャ」を試す。
*   **透過の問題**: 背景透過（`transparent: true`）にしていると負荷が高まりカクつくことがある。その場合は「グリーンバック」を背景色（`#00FF00`）に設定し、OBSの「クロマキー」フィルタで抜くのが最も安定する。
