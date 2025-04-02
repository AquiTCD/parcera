import tkinter as tk
import os
import sys
import atexit
from pathlib import Path
from app.ui import ParceraUI

def get_lock_file():
    """アプリケーションのロックファイルパスを取得"""
    app_support_dir = Path.home() / "Library" / "Application Support" / "Parcera"
    app_support_dir.mkdir(parents=True, exist_ok=True)
    return app_support_dir / "app.lock"

def cleanup_lock():
    """ロックファイルを削除"""
    try:
        lock_file = get_lock_file()
        if lock_file.exists():
            lock_file.unlink()
    except Exception:
        pass

def is_already_running():
    """既に別のインスタンスが実行中かどうかをチェック"""
    lock_file = get_lock_file()

    if lock_file.exists():
        # ロックファイルが存在する場合
        try:
            # 既存のプロセスが実際に動いているか確認
            with open(lock_file, 'r') as f:
                pid = int(f.read().strip())
            try:
                # プロセスが存在するか確認
                os.kill(pid, 0)
                return True
            except OSError:
                # プロセスが存在しない場合は古いロックファイルを削除
                cleanup_lock()
        except (ValueError, IOError):
            # ロックファイルが不正な場合は削除
            cleanup_lock()

    # 新しいロックファイルを作成
    try:
        with open(lock_file, 'w') as f:
            f.write(str(os.getpid()))
        # 終了時のクリーンアップを登録
        atexit.register(cleanup_lock)
        return False
    except IOError:
        return True

def main():
    # 既に実行中の場合は終了
    if is_already_running():
        print("既に Parcera は実行中です。")
        sys.exit(1)

    root = tk.Tk()
    app = ParceraUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
