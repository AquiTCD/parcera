import os
import yaml
import logging

logger = logging.getLogger(__name__)

def load_text_file(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def load_config_file(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}

class ParceraConfig:
    def __init__(self, settings_path: str = "configs/settings.yaml"):
        self.settings = load_config_file(settings_path)

        # Load Prompts
        system_prompt = load_text_file("prompts/system_prompt.md")
        context_prompt = load_text_file("prompts/context_prompt.md")
        self.full_system_prompt = f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt

    def setup_logging(self):
        log_level_str = self.get("log_level", "INFO").upper()
        log_level = getattr(logging, log_level_str, logging.INFO)

        # Configure root logger
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # Silence some noisy loggers
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("uvicorn").setLevel(logging.INFO)

        logger.info(f"Logging initialized at {log_level_str} level")

    @property
    def verbose(self) -> bool:
        return self.get("verbose", False)

    @property
    def profile_mode(self) -> bool:
        return self.get("profile_mode", False)

    def get(self, key, default=None):
        return self.settings.get(key, default)
