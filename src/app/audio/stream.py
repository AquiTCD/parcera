import pyaudio
import numpy as np
from typing import Callable, Optional

class AudioInputStream:
    def __init__(self, callback: Callable, device_index: Optional[int] = None):
        self.callback = callback
        self.device_index = device_index
        self.stream = None
        self.pyaudio = None

        # 音声入力の設定（高品質化）
        self.format = pyaudio.paFloat32
        self.channels = 1
        self.rate = 16000
        self.chunk = 1024  # バッファサイズを増やして安定性を向上

    def start(self):
        """音声入力ストリームを開始"""
        self.pyaudio = pyaudio.PyAudio()

        def pyaudio_callback(in_data, frame_count, time_info, status):
            audio_data = np.frombuffer(in_data, dtype=np.float32)
            self.callback(audio_data, frame_count, time_info, status)
            return (in_data, pyaudio.paContinue)

        self.stream = self.pyaudio.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            input_device_index=self.device_index,
            frames_per_buffer=self.chunk,
            stream_callback=pyaudio_callback
        )
        self.stream.start_stream()

    def stop(self):
        """音声入力ストリームを停止"""
        if self.stream:
            self.stream.stop_stream()

    def close(self):
        """ストリームとPyAudioインスタンスを解放"""
        if self.stream:
            self.stream.close()
        if self.pyaudio:
            self.pyaudio.terminate()

    @staticmethod
    def list_devices() -> list:
        """利用可能な音声入力デバイスの一覧を取得"""
        p = pyaudio.PyAudio()
        devices = []

        for i in range(p.get_device_count()):
            device_info = p.get_device_info_by_index(i)
            if device_info['maxInputChannels'] > 0:  # 入力デバイスのみ
                devices.append({
                    'index': i,
                    'name': device_info['name'],
                    'channels': device_info['maxInputChannels'],
                    'sample_rate': int(device_info['defaultSampleRate'])
                })

        p.terminate()
        return devices
