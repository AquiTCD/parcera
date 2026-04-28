import os
import sys
import logging
import subprocess
from typing import Callable, Optional
from core.platform_utils import IS_MACOS, app_support_base

logger = logging.getLogger(__name__)

_APP_SUPPORT_BASE = os.path.join(app_support_base("Parcera"), "optional-packages")

OPTIONAL_PACKAGE_SETS: dict = {
    "moonshine": {
        "packages": ["moonshine-voice"],
        "install_dir": "moonshine",
        "install_with_deps": True,   # onnxruntime etc. are C-extension deps
        "size_mb": 120,
    },
    "faster_whisper": {
        # transformers is only needed for the [conversion] extra, not inference
        # onnxruntime is a true runtime dep (Silero VAD) per Requires-Dist
        "packages": ["faster-whisper", "ctranslate2", "av", "onnxruntime"],
        "install_dir": "faster_whisper",
        "install_with_deps": False,  # pure-Python deps already in bundle
        "size_mb": 200,
    },
}


_INSTALL_TIMEOUT_SEC = 300


def get_install_dir(provider: str) -> str:
    if provider not in OPTIONAL_PACKAGE_SETS:
        raise ValueError(f"Unknown provider: {provider!r}. Valid providers: {list(OPTIONAL_PACKAGE_SETS)}")
    pkg_set = OPTIONAL_PACKAGE_SETS[provider]
    return os.path.join(_APP_SUPPORT_BASE, pkg_set["install_dir"])


def is_installed(provider: str) -> bool:
    install_dir = get_install_dir(provider)
    if not os.path.isdir(install_dir):
        return False
    entries = [e for e in os.listdir(install_dir) if not e.startswith(".")]
    return len(entries) > 0


def patch_sys_path() -> None:
    for provider in OPTIONAL_PACKAGE_SETS:
        install_dir = get_install_dir(provider)
        if os.path.isdir(install_dir) and install_dir not in sys.path:
            sys.path.insert(0, install_dir)
            logger.info(f"optional-packages: added {install_dir} to sys.path")


def install(
    provider: str,
    progress_callback: Optional[Callable[[dict], None]] = None,
) -> None:
    if provider not in OPTIONAL_PACKAGE_SETS:
        raise ValueError(f"Unknown provider: {provider!r}. Valid providers: {list(OPTIONAL_PACKAGE_SETS)}")
    pkg_set = OPTIONAL_PACKAGE_SETS[provider]
    install_dir = get_install_dir(provider)
    os.makedirs(install_dir, exist_ok=True)

    python_bin = sys._base_executable
    packages = pkg_set["packages"]
    cmd = [python_bin, "-m", "pip", "install", "--target", install_dir]

    if not pkg_set["install_with_deps"]:
        cmd.append("--no-deps")

    cmd.extend(packages)

    logger.info(f"optional-packages: installing {packages} to {install_dir}")
    logger.info(f"cmd: {' '.join(cmd)}")

    if progress_callback:
        progress_callback({"status": "installing", "progress": 0, "provider": provider})

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=_INSTALL_TIMEOUT_SEC)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"pip install timed out after {_INSTALL_TIMEOUT_SEC}s for {provider!r}")

    if result.returncode != 0:
        logger.error(f"optional-packages: install failed:\n{result.stderr}")
        raise RuntimeError(f"pip install failed: {result.stderr}")

    if install_dir not in sys.path:
        sys.path.insert(0, install_dir)

    if IS_MACOS:
        subprocess.run(
            ["xattr", "-dr", "com.apple.quarantine", install_dir],
            capture_output=True
        )

    logger.info(f"optional-packages: {provider} installed successfully")
    if progress_callback:
        progress_callback({"status": "complete", "progress": 100, "provider": provider})
