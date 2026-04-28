import os
import sys

IS_WINDOWS: bool = sys.platform == "win32"
IS_MACOS: bool = sys.platform == "darwin"


def app_support_base(app_name: str) -> str:
    """Return the OS-appropriate application support directory for app_name."""
    if IS_WINDOWS:
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.path.expanduser("~/Library/Application Support")
    return os.path.join(base, app_name)
