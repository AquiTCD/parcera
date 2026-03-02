import os
import re
import math
import argparse
import yaml

# ==========================================
# Analytical Tuning Tool
# ==========================================

class ResponseWeightFilterSim:
    """Offline simulation of the ResponseWeightFilter logic."""
    @staticmethod
    def calculate_weight(text: str) -> float:
        if not text:
            return 0.0
        # Filter out punctuation and whitespace
        clean_text = re.sub(r'[^\wぁ-んァ-ヶー一-龠]', '', text)
        raw_len = len(clean_text)
        kanji_count = len(re.findall(r'[一-龠]', clean_text))
        return float(raw_len + kanji_count)

    def __init__(self, midpoint, slope, max_prob):
        self.midpoint = midpoint
        self.slope = slope
        self.max_prob = max_prob

    def get_probability(self, text: str) -> float:
        length = self.calculate_weight(text)
        if length <= 1:
            return 0.0
        # Sigmoid function matching src/core/filters.py
        return self.max_prob / (1.0 + math.exp(-self.slope * (length - self.midpoint)))

def parse_parcera_log(log_path):
    """Extracts USER inputs and whether the AI responded from a log file."""
    interactions = []
    if not os.path.exists(log_path):
        print(f"Error: Log file not found at {log_path}")
        return []

    with open(log_path, "r", encoding="utf-8") as f:
        # Standard format: [2024-03-02 10:11:42] - user - INFO - [USER (ignored)]: text
        # Or: [2024-03-02 10:11:42] - user - INFO - [USER]: text
        for line in f:
            match = re.search(r'\[USER(\s+\(ignored\))?\]:\s*(.*)', line)
            if match:
                is_ignored = match.group(1) is not None
                text = match.group(2).strip()
                interactions.append({
                    "text": text,
                    "actual_responded": not is_ignored,
                    "weight": ResponseWeightFilterSim.calculate_weight(text)
                })
    return interactions

def load_presets(vitals_path):
    """Loads presets from system_vitals.yaml."""
    if os.path.exists(vitals_path):
        with open(vitals_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            return data.get('sensitivity_presets', {})
    return {}

def main():
    parser = argparse.ArgumentParser(description="Analyze Parcera interaction logs and simulate response sensitivity.")
    parser.add_argument("log_file", help="Path to the .log file (e.g., sample3.log)")
    parser.add_argument("--vitals", default="configs/system_vitals.yaml", help="Path to system_vitals.yaml")
    parser.add_argument("--custom", nargs=3, type=float, metavar=('MID', 'SLOPE', 'MAX_PROB'), 
                        help="Test custom parameters [midpoint, slope, max_prob]")

    args = parser.parse_args()

    interactions = parse_parcera_log(args.log_file)
    if not interactions:
        return

    presets = load_presets(args.vitals)
    # Default fallbacks if YAML is missing
    if not presets:
        presets = {
            "high":   [15.0, 0.12, 0.75],
            "medium": [16.0, 0.15, 0.45],
            "low":    [25.0, 0.15, 0.30],
        }

    total = len(interactions)
    actual_count = sum(1 for i in interactions if i['actual_responded'])
    avg_weight = sum(i['weight'] for i in interactions) / total

    print(f"📊 --- Log Analysis: {args.log_file} ---")
    print(f"Total User Inputs : {total}")
    print(f"Actual AI Responses: {actual_count} ({actual_count/total*100:.1f}%)")
    print(f"Average Text Weight: {avg_weight:.1f}")

    print("\n📈 Simulation Results (Probabilistic Expected Response Rate):")
    for name, params in presets.items():
        sim = ResponseWeightFilterSim(*params)
        expected = sum(sim.get_probability(i['text']) for i in interactions)
        print(f"  [{name:6}] Expected: {expected:6.2f} ({expected/total*100:5.1f}%) | Params: {params}")

    if args.custom:
        sim = ResponseWeightFilterSim(*args.custom)
        expected = sum(sim.get_probability(i['text']) for i in interactions)
        print(f"  [CUSTOM] Expected: {expected:6.2f} ({expected/total*100:5.1f}%) | Params: {args.custom}")

    print("\n🔍 Detailed Activity by Weight Range:")
    ranges = [(0, 5), (6, 10), (11, 20), (21, 50), (51, 100)]
    for start, end in ranges:
        sub = [i for i in interactions if start <= i['weight'] <= end]
        if not sub: continue
        
        resp = sum(1 for i in sub if i['actual_responded'])
        actual_rate = (resp / len(sub)) * 100
        
        # Using current 'medium' for comparison
        med_sim = ResponseWeightFilterSim(*presets.get('medium', [16.0, 0.15, 0.45]))
        expected_med_rate = (sum(med_sim.get_probability(i['text']) for i in sub) / len(sub)) * 100
        
        print(f"  {start:2}-{end:3} W: Count={len(sub):3}, Actual={resp:2} ({actual_rate:5.1f}%), Expected(Med)={expected_med_rate:5.1f}%")

if __name__ == "__main__":
    main()
