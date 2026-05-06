# OBS Browser Source 対応 PRD

## 1. 目的

OBS の「ブラウザソース（Browser Source）」として Parcera のアバターを直接読み込み、ウィンドウキャプチャ不要でシームレスに配信に組み込む。

## 2. ユーザー体験

- 設定画面の「OBS Browser Source URL」から `file://` URI をコピーするだけで OBS に追加できる
- **OBS を先に起動してから Parcera を起動しても正常に動作する**（`file://` 読み込みのため）
- Parcera を再起動しても OBS 側での手動更新は不要（WS が自動再接続する）
- AI アバターの口パクアニメが OBS 上でリアルタイムに動作する
- ユーザーアバターも OBS Browser Source として追加でき、Python のマイク解析と同期して口パクが動く
- カスタムアバターの変更・クロマキー設定が OBS 側に即座に反映される

## 3. スコープ

### 今回含む
- AI アバター OBS Browser Source 対応（TTS 音声受信 + 口パク）
- ユーザーアバター OBS Browser Source 対応（Python マイク解析による口パク）
- Python による直接マイク収音・STT 収音の一本化
- アバタースプライトの HTTP プロキシ配信
- クロマキー・フリップ水平対称の OBS 適用

### 含まない
- OBS カスタムブラウザドック（設定 UI の OBS 埋め込み）
- Tauri アバターウィンドウの OBS モード時自動非表示
