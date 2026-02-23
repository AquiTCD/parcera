import logging
import sys
from tqdm.auto import tqdm
from faster_whisper.utils import download_model

logger = logging.getLogger(__name__)


class LoggingTqdm(tqdm):
    """A tqdm subclass that captures progress for SSE streaming."""

    # Class-level shared state for the current download
    _current_progress: dict | None = None

    def __init__(self, *args, **kwargs):
        # Prevent "Unknown argument" error by removing non-tqdm arguments
        # that huggingface_hub might pass down.
        kwargs.pop("name", None)

        kwargs["disable"] = False
        kwargs.setdefault("unit", "B")
        kwargs.setdefault("unit_scale", True)
        # Redirect to stdout to avoid [Python Error] tag in sidecar logs
        kwargs.setdefault("file", sys.stdout)
        super().__init__(*args, **kwargs)

    def update(self, n=1):
        super().update(n)
        # Safely check for total attribute
        total = getattr(self, "total", None)
        if total and total > 0:
            pct = int(self.n / total * 100)
            mb_done = self.n / (1024 * 1024)
            mb_total = total / (1024 * 1024)
            desc = getattr(self, "desc", "file")
            LoggingTqdm._current_progress = {
                "progress": pct,
                "downloaded_mb": round(mb_done, 1),
                "total_mb": round(mb_total, 1),
                "file": desc,
            }


    @classmethod
    def get_progress(cls) -> dict | None:
        return cls._current_progress

    @classmethod
    def reset_progress(cls):
        cls._current_progress = None


def check_model_cached(model_name: str) -> bool:
    """Check if a Whisper model is already in the HuggingFace cache."""
    try:
        download_model(model_name, local_files_only=True)
        return True
    except Exception:
        return False


def download_model_with_progress(model_name: str) -> str:
    """
    Download a Whisper model with progress tracking.
    Progress is stored in LoggingTqdm._current_progress for SSE polling.

    Returns the path to the downloaded model directory.
    """
    import faster_whisper.utils as fw_utils
    original_tqdm = fw_utils.disabled_tqdm

    LoggingTqdm.reset_progress()
    fw_utils.disabled_tqdm = LoggingTqdm
    try:
        logger.info(f"Starting download of STT model: {model_name}")
        model_path = download_model(model_name)
        logger.info(f"STT model '{model_name}' download complete.")
        return model_path
    finally:
        fw_utils.disabled_tqdm = original_tqdm
