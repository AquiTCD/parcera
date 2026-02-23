# TRD: Twitch Integration (Idea)

## 1. システム構成案 (Architecture)
Python エンジン側に Twitch 連携モジュールを追加し、WebSocket を通じてフロントエンドへ情報を流す。

### 1.1 使用技術候補
- **Twitch API**: `twitchAPI` (Python library)
- **IRC**: `websockets` または標準の `socket`
- **Authentication**: Electron 内でブラウザを開き、OAuth ログイントークンを取得。

## 2. 実装の方向性

### 2.1 データフロー
1.  **Twitch Plugin (Sidecar)**: チャットルームに常駐し、フィルタリングされたメッセージを LLM キューに送る。
2.  **Meta-Context**: 「今、配信中でチャットが盛り上がっている」といった情報を LLM のシステムプロンプトに動的に注入。
3.  **Visual Feedback**: 特定のイベント（ギフト等）を受信した際、フロントエンドに `event: cheers` 等のシグナルを送り、アバターに特別なアニメーションを再生させる。

## 3. 懸念事項
- **セキュリティ**: ユーザーのアクセストークンの安全な保存場所。
- **レートリミット**: Twitch API の制限に抵触しない設計。
