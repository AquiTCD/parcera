import os
import yaml
import logging

logger = logging.getLogger(__name__)

def load_text_file(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

import json

def load_config_file(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            if path.endswith(".json"):
                return json.load(f)
            return yaml.safe_load(f)
    return {}

def deep_merge(base: dict, update: dict) -> dict:
    """Recursively merge two dictionaries."""
    result = base.copy()
    for key, value in update.items():
        if isinstance(value, dict) and key in result and isinstance(result[key], dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

class ParceraConfig:
    def __init__(self, settings_path: str = None):
        if settings_path is None:
            settings_path = os.environ.get("PARCERA_CONFIG_PATH", "configs/settings.default.yaml")
        self.settings_path = settings_path
        self.last_mtime = 0
        self.settings = {}
        self.refresh()

    def refresh(self, new_settings: dict = None):
        """Reload settings and prompts. Use disk if new_settings is None."""
        try:
            # 1. Load Defaults as the foundation
            # Search for defaults relative to the script location or project root
            defaults_path = os.path.join(os.getcwd(), "configs/settings.default.yaml")
            defaults = load_config_file(defaults_path)

            # 2. Load/Received User Settings
            user_settings = {}
            if new_settings:
                # Direct update from memory (e.g. from POST body)
                user_settings = new_settings
                if os.path.exists(self.settings_path):
                    self.last_mtime = os.path.getmtime(self.settings_path) # Sync mtime
            else:
                # Disk update
                if not os.path.exists(self.settings_path):
                    logger.debug(f"User settings file not found: {self.settings_path}")
                else:
                    current_mtime = os.path.getmtime(self.settings_path)
                    if current_mtime <= self.last_mtime:
                        return False
                    user_settings = load_config_file(self.settings_path)
                    self.last_mtime = current_mtime

            # 3. Deep Merge: User settings override defaults
            self.settings = deep_merge(defaults, user_settings)

            # ALWAYS re-load Prompts from disk (they are not in settings dict)
            system_prompt = load_text_file("prompts/system_prompt.md")
            context_prompt = load_text_file("prompts/context_prompt.md")
            self.full_system_prompt = f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt

            # Re-apply logging if it was already initialized
            self.setup_logging()
            return True
        except Exception as e:
            logger.error(f"Error refreshing config: {e}")
        return False

    def setup_logging(self):
        log_level_str = self.get("log_level", "INFO").upper()

        # Define custom cumulative filter based on user request
        class CumulativeLevelFilter(logging.Filter):
            def __init__(self, mode):
                super().__init__()
                self.mode = mode

            def filter(self, record):
                # INFO: INFO(20) + ERROR(40) only. Skip WARNING(30).
                if self.mode == "INFO":
                    return record.levelno == logging.INFO or record.levelno >= logging.ERROR
                # WARNING: INFO(20) + WARNING(30) + ERROR(40)
                if self.mode == "WARNING":
                    return record.levelno >= logging.INFO
                # DEBUG: DEBUG(10) + above (All)
                if self.mode == "DEBUG":
                    return True
                # Fallback to standard INFO threshold
                return record.levelno >= logging.INFO

        # Configure root logger at DEBUG to allow all logs through to the filter
        logging.basicConfig(
            level=logging.DEBUG if log_level_str == "DEBUG" else logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            force=True
        )

        # Apply specific filtering logic
        root_logger = logging.getLogger()
        for handler in root_logger.handlers:
            handler.addFilter(CumulativeLevelFilter(log_level_str))

        # Silence some noisy loggers
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("uvicorn").setLevel(logging.INFO)

        logger.info(f"Logging initialized at {log_level_str} level (Cumulative Mode)")

    @property
    def verbose(self) -> bool:
        return self.get("log_level") == "DEBUG"

    @property
    def profile_mode(self) -> bool:
        return self.get("profile_mode", False)

    def get(self, key, default=None):
        return self.settings.get(key, default)
