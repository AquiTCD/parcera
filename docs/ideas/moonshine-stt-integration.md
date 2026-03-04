# Idea: Moonshine STT Integration for Parcera

## 概要
Google DeepMind (Moonshine AI) が公開した、低遅延・高精度な音声認識（ASR）モデル **Moonshine** を parcera の STT バックエンドとして統合する。

## 背景
現在使用している Kotoba-Whisper などの技術は OpenAI Whisper ベースのため、音声データの長さに依らず一定の処理コスト（30秒のパディング等）が発生し、特に短文の発話に対するレスポンスに遅延が生じる。Moonshine は可変長入力をサポートし、音声の長さに比例した計算量で動くため、リアルタイムでの会話のレスポンス向上に期待ができる。

## ✅ メリット (Pros)
- **圧倒的な低遅延 (Low Latency)**: 
  - 音声が短いほど速く終わる。200ms 以下のレスポンスが可能。
- **日本語に強い小規模モデル**: 
  - `tiny-ja` / `base-ja` モデルが公式提供されており、Whisper Tiny/Base よりも大幅に精度が良い（CER 18.3 程度）。
- **エッジデバイスへの最適化**: 
  - MacBook Pro や Raspberry Pi 5 でも CPU 負荷を抑えた高速動作が可能。
- **シンプルな API**: 
  - `moonshine-voice` パッケージにより、数行の Python コードで組み込める。

## ⚠️ 懸念・注意点 (Cons/Caveats)
- **入力サンプリングレート**: 
  - 16kHz Float32 (1ch) 固定であるため、正確に変換して渡す必要がある。
- **モデルのディスク・メモリ容量**: 
  - `tiny-ja`, `base-ja` など複数モデルがあるため、Settings で選択・ダウンロード管理が必要。
- **Mac (Apple Silicon) への最適化状況**: 
  - PyTorch や CoreML バックエンドがどの程度有効に働くか、実機でのベンチマークが必要。
- **依存関係**: 
  - `moonshine-voice` を `pyproject.toml` に追加する必要がある。

## 🛠️ 実装イメージ (stt.py)
```python
import moonshine_voice
from aiavatar.sts.stt import SpeechRecognizer

class MoonshineRecognizer(SpeechRecognizer):
    def __init__(self, model_name="tiny-ja"):
        model_path, model_arch = moonshine_voice.get_model_for_language("ja")
        self.transcriber = moonshine_voice.Transcriber(model_path, model_arch)

    async def transcribe(self, data: bytes, session_id: str = None) -> str:
        # 16kHz float への変換が必要
        audio_float32 = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        transcript = self.transcriber.transcribe_without_streaming(audio_float32)
        return "".join([l.text for l in transcript.lines])
```

## 今後の展望
`local` 設定において、Kotoba-Whisper（高精度志向）と Moonshine（爆速レスポンス志向）をユーザーが選択できるようにする。
