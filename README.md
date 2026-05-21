# Parcera

**Parcera** は、AIアバターとリアルタイムで会話できるデスクトップアプリです。
マイクから声を認識し、LLMが生成した応答をアバターが音声合成（TTS）で返します。OBSでキャプチャして配信に使えます。

macOS・Windows対応。

---

## 機能

### 音声処理パイプライン

- **STT（音声認識）**: Moonshine（デフォルト・ローカル）/ Faster-Whisper / Google Cloud / Azure
- **LLM（応答生成）**: Google Gemini / OpenAI / ローカルLLM（macOS・MLX）
- **TTS（音声合成）**: AivisSpeech（推奨）/ VOICEVOX / Google Cloud TTS

### アバター

- リップシンク（口パク）と呼吸アニメーション
- PNG スプライトによるカスタムアバター対応
- 背景透過ウィンドウ（OBSウィンドウキャプチャ対応）
- クロマキー対応

### 配信連携

- **Twitch**: チャットへの自動応答、フォロー・レイド・サブスクライブイベントへの反応
- **OBSブラウザソース**: HTTPポート経由でアバターをブラウザソースとして表示

### その他

- ローカルLLM微調整（LoRAアダプター作成・適用）
- 設定のホットリロード（アプリ再起動不要で反映）
- AI・ユーザー用の独立ウィンドウ（2画面構成）

---

## 対応OS

| OS | 対応状況 | 備考 |
|---|---|---|
| macOS | ✅ フル対応 | Apple Silicon / Intel |
| Windows | ✅ 対応 | ローカルLLM（MLX）は非対応 |

---

## インストール

[Releases](https://github.com/AquiTCD/parcera/releases) から最新版をダウンロードしてインストールしてください。

| プラットフォーム | ファイル |
|---|---|
| macOS | `.dmg` |
| Windows | `.msi` または `.exe` |

### macOS で「壊れているため開けません」と表示される場合

配布しているアプリは現在コード署名・Notarization を行っていないため、macOS Gatekeeper がブロックします。以下いずれかの方法で開けます。

**方法 A：システム設定から許可する（推奨）**

1. Finder で Parcera.app をダブルクリック（エラーが出てOK）
2. **システム設定 → プライバシーとセキュリティ** を開く
3. 画面下部に表示される「"Parcera"はブロックされました」の横の **「このまま開く」** をクリック
4. パスワードを入力して許可

一度許可すれば次回以降は通常通り起動できます。

**方法 B：ターミナルで隔離属性を削除する**

```bash
xattr -cr /Applications/Parcera.app
```

---

## 必要なもの

### TTS エンジン（いずれか必須）

アプリ起動前に、以下のいずれかをインストールして起動しておいてください。

- **[AivisSpeech](https://github.com/Aivis-Project/AivisSpeech)**（推奨）— VOICEVOX互換、高品質な日本語TTS
- **[VOICEVOX](https://voicevox.hiroshiba.jp/)**

Google Cloud TTS を使う場合は、アプリ内の詳細設定でAPIキーを設定することでエンジン不要で利用できます。

### LLM APIキー（いずれか）

| プロバイダー | 取得先 |
|---|---|
| Google Gemini（推奨） | [Google AI Studio](https://aistudio.google.com/) |
| OpenAI | [OpenAI Platform](https://platform.openai.com/) |
| ローカルLLM | APIキー不要（macOSのみ、初回モデルダウンロード約6GB） |

---

## 初期設定

1. アプリを起動します
2. メニューバー → **Preferences**（またはキーボードショートカット）を開きます
3. 以下を設定します：

**キャラクター設定**
- AI・ユーザーの名前やプロフィール

**マイク・入力**
- STTプロバイダーの選択
- マイク感度・応答感度の調整

**詳細設定**
- LLMプロバイダーとAPIキー
- TTSプロバイダーとスピーカーID

---

## Twitch 連携

設定画面の「連携」タブから設定できます。

1. [Twitch Developer Console](https://dev.twitch.tv/console) でアプリを登録し、Client ID・Client Secretを取得
2. OAuth Redirect URL に `http://localhost:8678/twitch/callback` を登録
3. アプリの設定画面にClient ID・Secretを入力して認証

設定できる項目：応答速度、クールダウン、ウェイクワード、NGワード、除外ユーザーなど。

---

## OBS 連携

### ウィンドウキャプチャ（推奨）

アバターウィンドウは背景透過で動作しているため、OBSの「ウィンドウキャプチャ」ソースでそのままキャプチャできます。

### ブラウザソース

HTTPポート（デフォルト: `8677`）でアバターにアクセスできます。`?type=` でどちらのアバターを表示するか指定してください。

```
http://localhost:8677/obs.html?type=ai    # AI アバター
http://localhost:8677/obs.html?type=user  # ユーザーアバター
```

ポート番号はアプリの開発者設定から変更できます。

---

## アバターのカスタマイズ

アバター画像は PNG スプライトで差し替えられます。以下のファイルを用意して設定画面で指定してください。

| ファイル名 | 用途 |
|---|---|
| `base.png` | 通常（口閉じ） |
| `a.png` `e.png` `i.png` `o.png` `u.png` | 母音別口形 |
| `closed.png` | 発話停止時 |

---

## 開発者向けセットアップ

```bash
# 依存関係インストール
uv sync
pnpm -C ui install

# 開発サーバー起動
mise run dev

# ビルド（サイドカー準備 + Tauri）
mise run package
```

**必要なツール**: `mise`, `uv`, `pnpm`, Rust toolchain

macOS で `uv sync` を使う場合は PortAudio も必要です（アプリ本体にはバンドル済みのため、エンドユーザーは不要）。

```bash
brew install portaudio
```

---

## ライセンス

MIT
