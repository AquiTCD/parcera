# TRD: Twitch Chat & Event Integration

## 1. システムアーキテクチャ (Architecture)

Twitch連携は、以下の3層構造で実現する。
1.  **Backend (Python)**: `twitchAPI` ライブラリを使用してIRC（チャット）とEventSub（イベント）を処理。
2.  **Frontend (Electron)**: OAuth 認可フローの管理、トークンの保存、Twitch連携のON/OFF切替UI。
3.  **Communication**: WebSocket経由でイベント（`twitch_raid`, `twitch_chat`等）をフロントエンドに送信し、アバターのモーションをトリガー。

## 2. 実装詳細

### 2.1 使用ライブラリ
- **Python**: `twitchAPI` (v3+) - IRC/EventSubを単一ライブラリで扱え、非同期処理に強い。
- **Electron**: `electron-safe-storage` - アクセストークンの暗号化保存に使用。

### 2.2 認証フロー (OAuth 2.0 Authorization Code Flow)
1.  **認可の開始**: Electron の設定画面から「Twitch連携」ボタンを押下。ランダムな `state` 文字列を生成。
2.  **認可要求**: Twitch の認可 URL (`https://id.twitch.tv/oauth2/authorize`) を外部ブラウザまたは Electron サブウィンドウで開く。
    - 必須 Scope: `chat:read`, `chat:edit`, `channel:read:subscriptions`, `moderation:read`.
3.  **コードのキャッチ**: 認可後、`http://localhost:8677` にリダイレクト。Electron 内のローカルサーバー、またはカスタムプロトコル (`parcera://`) で `code` を受け取る。
4.  **トークン交換**: 取得した `code` を Client ID / Secret と共に Twitch サーバーへ送信し、`access_token` と `refresh_token` を取得。
5.  **セキュア保存**: `electron-safe-storage` を使用してトークンを暗号化し、ローカルに保存。
6.  **自動更新 (Refresh)**: `access_token` の有効期限が切れる前に、`refresh_token` を使用してバックグラウンドで自動更新を行う（Python エンジン内の `twitchAPI` が担当）。

### 2.3 チャット・イベント処理ロジック
- **TwitchListenerモジュール**:
    - `EventSub` (WebSocket) を購読し、Raid, Follow, Subscription を検知。
    - `Chat` (IRC) を購読し、正規表現で Wake Word (`Parcera|パルセラ`) を抽出。
- **Dynamic Response Delay (動的待機時間)**:
    - 外部の読み上げツール（棒読みちゃん等）の読み上げ終了を待つため、チャットの文字数に応じた待機時間を計算。
    - **計算式**: `Delay = Base_Delay + (Char_Count * Seconds_Per_Char)`
    - デフォルト設定値:
        - `Base_Delay`: 1.5s（処理開始の最小バッファ）
        - `Seconds_Per_Char`: 0.2s（1文字あたりの平均読み上げ速度）
    - 例：1文字「草」なら約1.7秒、20文字なら約5.5秒待機してから返答を開始。
- **レートリミット管理**:
    - `In-Memory Map` を使用し、`last_response_times` を秒単位で管理。
- **排他制御**:
    - `VoiceInputStatus` フラグを確認。配信者が会話中の場合、チャットからの応答生成を一時停止し、キューに入れる。

### 2.4 LLMプロンプト注入
- チャットから入力を受け取る際、以下のメタデータと **応答指示** をプロンプトに付与する：
  ```text
  [Context: Twitch Chat Response]
  [From: ユーザー名]
  [Event: Normal Chat / Raid / Subscription]
  [Streamer Speaking Status: true/false]

  指示:
  1. 視聴者の [From: ユーザー名] に対して、親しみやすく返答してください。
  2. 返答の冒頭、または文中で必ず相手の名前を含めてください。
  3. テキストチャットを読み上げる形になるため、音声に適した簡潔な表現を心がけてください。

  本文: ...
  ```

### 2.5 フィルタリング & モデレーション
- **User Blacklist**:
  - `Set[str]` 構造で無視するユーザーIDを管理。O(1) でチェック。
- **Word Blacklist**:
  - `List[re.Pattern]` もしくは `Trie` 木を使用して、チャット本文からNGワードを高速に検出。
  - マッチした場合は `TwitchEvent` の伝搬を即座に破棄。

### 2.6 割り込み制御の実装 (Interrupt State Machine)
- `ConversationManager` が以下の状態を管理：
  - `IDLE`: 待機中。チャット・ボイス両方を受け付け。
  - `STREAMER_TALKING`: 配信者が発話中。チャットはキューに入れる。
  - `AVATAR_RESPONDING`: アバターが配信者に返答中。チャットはキューに入れ、視線のみチャット欄へ動かすシグナルを送信。
- **キューイング戦術**:
  - キューには最新の1件のみ保持（古い呼びかけは破棄）し、会話終了直後に「そういえば、[User]が〜って言ってたよ」といった自然な導入をプロンプトで促す。

## 3. データフロー

1. **Twitch (IRC/EventSub)** -> **Python (Listener)**
2. **Python** -> (Wake Word/Cooldown Check) -> **LLM**
3. **LLM Response** -> **TTS** & **Visual Signal (Expression/Motion)**
4. **Visual Signal** -> **Frontend (WebSocket)** -> **Avatar Display**

## 4. 課題と対策 (Challenges)
- **Token Expiry**: リフレッシュトークンの自動更新処理をPython側で実装。
- **Channel Points**: 次のフェーズとして、カスタム報酬（`RewardID`）を検知してアバターの着替えや性格変化をトリガーする拡張性を残す。
- **Security**: アクセストークンの漏洩を防ぐため、ログにはトークンを出さない。Client Secret は環境変数またはバイナリ内に暗号化して保持（要検討）。

## 5. ロードマップ (Phased Implementation Roadmap)

### Phase 1: Authentication & Developer Portal
- [ ] Twitch Developer Console での App 登録と Client ID/Secret の取得。
- [ ] Electron 側での OAuth 2.0 認可フロー (Local Loopback Server 方式) の実装。
- [ ] `safeStorage` によるトークンの暗号化保存とリフレッシュロジック。

### Phase 2: Basic Chat & Filtering
- [ ] Python側 `twitchAPI` (IRC) 接続。
- [ ] Wake Word 抽出、User/Word ブラックリストによるフィルタリング実装。

### Phase 3: EventSub & State Machine
- [ ] EventSub (WebSocket) による Raid などのイベント検知。
- [ ] 配信者との会話優先度・割り込み制御（State Machine）の実装。

### Phase 4: Polish & Performance
- [ ] 視覚的フィードバック（チャット欄を見る、エモート連動）の追加。
- [ ] チャンネルポイント連携などの拡張機能。
