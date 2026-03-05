import re
import json
import os

def extract_phrases(log_path):
    phrases = []
    # Regex to match [USER] or [USER (ignored)] followed by the message
    pattern = re.compile(r'\[USER(?: \(ignored\))?\]:\s*(.*)')
    
    if not os.path.exists(log_path):
        return []

    # Common misrecognition patterns (often single kanji or weird katakana/symbols)
    error_patterns = [
        r'^[ぁ-んァ-ヶ]{1,2}$',     # Too short (1-2 hiragana/katakana)
        r'[?？]{2,}',             # Multiple question marks often mean gibberish
        r'^[ァ-ヶ]*$',            # Only katakana (often misrecognized names or noises) - but be careful, some are valid
        r'[^\w\s！？。、]',       # Weird symbols
        r'^[あいうえお]{1,2}$',
        r'^[、。！？]$',
        r'^\s*$',                  # Empty
    ]
    
    # Specific known bad ones from previous logs
    bad_list = ['めんべんぽ', 'キツネスネオ', 'キツネツンネノスオ', '西パラ', 'カカゴ', 'キルギル', '西三八十一', 'ヨテバ']

    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            match = pattern.search(line)
            if match:
                text = match.group(1).strip()
                # Clean up
                text = text.strip('.').strip('?').strip()
                
                # Basic quality filters
                if not text or len(text) < 3: # Too short
                    continue
                
                if any(re.search(p, text) for p in error_patterns) and len(text) < 6:
                    continue
                
                if any(bad in text for bad in bad_list):
                    continue
                
                # Check for "成立してる日本語" (Rough heuristic: must contain at least one hiragana)
                if not re.search(r'[ぁ-ん]', text):
                    continue

                phrases.append(text)
    
    return list(dict.fromkeys(phrases))

def update_training_phrases():
    log_files = ['sample.log', 'sample2.log', 'sample3.log', 'sample4.log']
    all_phrases = []
    for log in log_files:
        if os.path.exists(log):
            all_phrases.extend(extract_phrases(log))
    
    # Unique and Shuffle/Sort? Let's just keep unique.
    unique_phrases = list(dict.fromkeys(all_phrases))
    
    # Categorize
    game_phrases = []
    reactions = []
    behavior = [] # New category for AI interaction
    other = []

    reaction_keywords = ['面白い', 'すごい', 'ヤバ', 'エグ', 'マジ', '天才', 'ウケる', 'かっこいい', 'よし', 'いいじゃん']
    behavior_keywords = ['パルセラ', '何して', '教えて', 'メモ', '記録', '静かに', 'ストップ', '終了']

    for p in unique_phrases:
        if any(k in p for k in behavior_keywords):
            behavior.append(p)
        elif any(k in p for k in reaction_keywords):
            reactions.append(p)
        elif any(k in p for k in ['モンゴル', '刀', '武士', '侍', '対馬', '誉れ', '冥人', '敵', '攻撃', 'ダメージ', 'ランクマ', 'コンボ']):
            game_phrases.append(p)
        else:
            other.append(p)

    new_data = [
        { "category": "対話・指示 (パルセラ)", "phrases": behavior[:30] },
        { "category": "リアクション・感情", "phrases": reactions[:40] },
        { "category": "ゲーム実況・プレイ", "phrases": game_phrases[:40] },
        { "category": "日常のつぶやき", "phrases": other[:80] }
    ]

    # Filter out empty categories
    new_data = [c for c in new_data if c["phrases"]]

    output_path = '/Users/aqui/Repositories/github.com/AquiTCD/parcera/electron/renderer/lib/training_phrases.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {output_path} with {len(unique_phrases)} phrases from {len(log_files)} files.")

if __name__ == "__main__":
    update_training_phrases()
