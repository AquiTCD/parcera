import os
import json
import yaml
import logging
from typing import Optional, Dict, Any
from core.schema import AppSettings

logger = logging.getLogger(__name__)

_welcome_printed = False


def load_text_file(path: str) -> str:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


def load_config_file(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            if path.endswith(".json"):
                return json.load(f) or {}
            return yaml.safe_load(f) or {}
    return {}


def deep_merge(base: dict, update: dict) -> dict:
    """Recursively merge two dictionaries."""
    base = base or {}
    update = update or {}
    result = base.copy()
    for key, value in update.items():
        if isinstance(value, dict) and key in result and isinstance(result[key], dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _fill_placeholders(text: str, params: dict) -> str:
    """Replace ${key} patterns in text with values from params."""
    if not text:
        return ""
    for key, value in params.items():
        text = text.replace(f"${{{key}}}", str(value) if value is not None else "")
    return text


def _get_default_situation(mode: str, user_name: str) -> str:
    """Return a mode-specific situation description (in English for precision)."""
    if mode == "soliloquy":
        return (
            f"{user_name} is fully immersed in gaming right in front of you, "
            "occasionally muttering thoughts aloud. You are a 'side-by-side observer "
            "(観戦者)', watching the same screen together, and providing enthusiastic "
            "reactions or support."
        )
    return (
        f"You are enjoying an active conversation with {user_name} while they are "
        "gaming or streaming. You are a 'supportive partner' who balances natural "
        "dialogue with reacting to their gameplay, maintaining a fun and interactive "
        "atmosphere."
    )


class ParceraConfig:
    def __init__(self, settings_path: Optional[str] = None):
        # Base path detection (works for both dev and packaged)
        self.base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        if settings_path is None:
            config_env = os.environ.get("PARCERA_CONFIG_PATH")
            if not config_env:
                # Fallback to local config dir
                settings_path = os.path.join(self.base_path, "configs", "settings.default.yaml")
            else:
                settings_path = config_env

        self.settings_path = settings_path
        self.last_mtime: float = 0.0
        self.settings: Dict[str, Any] = {}
        self.data: AppSettings = AppSettings()
        self.refresh()

    def refresh(self, new_settings: Optional[Dict[str, Any]] = None) -> bool:
        """Reload settings and prompts. Use disk if new_settings is None. Returns True if changed."""
        try:
            changed = self._load_settings(new_settings)
            if changed:
                self._build_prompts()
                self._build_stt_prompt()
                self.setup_logging()
                return True
        except Exception as e:
            logger.error(f"Error refreshing config: {e}")
        return False

    def _load_settings(self, new_settings: Optional[Dict[str, Any]] = None) -> bool:
        """Load internal system constants, then UI defaults, then user overrides."""
        vitals_path = os.path.join(self.base_path, "configs", "system_vitals.yaml")
        vitals = load_config_file(vitals_path)

        defaults_path = os.path.join(self.base_path, "configs", "settings.default.yaml")
        defaults = load_config_file(defaults_path)

        # 1. Start with system constants
        # 2. Layer UI defaults on top
        # 3. Layer user overrides on top of everything
        base_settings = deep_merge(vitals, defaults)

        user_settings = {}
        if new_settings:
            user_settings = new_settings
            if os.path.exists(self.settings_path):
                self.last_mtime = os.path.getmtime(self.settings_path)
        else:
            if not os.path.exists(self.settings_path):
                logger.debug(f"User settings file not found: {self.settings_path}")
            else:
                current_mtime = os.path.getmtime(self.settings_path)
                if current_mtime <= self.last_mtime and self.settings:
                    return False  # No change on disk
                user_settings = load_config_file(self.settings_path)
                self.last_mtime = current_mtime

        merged_settings = deep_merge(base_settings, user_settings)
        try:
            # Validate and apply defaults via Pydantic
            self.data = AppSettings.model_validate(merged_settings)
            self.settings = self.data.model_dump()
        except Exception as e:
            logger.warning(f"Config validation failed (falling back to strict dict): {e}")
            self.settings = merged_settings
            
        return True

    def _build_prompts(self):
        """Load prompt templates from disk and fill placeholders."""
        prompts_dir = os.path.join(self.base_path, "prompts")
        system_template = load_text_file(os.path.join(prompts_dir, "system_prompt.md"))
        context_template = load_text_file(os.path.join(prompts_dir, "context_prompt.md"))

        ai_profile = self.get("ai_profile", {})
        user_profile = self.get("user_profile", {})
        mode = user_profile.get("mode", "soliloquy")

        if self.get("twitch", {}).get("enabled", False):
            twitch_guidelines = load_text_file(os.path.join(prompts_dir, "action_guidelines_twitch.md"))
        else:
            twitch_guidelines = ""

        fill_params = {
            **ai_profile,
            "userName": user_profile.get("name", ""),
            "userCalling": user_profile.get("calling", ""),
            "userGender": user_profile.get("gender", ""),
            "mode": mode,
            "knowledge": self.get("knowledge", ""),
            "situation": _get_default_situation(mode, user_profile.get("name", "")),
            "actionGuidelines": load_text_file(os.path.join(prompts_dir, f"action_guidelines_{mode}.md")),
            "twitchGuidelines": twitch_guidelines
        }

        system_prompt = _fill_placeholders(system_template, fill_params)
        context_prompt = _fill_placeholders(context_template, fill_params)

        self.full_system_prompt = (
            f"{system_prompt}\n\n{context_prompt}" if context_prompt else system_prompt
        )

    def _build_stt_prompt(self):
        """Build the initial STT prompt from keywords."""
        force_keywords = self.get("force_keywords", [])
        stt_cfg = self.get("stt", {})
        specific_keywords = stt_cfg.get("dictionary", {}).get("specific_keywords", [])

        all_keywords = sorted(set(force_keywords + specific_keywords))
        keyword_str = ", ".join(all_keywords)

        ai_name = self.get("ai_profile", {}).get("name", "AI")
        self.full_stt_prompt = f"私は{ai_name}です。{keyword_str}。"

    def setup_logging(self):
        global _welcome_printed
        log_level_str = self.get("log_level", "INFO").upper()
        simple_log = self.get("simple_log", False)

        # If simple_log is ON, we force the system level to CRITICAL to silence everything,
        # but our specialized filter will still allow parcera.chat logs.
        effective_level = log_level_str
        if simple_log:
            effective_level = "CRITICAL"

        class CumulativeLevelFilter(logging.Filter):
            def __init__(self, mode):
                super().__init__()
                self.mode = mode

            def filter(self, record):
                # Always allow chat logs to pass through regardless of the global level
                if record.name == "parcera.chat":
                    return True

                if self.mode == "DEBUG":
                    return True
                if self.mode == "INFO":
                    return record.levelno >= logging.INFO
                if self.mode == "WARNING":
                    return record.levelno >= logging.WARNING
                if self.mode == "CRITICAL":
                    return record.levelno >= logging.CRITICAL
                return record.levelno >= logging.INFO

        # Specialized format for simple_log
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        if simple_log:
            # Much cleaner format for chat focus
            log_format = '%(message)s'

        logging.basicConfig(
            level=logging.DEBUG if effective_level == "DEBUG" else logging.INFO,
            format=log_format,
            force=True
        )

        root_logger = logging.getLogger()
        for handler in root_logger.handlers:
            handler.addFilter(CumulativeLevelFilter(effective_level))

        # Silence noisy libraries
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("uvicorn").setLevel(logging.WARNING if simple_log else logging.INFO)

        if simple_log and not _welcome_printed:
            print("\n✨ Parcera Simple Log Mode: ON (Chat only) ✨\n")
            _welcome_printed = True
        elif not simple_log:
            logger.info(f"Logging initialized at {log_level_str} level (Cumulative Mode)")


    @property
    def verbose(self) -> bool:
        return self.get("log_level") == "DEBUG"

    @property
    def profile_mode(self) -> bool:
        return self.get("profile_mode", False)

    @property
    def app_data_dir(self) -> str:
        """Return a writable directory for models, logs, and caches."""
        if os.name == "nt":
            base = os.environ.get("APPDATA", os.path.expanduser("~"))
        else:
            base = os.path.expanduser("~/Library/Application Support")

        path = os.path.join(base, "Parcera")
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)
        return path

    def get(self, key, default=None):
        return self.settings.get(key, default)
