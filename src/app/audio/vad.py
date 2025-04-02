import numpy as np

class VoiceActivityDetector:
    def __init__(self, threshold: float = 0.003):  # 閾値を下げて感度を上げる
        self.threshold = threshold
        self._last_energy = 0.0  # 直前のエネルギー値を保存

    def is_speech(self, audio_data: np.ndarray) -> bool:
        """
        シンプルなエネルギーベースの音声検出
        audio_data: 音声データ（numpy配列）
        return: 音声が検出された場合True
        """
        # 音声データのRMSエネルギーを計算
        self._last_energy = np.sqrt(np.mean(audio_data ** 2))

        # デバッグ情報として現在のエネルギー値を出力
        print(f"Current energy: {self._last_energy:.6f}, Threshold: {self.threshold:.6f}")

        return self._last_energy > self.threshold
