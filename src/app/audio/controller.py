import asyncio
import numpy as np
import queue
import threading
from typing import Callable, Optional
from faster_whisper import WhisperModel
from .vad import VoiceActivityDetector
from .stream import AudioInputStream

class AudioController:
    def __init__(self, status_callback: Optional[Callable[[str], None]] = None):
        self.status_callback = status_callback
        self.vad = VoiceActivityDetector()
        self.whisper_model = None
        self.audio_stream = None
        self.event_loop = None
        self.thread = None

        # 音声処理用の変数
        self.is_transcribing = False
        self.silence_counter = 0
        self.silence_limit = 8  # 無音判定のフレーム数
        self.noise_threshold = 5  # ノイズ判定のフレーム数
        self.audio_data_list = []
        self.audio_queue = queue.Queue()

    def notify_status(self, message: str):
        """ステータスメッセージを通知"""
        if self.status_callback:
            self.status_callback(message)

    def process_audio(self, audio_data: np.ndarray, frames: int, time, status):
        """音声データの処理"""
        try:
            is_speech = self.vad.is_speech(audio_data)

            if is_speech:
                self.silence_counter = 0
                self.audio_data_list.append(audio_data.flatten())
            else:
                self.silence_counter += 1

            # 一定時間無音が続いた場合の処理
            if not is_speech and self.silence_counter > self.silence_limit:
                self.silence_counter = 0

                if len(self.audio_data_list) > self.noise_threshold:
                    # 音声区間として処理
                    audio_segment = np.concatenate(self.audio_data_list)
                    self.audio_queue.put(audio_segment)

                self.audio_data_list.clear()

        except Exception as e:
            self.notify_status(f"音声処理エラー: {str(e)}")

    async def transcribe_audio(self):
        """音声認識の実行"""
        while self.is_transcribing:
            try:
                # キューから音声データを取得（タイムアウト付き）
                try:
                    audio_data = self.audio_queue.get(timeout=3.0)
                except queue.Empty:
                    continue

                # Whisperモデルで音声認識
                segments, _ = self.whisper_model.transcribe(
                    audio=audio_data,
                    language="ja",
                    task="transcribe"
                )

                # 認識結果を通知
                for segment in segments:
                    self.notify_status(f"認識結果: {segment.text}")

            except Exception as e:
                self.notify_status(f"音声認識エラー: {str(e)}")

    def start_transcription(self, device_index: Optional[int] = None):
        """音声認識を開始"""
        try:
            # Whisperモデルの初期化（まだ初期化されていない場合）
            if self.whisper_model is None:
                self.whisper_model = WhisperModel(
                    model_size_or_path="base",
                    device="cpu",
                    compute_type="int8"
                )

            # イベントループの設定
            self.event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.event_loop)

            # 音声入力ストリームの開始
            self.audio_stream = AudioInputStream(
                callback=self.process_audio,
                device_index=device_index
            )
            self.audio_stream.start()

            # 音声認識スレッドの開始
            self.is_transcribing = True
            self.thread = threading.Thread(
                target=self._run_transcription_loop,
                daemon=True
            )
            self.thread.start()

            self.notify_status("音声認識を開始しました")

        except Exception as e:
            self.notify_status(f"開始エラー: {str(e)}")
            self.stop_transcription()

    def _run_transcription_loop(self):
        """音声認識ループの実行（別スレッド）"""
        asyncio.set_event_loop(self.event_loop)
        self.event_loop.run_until_complete(self.transcribe_audio())

    def stop_transcription(self):
        """音声認識を停止"""
        try:
            self.is_transcribing = False

            # 音声入力ストリームの停止
            if self.audio_stream:
                self.audio_stream.stop()
                self.audio_stream.close()
                self.audio_stream = None

            # イベントループの停止
            if self.event_loop:
                self.event_loop.stop()
                self.event_loop.close()
                self.event_loop = None

            # スレッドの終了待機
            if self.thread and self.thread.is_alive():
                self.thread.join()
                self.thread = None

            # データのクリア
            self.audio_data_list.clear()
            while not self.audio_queue.empty():
                self.audio_queue.get_nowait()

            self.notify_status("音声認識を停止しました")

        except Exception as e:
            self.notify_status(f"停止エラー: {str(e)}")

    def get_available_devices(self) -> list:
        """利用可能な音声入力デバイスの一覧を取得"""
        return AudioInputStream.list_devices()
