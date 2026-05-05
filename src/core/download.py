import logging
import os
import sys
from tqdm.auto import tqdm

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
        # Discard visual output — progress is tracked via _current_progress dict
        # for SSE polling. Writing to stdout floods the sidecar pipe on large
        # models (e.g. Gemma 4) and causes [Errno 32] Broken pipe.
        kwargs["file"] = open(os.devnull, "w")
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
    """Check if a model is already cached (supports Whisper and Moonshine)."""
    if "moonshine" in model_name.lower() or model_name in ["tiny-ja", "base-ja"]:
        import moonshine_voice
        from moonshine_voice.moonshine_api import ModelArch
        from moonshine_voice.download import find_model_info, get_components_for_model_info, get_cache_dir
        
        # Map name to arch
        clean_name = model_name.lower().replace("moonshine-", "").replace("-ja", "")
        arch = ModelArch.TINY
        if "base" in clean_name:
            arch = ModelArch.BASE
            
        try:
            model_info = find_model_info("ja", arch)
            cache_dir = get_cache_dir()
            model_download_url = model_info["download_url"]
            model_folder_name = model_download_url.replace("https://", "")
            root_model_path = os.path.join(cache_dir, model_folder_name)
            components = get_components_for_model_info(model_info)
            
            # Check if all components exist
            for component in components:
                if not os.path.exists(os.path.join(root_model_path, component)):
                    return False
            return True
        except Exception:
            return False
    elif "/" in model_name:
        # Assume HuggingFace model (e.g. mlx-community/gemma-2-9b-it-4bit)
        from huggingface_hub import scan_cache_dir
        try:
            # Check for actual weight files, not just metadata (config.json can exist without weights)
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == model_name:
                    for revision in repo.revisions:
                        has_weights = any(
                            f.file_name.endswith(".safetensors")
                            for f in revision.files
                        )
                        if has_weights:
                            return True
            return False
        except Exception:
            return False
    else:
        from faster_whisper.utils import download_model
        try:
            download_model(model_name, local_files_only=True)
            return True
        except Exception:
            return False


def download_model_with_progress(model_name: str) -> str:
    """
    Download an STT model (Whisper or Moonshine) with progress tracking.
    Progress is stored in LoggingTqdm._current_progress for SSE polling.
    """
    LoggingTqdm.reset_progress()

    if "moonshine" in model_name.lower() or model_name in ["tiny-ja", "base-ja"]:
        import moonshine_voice
        from moonshine_voice.moonshine_api import ModelArch
        import tqdm as tqdm_lib
        
        # Globally monkeypatch tqdm to capture Moonshine progress
        original_tqdm = tqdm_lib.tqdm
        tqdm_lib.tqdm = LoggingTqdm  # type: ignore
        
        # Map to ModelArch enum
        clean_name = model_name.lower().replace("moonshine-", "").replace("-ja", "")
        arch = ModelArch.TINY
        if "base" in clean_name:
            arch = ModelArch.BASE
            
        logger.info(f"Starting download of Moonshine model: {arch.name}")
        
        try:
            # get_model_for_language triggers the download using tqdm and returns the path.
            path, _ = moonshine_voice.get_model_for_language(wanted_language="ja", wanted_model_arch=arch)
            logger.info(f"Moonshine model '{arch.name}' download complete at {path}.")
            return path
        finally:
            tqdm_lib.tqdm = original_tqdm  # type: ignore

    elif "/" in model_name:
        # Assume HuggingFace model (MLX compatible)
        from huggingface_hub import snapshot_download
        logger.info(f"Starting download of HuggingFace model: {model_name}")
        # Suppress HF's own progress bar output to avoid SIGPIPE / BrokenPipeError
        # when downloading large models with many shards. Progress is tracked via
        # LoggingTqdm._current_progress for SSE polling instead.
        os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
        try:
            model_path = snapshot_download(
                repo_id=model_name,
                tqdm_class=LoggingTqdm,
                max_workers=1,
            )
            logger.info(f"HuggingFace model '{model_name}' download complete at {model_path}.")
            return model_path
        except Exception as e:
            logger.error(f"HuggingFace download error: {e}")
            raise
        finally:
            os.environ.pop("HF_HUB_DISABLE_PROGRESS_BARS", None)

    else:
        import faster_whisper.utils as fw_utils
        from faster_whisper.utils import download_model
        
        # Faster-whisper uses disabled_tqdm for its download progress
        original_tqdm = fw_utils.disabled_tqdm
        fw_utils.disabled_tqdm = LoggingTqdm  # type: ignore
        try:
            logger.info(f"Starting download of Whisper model: {model_name}")
            model_path = download_model(model_name)
            logger.info(f"Whisper model '{model_name}' download complete.")
            return model_path
        finally:
            fw_utils.disabled_tqdm = original_tqdm  # type: ignore
