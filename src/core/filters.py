import random
import logging

logger = logging.getLogger(__name__)

class ResponseWeightFilter:
    def __init__(self, force_keywords=None):
        self.force_keywords = force_keywords or ["パルセラ", "だね", "どう", "教えて"]

    def should_respond(self, text: str) -> bool:
        if not text:
            return False

        # 1. Check Force Keywords
        for kw in self.force_keywords:
            if kw in text:
                logger.info(f"Filter: Force respond keyword detected: {kw}")
                return True

        # 2. Probability by Length
        length = len(text)
        # 1 char = 35%, 10 chars = 80%, etc.
        probability = min(0.95, 0.3 + (length * 0.05))

        rolled = random.random()
        decision = rolled < probability
        logger.debug(f"Filter: Response decision: {decision} (Prob: {probability:.2f}, Roll: {rolled:.2f}, Len: {length})")

        return decision
