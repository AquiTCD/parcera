import random
import re
import logging
import math

logger = logging.getLogger(__name__)

class ResponseWeightFilter:
    def __init__(self, force_keywords=None, ignore_sentences=None, sensitivity="medium"):
        self.force_keywords = force_keywords or ["パルセラ", "だね", "どう", "教えて"]
        self.ignore_sentences = ignore_sentences or []
        self.sensitivity = sensitivity.lower() if sensitivity else "medium"

        # Tuning presets: (midpoint, slope, max_prob)
        self.presets = {
            "high":   (10.0, 0.15, 0.95),  # Chatty
            "medium": (18.0, 0.15, 0.90),  # Natural
            "low":    (25.0, 0.15, 0.60),  # Quiet
        }

        preset = self.presets.get(self.sensitivity)
        if not preset:
            logger.warning(f"Unknown sensitivity '{self.sensitivity}', falling back to 'medium'")
            preset = self.presets["medium"]

        self.midpoint, self.slope, self.max_prob = preset
        logger.info(f"ResponseFilter: Sensitivity='{self.sensitivity}' (mid={self.midpoint}, slope={self.slope}, max={self.max_prob})")

    def should_respond(self, text: str) -> bool:
        if not text:
            return False

        # 0. Check Ignore Sentences (Skip if matches after normalization)
        # Remove punctuation and whitespace for robust matching
        normalized_text = re.sub(r'[^\w\sぁ-んァ-ヶー一-龠]|[\s]', '', text)
        if normalized_text in self.ignore_sentences:
            logger.info(f"Filter: Ignored scheduled sentence: {text} (normalized: {normalized_text})")
            return False

        # 1. Check Force Keywords (Always 100%)
        for kw in self.force_keywords:
            if kw in text:
                logger.info(f"Filter: Force respond keyword detected: {kw}")
                return True

        # 2. Probability by Length (Sigmoid Curve with Weighted Length)
        raw_len = len(text)
        kanji_len = len(re.findall(r'[一-龠]', text))
        length = raw_len + kanji_len

        # Always ignore short utterances (weighted length <= 1)
        if length <= 1:
            logger.debug(f"Filter: Ignored short utterance (len={length})")
            return False

        # Sigmoid function
        probability = self.max_prob / (1.0 + math.exp(-self.slope * (length - self.midpoint)))

        rolled = random.random()
        decision = rolled < probability

        log_level = logging.INFO if decision else logging.DEBUG
        logger.log(log_level, f"Filter: Decision={decision} (Prob={probability:.2f}, Roll={rolled:.2f}, RawLen={raw_len}, WLen={length}, Sens={self.sensitivity})")

        return decision
