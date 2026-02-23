# TRD: GUI Settings System

## 1. システム構成 (Architecture)
React による Single Page Component と、Electron IPC によるメインプロセスとの通信で構成される。

### 1.1 使用技術
- **Library**: React 19
- **Communication**: Electron `ipcRenderer` (via `preload.ts`)
- **Styles**: Vanilla CSS (CSS Variables)

## 2. 実装詳細 (Implementation Details)

### 2.1 データ管理フロー
1.  **起動時**: `Main Process` が YAML を読み込み、`getSettings` IPC を通じて `Renderer` に渡す。
2.  **編集時**: `useSettingsState` カスタムフックがメモリ上のステートを更新。
3.  **保存時**: `saveSettings` IPC で `Main Process` にデータを送り、YAML ファイルとして物理保存。同時に、起動中の Python エンジンへ「設定更新通知」を送る。

### 2.2 IPC 定義 (`electron/main/preload.ts`)
- `getSettings()`: 現在の設定を取得。
- `saveSettings(settings)`: 設定を保存。
- `onLogMessage(callback)`: Python の ログを受け取るリスナー。
- `checkModelCached(modelName)` / `downloadModel(modelName)`: モデル管理用。

### 2.3 特殊な UI コンポーネント
- **`LogTab.tsx`**: 
    - 取得したログ配列を表示。
    - メモリ節約のため最新100件に制限し、最下部へ自動スクロール。
- **`STTTab.tsx`**: 
    - `EventSource` (SSE) または `setInterval` によるポーリングでモデルダウンロードの進捗 (%) を表示。

## 3. データ定義 (ERD / Data Structures)

### 3.1 `ParceraSettings` 型定義
`electron/shared/types.ts` に定義。
```typescript
interface ParceraSettings {
  log_level: string;
  simple_log: boolean;
  ai_profile: AIProfile;
  stt: STTSettings;
  llm: LLMSettings;
  tts: TTSSettings;
  electron: ElectronSettings;
  // ...他
}
```
- **Nested Update**: 深い階層の設定を変更するための `updateNested` ユーティリティにより、イミュータブルなステート更新を実現。
