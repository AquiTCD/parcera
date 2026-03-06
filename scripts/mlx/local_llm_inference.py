from mlx_lm import load, generate
import mlx.core as mx

# ※ 実際の実装では settings.py 等からモデル名を取得します
MODEL_NAME = "mlx-community/gemma-2-9b-it-4bit"

class LocalBrain:
    def __init__(self, model_name=MODEL_NAME):
        print(f"Loading local model: {model_name}...")
        self.model, self.tokenizer = load(model_name)
    
    def chat(self, prompt, adapter_path=None):
        """
        推論を実行する。
        adapter_path が指定されている場合は LoRA アダプタを適用する。
        """
        # Gemma 2 形式のテンプレート
        formatted_prompt = f"<start_of_turn>user\n{prompt}<end_of_turn>\n<start_of_turn>model\n"
        
        print("Thinking...")
        
        # ※ 実際には temp や max_tokens を引数で調整可能にする
        response = generate(
            self.model, 
            self.tokenizer, 
            prompt=formatted_prompt,
            adapter_path=adapter_path,
            verbose=False,
            temp=0.7,
            max_tokens=100
        )
        
        return response

def run_prototype():
    # 推論のみのテスト
    brain = LocalBrain()
    
    test_prompt = "今のコンボ、どうだった？"
    print(f"User: {test_prompt}")
    
    response = brain.chat(test_prompt)
    print(f"Parcera: {response}")

if __name__ == "__main__":
    # このプロトタイプを動かすには pip install mlx-lm が必要です
    # run_prototype()
    print("Local Brain Prototype script ready.")
    print("Dependencies: mlx-lm, mlx")
