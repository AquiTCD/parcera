import tkinter as tk

class ParceraApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Parcera")

        # ウィンドウサイズの設定
        self.root.geometry("400x300")

        # メインフレーム
        self.main_frame = tk.Frame(self.root)
        self.main_frame.pack(expand=True, fill='both', padx=20, pady=20)

        # Hello Worldラベル
        self.label = tk.Label(
            self.main_frame,
            text="Hello World!",
            font=("Helvetica", 24)
        )
        self.label.pack(expand=True)

def main():
    root = tk.Tk()
    app = ParceraApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
