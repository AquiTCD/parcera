import logging

# ─── Chat Logger Colors ───
C_USER = "\033[1;36m"    # Bold Cyan
C_AI = "\033[1;32m"      # Bold Green
C_TWITCH = "\033[1;33m"  # Bold Yellow
C_SKIP = "\033[37m"      # White (for filtered/ignored)
C_RESET = "\033[0m"

class ChatLogger:
    """
    Handles colorful terminal output for the AI interaction chat.
    Decouples terminal formatting from business logic.
    """
    def __init__(self, logger_name: str = "parcera.chat"):
        self.logger = logging.getLogger(logger_name)

    def log_user(self, text: str, ignored: bool = False):
        if ignored:
            self.logger.info(f"{C_SKIP}[USER (ignored)]: {text}{C_RESET}")
        else:
            self.logger.info(f"{C_USER}[USER]:   {text}{C_RESET}")

    def log_ai(self, text: str):
        self.logger.info(f"{C_AI}[AI]:     {text}{C_RESET}")

    def log_twitch(self, user_name: str, text: str):
        self.logger.info(f"{C_TWITCH}[Twitch]: <{user_name}> {text}{C_RESET}")

    def log_system(self, message: str):
        self.logger.info(f"{C_SKIP}{message}{C_RESET}")

# Global singleton-like instance
chat_logger = ChatLogger()
