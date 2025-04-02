import numpy as np

class VoiceActivityDetector:
    def __init__(self, threshold: float = 0.008):  # さらに感度を上げる
        self.threshold = threshold

    def is_speech(self, audio_data: np.ndarray) -> bool:
        """
        シンプルなエネルギーベースの音声検出
        audio_data: 音声データ（numpy配列）
        return: 音声が検出された場合True
        """
        # 音声データのRMSエネルギーを計算
        energy = np.sqrt(np.mean(audio_data ** 2))
        return energy > self.threshold
