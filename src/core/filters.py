import random
import re
import logging
import math
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

DEFAULT_SENSITIVITY_PRESETS: Dict[str, List[float]] = {
    "high":   [15.0, 0.12, 0.75],
    "medium": [16.0, 0.15, 0.45],
    "low":    [25.0, 0.15, 0.30],
}

class ResponseWeightFilter:
    @staticmethod
    def calculate_weight(text: str) -> float:
        """
        Calculates the weight of a sentence.
        Kanji counts as 2, others as 1.
        Weight = len(text) + kanji_count
        """
        if not text:
            return 0.0
        # Filter out punctuation and whitespace for pure weight calculation
        clean_text = re.sub(r'[^\wぁ-んァ-ヶー一-龠]', '', text)
        raw_len = len(clean_text)
        kanji_count = len(re.findall(r'[一-龠]', clean_text))
        return float(raw_len + kanji_count)

    def __init__(
        self, 
        force_keywords: Optional[List[str]] = None, 
        ignore_sentences: Optional[List[str]] = None, 
        sensitivity: str = "medium", 
        presets: Optional[Dict[str, List[float]]] = None
    ) -> None:
        # Default presets if none provided (as fallback)
        self.presets = presets or DEFAULT_SENSITIVITY_PRESETS

        # Initial state from arguments
        self.force_keywords: List[str] = force_keywords if force_keywords is not None else []
        self.ignore_sentences: List[str] = ignore_sentences if ignore_sentences is not None else []
        self.sensitivity: str = sensitivity.lower() if sensitivity else "medium"
        self.midpoint: float = 0.0
        self.slope: float = 0.0
        self.max_prob: float = 0.0

        # Sync internal probability parameters
        self.update_config()

    def update_config(
        self, 
        force_keywords: Optional[List[str]] = None, 
        ignore_sentences: Optional[List[str]] = None, 
        sensitivity: Optional[str] = None, 
        presets: Optional[Dict[str, List[float]]] = None
    ) -> None:
        if force_keywords is not None:
            self.force_keywords = force_keywords
        if ignore_sentences is not None:
            self.ignore_sentences = ignore_sentences
        if sensitivity is not None:
            self.sensitivity = sensitivity.lower()
        if presets is not None:
            self.presets = presets

        # Guard against invalid sensitivity strings
        # Config provides list [mid, slope, max], we map it to tuple
        raw_preset = self.presets.get(self.sensitivity, self.presets["medium"])
        self.midpoint, self.slope, self.max_prob = float(raw_preset[0]), float(raw_preset[1]), float(raw_preset[2])

        logger.info(f"ResponseFilter Updated: Sensitivity='{self.sensitivity}' (mid={self.midpoint}, slope={self.slope}, max={self.max_prob})")

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
        length = self.calculate_weight(text)

        # Always ignore short utterances (weighted length <= 1)
        if length <= 1:
            logger.debug(f"Filter: Ignored short utterance (len={length})")
            return False

        # Sigmoid function
        probability = self.max_prob / (1.0 + math.exp(-self.slope * (length - self.midpoint)))

        rolled = random.random()
        decision = rolled < probability

        log_level = logging.INFO if decision else logging.DEBUG
        logger.log(log_level, f"Filter: Decision={decision} (Prob={probability:.2f}, Roll={rolled:.2f}, WLen={length}, Sens={self.sensitivity})")

        return decision
