# PARCERA

PARCERAは、音声による対話型AIアシスタントアプリケーションです。ユーザーの音声入力を検知し、AIによる応答を音声で返すことで、自然な対話体験を提供します。

## 機能概要

- マイクを通じた音声入力の検知
- 音声のテキスト変換（Whisper）
- AIによる応答生成（Google Gemini）
- テキストの音声合成（Aivis Engine）
- 合成音声の再生

## 技術スタック

- 言語: Python
- パッケージマネージャー: uv
- GUI: Tkinter
- 音声認識: kotoba-whisper
- 大規模言語モデル: Google Gemini API
- 音声合成: Aivis Engine
- アプリケーションビルド: PyInstaller

## システムフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as PARCERAアプリ
    participant Mic as マイク入力
    participant Whisper as kotoba-whisper
    participant Gemini as Google Gemini
    participant Aivis as Aivis Engine
    participant Speaker as スピーカー

    User->>Mic: 音声入力
    Mic->>App: 音声データ取得
    App->>Whisper: 音声データ送信
    Whisper->>App: テキストに変換
    App->>Gemini: テキストを送信
    Gemini->>App: AI応答を返信
    App->>Aivis: テキストを送信
    Aivis->>App: 音声ファイル(WAV)生成
    App->>Speaker: 音声再生
    Speaker->>User: 音声出力
```

## 必要な環境設定

- macOS（PyInstallerによるネイティブアプリケーションとして動作）
- マイク入力デバイス
- 以下のAPIキー：
  - Google Gemini API
  - Aivis Engine API

## インストール方法

（Coming Soon）

## 使用方法

（Coming Soon）

## ライセンス

（Coming Soon）
