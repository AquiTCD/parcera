import tkinter as tk
from tkinter import ttk
from .audio.controller import AudioController

class ParceraUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Parcera")

        # 音声コントローラーの初期化
        self.audio_controller = AudioController(status_callback=self.update_status)

        # ウィンドウサイズの設定
        self.root.geometry("400x400")

        # メインフレーム
        self.main_frame = tk.Frame(self.root)
        self.main_frame.pack(expand=True, fill='both', padx=20, pady=20)

        # ステータスラベル
        self.status_label = tk.Label(
            self.main_frame,
            text="音声入力待機中",
            font=("Helvetica", 16),
            wraplength=360  # 長いテキストの折り返し
        )
        self.status_label.pack(expand=True)

        # デバイス選択用コンボボックス
        self.devices = self.audio_controller.get_available_devices()
        self.device_frame = tk.Frame(self.main_frame)
        self.device_frame.pack(fill='x', pady=(0, 10))

        tk.Label(
            self.device_frame,
            text="入力デバイス:"
        ).pack(side='left')

        self.device_var = tk.StringVar()
        self.device_combo = ttk.Combobox(
            self.device_frame,
            textvariable=self.device_var,
            state='readonly',
            width=30
        )
        self.device_combo['values'] = [d['name'] for d in self.devices]
        if self.devices:
            self.device_combo.current(0)
        self.device_combo.pack(side='left', padx=(5, 0))

        # 音声入力ボタン
        self.record_button = tk.Button(
            self.main_frame,
            text="音声入力開始",
            command=self.toggle_transcription,
            width=20,
            height=2
        )
        self.record_button.pack(expand=False, pady=10)

        # 終了時のクリーンアップ
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def get_selected_device_index(self) -> int:
        """選択されたデバイスのインデックスを取得"""
        if not self.devices:
            return None
        selected = self.device_combo.current()
        return self.devices[selected]['index'] if selected >= 0 else None

    def toggle_transcription(self):
        """音声入力の開始/停止を切り替え"""
        if not self.audio_controller.is_transcribing:
            device_index = self.get_selected_device_index()
            self.audio_controller.start_transcription(device_index)
            self.record_button.config(text="音声入力停止")
            self.device_combo.config(state='disabled')
        else:
            self.audio_controller.stop_transcription()
            self.record_button.config(text="音声入力開始")
            self.device_combo.config(state='readonly')

    def update_status(self, status: str):
        """ステータスラベルの更新"""
        self.status_label.config(text=status)

    def on_closing(self):
        """アプリケーション終了時の処理"""
        if self.audio_controller.is_transcribing:
            self.audio_controller.stop_transcription()
        self.root.destroy()
