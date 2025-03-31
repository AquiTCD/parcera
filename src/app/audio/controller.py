import asyncio
import numpy as np
import queue
import threading
import atexit
from typing import Callable, Optional
from difflib import SequenceMatcher
from faster_whisper import WhisperModel
from .vad import VoiceActivityDetector
from .stream import AudioInputStream

class AudioController:
    def __init__(
        self,
        status_callback: Optional[Callable[[str], None]] = None,
        transcription_callback: Optional[Callable[[str], None]] = None
    ):
        self.status_callback = status_callback
        self.transcription_callback = transcription_callback
        self.vad = VoiceActivityDetector()
        self.whisper_model = None
        self.audio_stream = None
        self.event_loop = None
        self.thread = None

        # 音声処理用の変数
        self.is_transcribing = False
        self.silence_counter = 0
        self.silence_limit = 12  # 無音判定のフレーム数（長めに設定して安定化）
        self.noise_threshold = 8  # ノイズ判定のフレーム数（長めに設定してノイズを除去）
        self.audio_data_list = []
        self.audio_queue = queue.Queue()

        # 重複防止用のキャッシュ
        self.last_transcription = ""
        self.min_text_diff_ratio = 0.3  # テキストの差異の最小比率

        # 終了時のクリーンアップを登録
        atexit.register(self.cleanup)

    def cleanup(self):
        """リソースのクリーンアップ"""
        if self.is_transcribing:
            self.stop_transcription()

    def notify_status(self, message: str):
        """ステータスメッセージを通知"""
        if self.status_callback:
            self.status_callback(message)

    def is_text_similar(self, text1: str, text2: str) -> bool:
        """2つのテキストの類似度を確認"""
        if not text1 or not text2:
            return False
        ratio = SequenceMatcher(None, text1, text2).ratio()
        return ratio > (1 - self.min_text_diff_ratio)

    def notify_transcription(self, text: str):
        """音声認識結果を通知"""
        text = text.strip()
        if self.transcription_callback and text:
            # 前回の認識結果と十分に異なる場合のみ通知
            if not self.is_text_similar(text, self.last_transcription):
                self.notify_status(f"音声認識結果: {text}")  # デバッグ用
                self.transcription_callback(text)
                self.last_transcription = text

    def process_audio(self, audio_data: np.ndarray, frames: int, time, status):
        """音声データの処理"""
        if not self.is_transcribing:  # 停止状態なら処理しない
            return

        try:
            is_speech = self.vad.is_speech(audio_data)

            if is_speech:
                self.silence_counter = 0
                self.audio_data_list.append(audio_data.flatten())
                self.notify_status("音声入力中...")  # デバッグ用
            else:
                self.silence_counter += 1

            # 一定時間無音が続いた場合の処理
            if not is_speech and self.silence_counter > self.silence_limit:
                self.silence_counter = 0

                if len(self.audio_data_list) > self.noise_threshold:
                    # 音声区間として処理
                    audio_segment = np.concatenate(self.audio_data_list)
                    self.audio_queue.put(audio_segment)
                    self.notify_status("音声区間を検出しました")  # デバッグ用

                self.audio_data_list.clear()

        except Exception as e:
            self.notify_status(f"音声処理エラー: {str(e)}")

    async def transcribe_audio(self):
        """音声認識の実行"""
        while self.is_transcribing:
            try:
                # キューから音声データを取得（タイムアウト付き）
                try:
                    self.notify_status("音声データ待機中...")  # デバッグ用
                    audio_data = self.audio_queue.get(timeout=3.0)
                    self.notify_status("音声認識処理中...")  # デバッグ用
                except queue.Empty:
                    continue

                if not self.is_transcribing:  # 停止状態なら処理しない
                    break

                # Whisperモデルで音声認識（パラメータを最適化）
                segments, info = self.whisper_model.transcribe(
                    audio=audio_data,
                    language="ja",
                    task="transcribe",
                    beam_size=5,        # ビームサーチの幅を増やして精度向上
                    best_of=5,          # 候補数を増やして最適な結果を選択
                    temperature=0.0,     # 決定的な出力を得る
                    condition_on_previous_text=False,  # 独立した認識を行う
                    vad_filter=True,    # VADフィルタリングを有効化
                    vad_parameters={"threshold": 0.5}  # VADの閾値
                )

                # 認識結果を通知
                transcribed = False
                for segment in segments:
                    if segment.text.strip():  # 空の結果は無視
                        self.notify_transcription(segment.text)
                        transcribed = True

                if not transcribed:
                    self.notify_status("音声認識結果が空でした")  # デバッグ用

            except Exception as e:
                self.notify_status(f"音声認識エラー: {str(e)}")

    def start_transcription(self, device_index: Optional[int] = None):
        """音声認識を開始"""
        try:
            # 既に実行中なら何もしない
            if self.is_transcribing:
                return

            # Whisperモデルの初期化（まだ初期化されていない場合）
            if self.whisper_model is None:
                self.notify_status("音声認識モデルをダウンロード/初期化中...")
                self.notify_status("(モデルのダウンロードには数分かかる場合があります)")

                self.whisper_model = WhisperModel(
                    model_size_or_path="kotoba-tech/kotoba-whisper-v2.0-faster",
                    device="cpu",
                    compute_type="int8",
                    download_root="./.models"  # モデルの保存先を指定
                )

                self.notify_status("音声認識モデルの準備が完了しました")

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
        try:
            asyncio.set_event_loop(self.event_loop)
            self.event_loop.run_until_complete(self.transcribe_audio())
        except Exception as e:
            self.notify_status(f"認識ループエラー: {str(e)}")  # デバッグ用

    def stop_transcription(self):
        """音声認識を停止"""
        try:
            if not self.is_transcribing:
                return

            self.is_transcribing = False

            # キューをクリア
            while not self.audio_queue.empty():
                try:
                    self.audio_queue.get_nowait()
                except queue.Empty:
                    break

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
                self.thread.join(timeout=1.0)  # タイムアウト付きで待機
                self.thread = None

            # データのクリア
            self.audio_data_list.clear()
            self.silence_counter = 0

            self.notify_status("音声認識を停止しました")

        except Exception as e:
            self.notify_status(f"停止エラー: {str(e)}")

    def get_available_devices(self) -> list:
        """利用可能な音声入力デバイスの一覧を取得"""
        return AudioInputStream.list_devices()
