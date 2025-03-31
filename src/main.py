import tkinter as tk
from app.ui import ParceraUI

def main():
    root = tk.Tk()
    app = ParceraUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
