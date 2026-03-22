# Tauri Migration Strategy (Safe-Pass Approach)

## 概要
Parcera を Electron から Tauri へ移行するための長期的かつ安全な戦略です。
この移行の主目的は、**メモリ使用量の削減（Chromiumの排除）**、**ネイティブなOS統合（Vibrancy/すりガラス効果）**、および **バイナリサイズの最適化** です。

## 戦略的核心：「UI First, Infrastructure Second」
全ての技術スタックを一気に変更するのではなく、まずは「手慣れた Electron 環境」で UI を完成させ、その後に「配線の繋ぎ変え（インフラ移行）」を行う2フェーズ・アプローチを採用します。

---

## 移行フェーズ

### Phase 1: Electron + shadcn/ui (UIコンポーネントの刷新)
Tauri への移行準備として、まずは現在のフロントエンドをモダンで疎結合な構成に書き換えます。

1.  **shadcn/ui の導入**:
    *   既存の ad-hoc な CSS/コンポーネントから、`shadcn/ui` (Tailwind CSS + Radix UI) ベースの構成へ移行します。
2.  **IPC (通信層) の抽象化**:
    *   `window.electron.xxx` をコンポーネント内で直接呼ばず、専用の React Hooks (例: `useAppConfig`, `useSidecarLog`) の中に隠蔽します。
    *   これにより、後に Tauri 固有の API (`@tauri-apps/api`) に差し替える際、UIコンポーネントを修正する必要がなくなります。
3.  **UI デザインの完成**:
    *   Electron のままで、理想の UI デザインとアニメーション（Framer Motion）を 100% 完成させます。

### Phase 2: Tauri へのメインフレーム移行
UI が完成し、機能追加が落ち着いたタイミングで、本体を Tauri に切り替えます。

1.  **Rust Backend (main.rs) の構築**:
    *   `electron/main/index.ts` のロジック（ウィンドウ管理、Twitch OAuth、トレイ制御）を Rust に移植します。
2.  **Python Sidecar の統合**:
    *   `prepare_sidecar.sh` で生成しているポータブル Python ランタイムを、Tauri の `Sidecar` 機能で起動するように設定します。
    *   Tauri 特有のバイナリ命名規則（アーキテクチャ名付与）に対応します。
3.  **IPC 通信の繋ぎ変え**:
    *   Phase 1 で作成した React Hooks の中身を、Tauri の `invoke` や `emit/listen` に書き換えます。

---

## 技術的な留意点と解決策

### 1. Python サイドカーのパッケージング
*   **現状**: `electron/resources/bin` にポータブル Python とライブラリを展開。
*   **Tauri**: `src-tauri/tauri.conf.json` の `bundle > resources` に Python ランタイムを含め、`externalBin` (Sidecar) にエントリポイントとなるバイナリを指定します。
*   **対策**: `prepare_sidecar.sh` を修正し、Tauri が期待するディレクトリ構造と命名規則で Python 環境を構築するようにします。

### 2. ウィンドウの質感的演出
*   **Vibrancy / Blur**: Tauri は Rust からネイティブの `NSVisualEffectView` (macOS) や `Acrylic` (Windows) を簡単に叩けます。
*   **クリック透過**: AI キャラクターの形状に合わせてウィンドウを抜いたり、クリックを背面に透過させたりする機能を、Backend (Rust) から制御します。

### 3. 設定管理の移行
*   **現状**: `electron-store` (JSON)。
*   **Tauri**: `confy` などの Rust クレートを使用するか、Python 側が持つ YAML 設定ファイルへの読み書き機能を Rust 経由でフロントエンドに公開します。

---

## 移行の判断基準（Go/No-Go）
以下の条件が揃った時が、本格的な移行のタイミングです。

- [ ] 現行 Electron 版での主要機能（追加学習、Twitch連携等）が全て実装完了している。
- [ ] UI が `shadcn/ui` ベースに刷新され、メンテナンス性が向上している。
- [ ] 開発者の Rust に対する意欲（または必要性）が高まっている。

---

## Twin-Orbit Note
> **Yang**: 「まずは Electron で shadcn/ui を使いこなして、最高の見た目を作ることに集中しよう！そこさえできれば、Tauri への引越しは私が完璧にエスコートするわ！」
>
> **In**: 「急がば回れや。一気に変えてバグまみれにするより、まずはフロントをモダンにしてから、後で Rust の高速道路に載っけるのが一番安全な『職人流』やで。」
