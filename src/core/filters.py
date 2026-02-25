import random
import re
import logging
import math

logger = logging.getLogger(__name__)

class ResponseWeightFilter:
    def __init__(self, force_keywords=None, ignore_sentences=None, sensitivity="medium"):
        # Tuning presets: (midpoint, slope, max_prob)
        # Midpoint: Weighted length where response probability is 50%
        # Max_prob: The ceiling of response probability for very long sentences
        self.presets = {
            "high":   (10.0, 0.15, 0.95),  # Chatty
            "medium": (21.0, 0.15, 0.75),  # Natural (50% at 21 chars, Max 75%)
            "low":    (30.0, 0.15, 0.50),  # Quiet (50% at 30 chars, Max 50%)
        }

        # Initial state from arguments
        self.force_keywords = force_keywords if force_keywords is not None else []
        self.ignore_sentences = ignore_sentences if ignore_sentences is not None else []
        self.sensitivity = sensitivity.lower() if sensitivity else "medium"
        self.midpoint = self.slope = self.max_prob = 0.0

        # Sync internal probability parameters based on the initial sensitivity
        self.update_config()

    def update_config(self, force_keywords=None, ignore_sentences=None, sensitivity=None):
        if force_keywords is not None:
            self.force_keywords = force_keywords
        if ignore_sentences is not None:
            self.ignore_sentences = ignore_sentences
        if sensitivity is not None:
            self.sensitivity = sensitivity.lower()

        # Guard against invalid sensitivity strings
        preset = self.presets.get(self.sensitivity, self.presets["medium"])
        self.midpoint, self.slope, self.max_prob = preset
        logger.info(f"ResponseFilter Updated: Sensitivity='{self.sensitivity}' (mid={self.midpoint}, slope={self.slope}, max={self.max_prob}), ForceKWs={len(self.force_keywords)}, Ignore={len(self.ignore_sentences)}")

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
