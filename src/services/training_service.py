import os
import sqlite3
import json
import logging
import asyncio
import httpx
import sys
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from datetime import datetime
import shutil
import numpy as np
import safetensors
from safetensors.numpy import save_file, load_file

logger = logging.getLogger(__name__)

class TrainingService:
    def __init__(self, config: Any, teacher_llm: Optional[Any] = None):
        self.config = config
        self.teacher_llm = teacher_llm
        self.db_path = os.path.join(self.config.app_data_dir, "training.db")
        self.training_status: Dict[str, Dict[str, Any]] = {}
        self._init_db()
        self._cleanup_temp_dirs()

    def _cleanup_temp_dirs(self):
        """Cleanup temporary fused adapter directories on startup."""
        temp_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", "_fused_adapter_temp")
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
                logger.info("Training: Cleaned up temporary fused adapter directory.")
            except Exception as e:
                 logger.warning(f"Failed to cleanup temp dir: {e}")

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            # Training Pairs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS training_pairs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile TEXT NOT NULL DEFAULT 'default',
                    input TEXT NOT NULL,
                    output TEXT NOT NULL,
                    edited_output TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    source TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Training Metadata table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS training_metadata (
                    profile TEXT PRIMARY KEY,
                    last_trained_at TIMESTAMP,
                    last_trained_count INTEGER DEFAULT 0
                )
            """)
            
            # Migration check: add profile column if it doesn't exist
            cursor.execute("PRAGMA table_info(training_pairs)")
            columns = [row[1] for row in cursor.fetchall()]
            if "profile" not in columns:
                logger.info("Training: Migrating database to add 'profile' column")
                cursor.execute("ALTER TABLE training_pairs ADD COLUMN profile TEXT NOT NULL DEFAULT 'default'")
            
            # Migration check: add last_trained_count to training_metadata
            cursor.execute("PRAGMA table_info(training_metadata)")
            meta_columns = [row[1] for row in cursor.fetchall()]
            if "last_trained_count" not in meta_columns:
                cursor.execute("ALTER TABLE training_metadata ADD COLUMN last_trained_count INTEGER DEFAULT 0")

    def _get_adapter_path(self, profile_name: str) -> Optional[str]:
        """Get the absolute path to the adapter file, checking common names."""
        base_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", profile_name)
        for name in ["adapters.safetensors", "adapter_model.safetensors"]:
            path = os.path.join(base_dir, name)
            if os.path.exists(path):
                return path
        return None

    def _calculate_merge_weights(self, configs: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculates balanced weights for merging multiple LoRA adapters.
        Target total weight limit: 1.2
        Rules:
        - If total <= 1.2: use values as is.
        - If total > 1.2 and there is a 'main' profile:
            - Main can drop to 0.8 minimum if it was set to 1.0 or higher.
            - Others share the remaining capacity (1.2 - main_weight).
        - If total > 1.2 and no 'main': Scale all proportionally to sum to 1.2.
        """
        target_total = 1.2
        results = {c["name"]: float(c["weight"]) for c in configs}
        total = sum(results.values())
        
        if total <= target_total:
            return results
        
        main_config = next((c for c in configs if c.get("is_main")), None)
        
        if main_config:
            name = main_config["name"]
            orig_main_weight = float(main_config["weight"])
            
            # Simple prioritization: 
            # If main was 1.0, it can drop to 0.8. 
            # Scale main down to max(0.8, proportional_scaled_main)
            prop_scale = target_total / total
            new_main_weight = max(0.8 if orig_main_weight >= 1.0 else (orig_main_weight * 0.8), orig_main_weight * prop_scale)
            # Ensure new_main does not exceed its original setting
            new_main_weight = min(orig_main_weight, new_main_weight)
            
            results[name] = new_main_weight
            
            # Distribute remaining to others
            remaining = target_total - new_main_weight
            other_sum = total - orig_main_weight
            
            if other_sum > 0:
                others_scale = remaining / other_sum
                for c in configs:
                    if not c.get("is_main"):
                        results[c["name"]] = float(c["weight"]) * others_scale
            else:
                # No others, just main (already handled but for safety)
                pass
        else:
            # Proportionally scale all
            scale = target_total / total
            for name in results:
                results[name] *= scale
                
        return results
    async def merge_adapters(self, profile_configs: List[Dict[str, Any]]) -> str:
        """
        Merges multiple LoRA adapters with weights.
        Returns the path to the temporary merged adapter directory.
        """
        # 1. Filter out 0 weight or non-existent adapters
        configs = []
        for c in profile_configs:
            adapter_path = self._get_adapter_path(c["name"])
            if float(c["weight"]) > 0 and adapter_path:
                configs.append(c)
        
        if not configs:
            return "" # Or should we return a default? If no adapters, clear it.
            
        # 2. Calculate actual weights using Smart Auto-Balance
        final_weights = self._calculate_merge_weights(configs)
        logger.info(f"Training: Merging adapters with balanced weights: {final_weights}")
        
        # 3. Load and blend tensors
        merged_tensors = {}
        all_keys = set()
        
        # Determine base directory for metadata (e.g. adapter_config.json)
        # We use the 'main' adapter's config, or the first one if no main.
        main_profile = next((c["name"] for c in configs if c.get("is_main")), configs[0]["name"])
        main_adapter_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", main_profile)
        
        for name, weight in final_weights.items():
            adapter_path = self._get_adapter_path(name)
            if not adapter_path:
                logger.warning(f"Training: Skipping {name}, no adapter file found.")
                continue
            try:
                tensors = load_file(adapter_path)
                for key, value in tensors.items():
                    all_keys.add(key)
                    if key not in merged_tensors:
                        # Initialize with same shape/type as base, but all zeros
                        merged_tensors[key] = np.zeros_like(value, dtype=np.float32)
                    
                    # Add weighted contribution
                    # Convert to float32 for summation precision
                    merged_tensors[key] += value.astype(np.float32) * weight
            except Exception as e:
                logger.error(f"Training: Failed to load/blend adapter {name}: {e}")
                
        # 4. Save to temporary fused directory
        fused_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", "_fused_adapter_temp")
        if os.path.exists(fused_dir):
            shutil.rmtree(fused_dir)
        os.makedirs(fused_dir, exist_ok=True)
        
        # Save merged safetensors
        # Convert back to bfloat16 or similar if the original was that, 
        # but float16/32 is safer for general compatibility. 
        # We'll use float16 as it's common for LoRA weights.
        merged_tensors_f16 = {k: v.astype(np.float16) for k, v in merged_tensors.items()}
        save_file(merged_tensors_f16, os.path.join(fused_dir, "adapters.safetensors"))
        
        # Copy metadata from main_adapter_dir (config.json)
        shutil.copy(os.path.join(main_adapter_dir, "adapter_config.json"), os.path.join(fused_dir, "adapter_config.json"))
        
        return fused_dir


    async def add_knowledge_from_url(self, url: str, profile: str = "default"):
        logger.info(f"Training: Scraping URL: {url} for profile: {profile}")
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, "html.parser")
            # Remove scripts and styles
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text(separator="\n", strip=True)
            # Limit text length to avoid token limits in teacher LLM
            truncated_text = text[:8000]
            
            await self.add_knowledge_from_text(truncated_text, source=url, profile=profile)

    async def add_knowledge_from_text(self, text: str, source: str = "text", profile: str = "default"):
        if not self.teacher_llm:
            raise ValueError("Teacher LLM is required to process knowledge.")

        # Get dynamic character settings
        ai_profile = self.config.get("ai_profile", {})
        user_profile = self.config.get("user_profile", {})

        name = ai_profile.get("name", "パルセラ")
        species = ai_profile.get("species", "ダークエルフ")
        personality = ai_profile.get("personality") or "ギャルで、気さくで親しみやすい性格"
        tone = ai_profile.get("tone") or "「〜だし」「マジ」「ヤバw」など"
        first_person = ai_profile.get("first_person", "あたし")
        user_calling = user_profile.get("calling", "ユーザー")

        prompt = f"""あなたはAIアバター「{name}」の学習用データ作成のエキスパートです。
{name}の設定：
- 種族：{species}
- 性格：{personality}
- 口調：{tone}
- 一人称：{first_person}
- 相手の呼び方：{user_calling}

以下の情報を元に、{user_calling}との自然な会話形式のQ&Aペアを10個生成してください。
キャラクターの口調・性格を徹底し、親しみやすく魅力的な回答を作成してください。

【参考知識】
{text}

【出力形式】
JSON形式のリストのみを出力してください。説明文等は一切含めないでください。
重要：回答文の中で引用や強調をしたい場合は、ダブルクォーテーション（"）ではなく、必ず日本語の「」（かぎかっこ）を使用してください。

【出力例】
[
  {{"question": "{user_calling}、新しい知識について教えて？", "response": "お、いいよ！実はね、{species}のあたしたちにとっては「常識」なんだけど…（以下、知識に基づく回答）"}},
  ...
]
"""
        # Note: We assume teacher_llm has a 'generate' method for simplicity in this service
        response_text = await self.teacher_llm.generate(prompt)
        
        try:
            # Robust JSON extraction: Find the first [ and the last ]
            import re
            match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if match:
                clean_text = match.group(0)
            else:
                # Fallback to basic cleaning
                clean_text = response_text.replace("```json", "").replace("```", "").strip()
            
            # Remove potential control characters and zero-width spaces that break json.loads
            clean_text = re.sub(r'[\x00-\x1F\x7F\u200B-\u200D\uFEFF]', '', clean_text)
            
            # Normalize structural whitespace to make repair heuristic more reliable
            # Remove spaces around structural characters
            for char in [':', ',', '[', ']', '{', '}']:
                clean_text = clean_text.replace(f' {char}', char).replace(f'{char} ', char)

            # Robustly handle trailing commas: `{"a": 1,}` -> `{"a": 1}`
            clean_text = re.sub(r',\s*([\]}])', r'\1', clean_text)
            
            try:
                pairs = json.loads(clean_text)
            except json.JSONDecodeError:
                # Attempt manual "repair" of unescaped quotes inside values
                # Structural quotes are now strictly bounded by : [ { , ] } thanks to normalization
                repaired = re.sub(r'(?<![:\[{,])"(?![:,\]}])', r'\"', clean_text)
                pairs = json.loads(repaired)
            
            if not isinstance(pairs, list):
                raise ValueError("出力されたデータがリスト形式ではありません。")

            await asyncio.to_thread(self._save_pairs, pairs, source, profile)
            logger.info(f"Training: Saved {len(pairs)} pairs from {source} to profile: {profile}")
        except Exception as e:
            logger.error(f"Training: Failed to parse teacher response: {e}")
            logger.debug(f"Raw response: {response_text}")
            raise ValueError(f"AIの解析結果を正しく処理できませんでした（JSON形式エラー）。\n詳細: {e}")

    def _save_pairs(self, pairs: List[Dict[str, str]], source: str, profile: str):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for pair in pairs:
                cursor.execute(
                    "INSERT INTO training_pairs (profile, input, output, source) VALUES (?, ?, ?, ?)",
                    (profile, pair["question"], pair["response"], source)
                )
            conn.commit()

    async def get_pairs(self, profile: str = "default") -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_pairs_sync, profile)

    def _get_pairs_sync(self, profile: str) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM training_pairs WHERE profile = ? ORDER BY created_at DESC", (profile,))
            return [dict(row) for row in cursor.fetchall()]

    async def update_pair(self, pair_id: int, status: Optional[str] = None, edited_output: Optional[str] = None):
        await asyncio.to_thread(self._update_pair_sync, pair_id, status, edited_output)

    def _update_pair_sync(self, pair_id: int, status: Optional[str], edited_output: Optional[str]):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            if status and edited_output:
                cursor.execute("UPDATE training_pairs SET status = ?, edited_output = ? WHERE id = ?", (status, edited_output, pair_id))
            elif status:
                cursor.execute("UPDATE training_pairs SET status = ? WHERE id = ?", (status, pair_id))
            elif edited_output:
                cursor.execute("UPDATE training_pairs SET edited_output = ? WHERE id = ?", (edited_output, pair_id))
            conn.commit()

    async def delete_pair(self, pair_id: int):
        await asyncio.to_thread(self._delete_pair_sync, pair_id)

    def _delete_pair_sync(self, pair_id: int):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM training_pairs WHERE id = ?", (pair_id,))
            conn.commit()

    async def export_to_jsonl(self, file_path: str, profile: str = "default"):
        pairs = await self.get_pairs(profile)
        # Only export 'ok' and 'correction'
        train_data = []
        for p in pairs:
            content = None
            if p["status"] == "ok":
                content = p["output"]
            elif p["status"] == "correction" and p["edited_output"]:
                content = p["edited_output"]
            
            if content:
                formatted = {
                    "messages": [
                        {"role": "user", "content": p["input"]},
                        {"role": "assistant", "content": content}
                    ]
                }
                train_data.append(formatted)
        
        with open(file_path, "w", encoding="utf-8") as f:
            for item in train_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        
        return len(train_data)

    async def get_stats(self, profile: str = "default") -> Dict[str, Any]:
        return await asyncio.to_thread(self._get_stats_sync, profile)

    def _get_stats_sync(self, profile: str) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM training_pairs WHERE profile = ?", (profile,))
            total = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM training_pairs WHERE profile = ? AND status IN ('ok', 'correction')", (profile,))
            trainable = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM training_pairs WHERE profile = ? AND status = 'pending'", (profile,))
            pending = cursor.fetchone()[0]
            
            cursor.execute("SELECT last_trained_at, last_trained_count FROM training_metadata WHERE profile = ?", (profile,))
            row = cursor.fetchone()
            last_trained = row[0] if row else None
            last_count = row[1] if row else 0
            
            # Re-train state logic
            is_training = profile in self.training_status and self.training_status[profile].get("status") in ["running", "starting"]
            
            if total == 0:
                needs_train = False
                status_message = "データなし"
            elif trainable == 0:
                needs_train = False
                status_message = "有効データなし"
            elif not last_trained:
                needs_train = True
                status_message = "未学習"
            elif trainable != last_count:
                needs_train = True
                status_message = "更新あり"
            else:
                needs_train = False
                status_message = "学習済み"
            
            return {
                "total": total,
                "trainable": trainable,
                "pending": pending,
                "last_trained_at": last_trained,
                "needs_train": needs_train,
                "status_message": status_message,
                "is_training": is_training
            }

    async def get_profiles(self) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_profiles_sync)

    def _get_profiles_sync(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            # Get profiles from both training_pairs and metadata
            cursor.execute("""
                SELECT DISTINCT profile FROM training_pairs 
                UNION 
                SELECT profile FROM training_metadata
            """)
            db_profile_names = [row[0] for row in cursor.fetchall()]

            # --- Automatic Discovery ---
            adapters_dir = os.path.join(self.config.app_data_dir, "adapters", "llm")
            discovered_names = []
            if os.path.exists(adapters_dir):
                for folder in os.listdir(adapters_dir):
                    if folder.startswith("_") or folder == "default":
                        continue
                    folder_path = os.path.join(adapters_dir, folder)
                    if os.path.isdir(folder_path):
                        # Check for model file (standardized or common variants)
                        if os.path.exists(os.path.join(folder_path, "adapters.safetensors")) or \
                           os.path.exists(os.path.join(folder_path, "adapter_model.safetensors")):
                            discovered_names.append(folder)

            all_names = sorted(list(set(db_profile_names + discovered_names)))
            
            result = []
            for name in all_names:
                stats = self._get_stats_sync(name)
                # Read base_model from adapter_config.json if available
                base_model = None
                adapter_config_path = os.path.join(adapters_dir, name, "adapter_config.json")
                if os.path.exists(adapter_config_path):
                    try:
                        with open(adapter_config_path) as f:
                            adapter_cfg = json.load(f)
                        base_model = adapter_cfg.get("model")
                    except Exception:
                        pass
                result.append({
                    "name": name,
                    "status_message": stats["status_message"],
                    "total": stats["total"],
                    "needs_train": stats["needs_train"],
                    "base_model": base_model,
                })
            return result

    async def init_profile(self, profile: str):
        await asyncio.to_thread(self._init_profile_sync, profile)

    def _init_profile_sync(self, profile: str):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO training_metadata (profile) VALUES (?)", (profile,))
            conn.commit()

    async def rename_profile(self, old_name: str, new_name: str):
        await asyncio.to_thread(self._rename_profile_sync, old_name, new_name)

    def _rename_profile_sync(self, old_name: str, new_name: str):
        import shutil
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE training_pairs SET profile = ? WHERE profile = ?", (new_name, old_name))
            cursor.execute("UPDATE training_metadata SET profile = ? WHERE profile = ?", (new_name, old_name))
            conn.commit()
        
        # Rename data directory
        old_data_dir = os.path.join(self.config.app_data_dir, "training", old_name)
        new_data_dir = os.path.join(self.config.app_data_dir, "training", new_name)
        if os.path.exists(old_data_dir):
            try:
                shutil.move(old_data_dir, new_data_dir)
            except Exception as e:
                logger.warning(f"Failed to move training data dir: {e}")

        # Rename adapter directory
        old_adapter_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", old_name)
        new_adapter_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", new_name)
        if os.path.exists(old_adapter_dir):
            try:
                shutil.move(old_adapter_dir, new_adapter_dir)
            except Exception as e:
                logger.warning(f"Failed to move adapter dir: {e}")

    async def import_profile(self, source_path: str, name: str):
        """Import an external LoRA adapter folder/file into the managed storage."""
        await asyncio.to_thread(self._import_profile_sync, source_path, name)

    def _import_profile_sync(self, source_path: str, name: str):
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Source path does not exist: {source_path}")
        
        dest_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", name)
        os.makedirs(dest_dir, exist_ok=True)
        
        # Check if source is a single file (safetensors) or a directory
        if os.path.isfile(source_path):
             # If just a file, we assume it's the adapter itself
             shutil.copy2(source_path, os.path.join(dest_dir, "adapters.safetensors"))
             # Also try to find a config.json in the same dir
             parent = os.path.dirname(source_path)
             if os.path.exists(os.path.join(parent, "adapter_config.json")):
                 shutil.copy2(os.path.join(parent, "adapter_config.json"), os.path.join(dest_dir, "adapter_config.json"))
        else:
            # Directory - copy contents
            for item in os.listdir(source_path):
                s = os.path.join(source_path, item)
                d = os.path.join(dest_dir, item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    # Rename to standard adapters.safetensors if it looks like one
                    if item in ["adapter_model.safetensors", "adapters.safetensors"]:
                        shutil.copy2(s, os.path.join(dest_dir, "adapters.safetensors"))
                    else:
                        shutil.copy2(s, d)
        
        # Also init in DB so it shows up with stats
        self._init_profile_sync(name)

    async def export_profile(self, profile_name: str, destination_root: str):
        """Export a managed LoRA adapter to an external directory."""
        await asyncio.to_thread(self._export_profile_sync, profile_name, destination_root)

    def _export_profile_sync(self, profile_name: str, destination_root: str):
        source_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", profile_name)
        if not os.path.exists(source_dir):
            raise FileNotFoundError(f"Profile adapter directory not found: {profile_name}")
        
        # We create a subfolder with the profile name in the destination
        dest_dir = os.path.join(destination_root, profile_name)
        shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)
        logger.info(f"Training: Exported profile {profile_name} to {dest_dir}")

    async def delete_profile(self, profile: str):
        await asyncio.to_thread(self._delete_profile_sync, profile)

    def _delete_profile_sync(self, profile: str):
        import shutil
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM training_pairs WHERE profile = ?", (profile,))
            cursor.execute("DELETE FROM training_metadata WHERE profile = ?", (profile,))
            conn.commit()
        
        # Remove data directory
        data_dir = os.path.join(self.config.app_data_dir, "training", profile)
        if os.path.exists(data_dir):
            shutil.rmtree(data_dir, ignore_errors=True)
            
        # Remove adapter directory
        adapter_dir = os.path.join(self.config.app_data_dir, "adapters", "llm", profile)
        if os.path.exists(adapter_dir):
            shutil.rmtree(adapter_dir, ignore_errors=True)

    async def run_training(self, model_path: str, adapter_path: str, iters: int = 100, profile: str = "default"):
        # 1. Export data
        temp_data_path = os.path.join(self.config.app_data_dir, f"training_data_{profile}.jsonl")
        count = await self.export_to_jsonl(temp_data_path, profile=profile)
        
        if count == 0:
            raise ValueError("学習可能なデータ（OK/添削済み）がありません。")

        # 2. Unload model and set busy flag
        # We need to tell the server we are busy so it doesn't try to use the LLM
        # This also clears the memory for the training job
        from core.avatar import ParceraAvatarBase
        # We look for the singleton instances if possible, but TrainingService 
        # doesn't hold a direct reference to the server. We'll use a safer approach 
        # by checking if we have a teacher_llm that likely comes from ParceraServer.
        server = getattr(self.teacher_llm, "server", None)
        if server:
            # Set busy flag for all relevant sessions to "mute" the AI
            server.set_busy("training_session", True, timeout=3600, source="training")
            # Clear local LLM cache specifically
            try:
                from core.local_llm import LocalLLMService
                LocalLLMService.clear_cache()
            except Exception as e:
                logger.warning(f"Training: Failed to clear LLM cache: {e}")
        
        # 3. Run mlx_lm.lora
        data_dir = os.path.join(self.config.app_data_dir, "training", profile)
        os.makedirs(data_dir, exist_ok=True)
        # We'll just use the same data for all sets for simplicity in a small local setup
        for split in ["train.jsonl", "valid.jsonl", "test.jsonl"]:
            import shutil
            shutil.copy(temp_data_path, os.path.join(data_dir, split))

        cmd = [
            sys.executable, "-m", "mlx_lm.lora",
            "--train",
            "--model", model_path,
            "--data", data_dir,
            "--iters", str(iters),
            "--batch-size", "1",
            "--adapter-path", adapter_path
        ]
        
        logger.info(f"Training: Starting process: {' '.join(cmd)}")
        
        # Run as background process
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Initialize status with total iters
        self.training_status[profile] = {
            "status": "starting",
            "progress": 0,
            "total_iters": iters,
            "current_iter": 0,
            "loss": 0.0,
            "error": None,
            "started_at": datetime.now().isoformat()
        }
        
        # We return the process info, but keep it running
        return process, count

    async def monitor_training(self, profile: str, process: asyncio.subprocess.Process):
        import re
        from datetime import datetime
        
        # We don't want to overwrite total_iters if it was set in run_training
        current_status = self.training_status.get(profile, {})
        total_iters = current_status.get("total_iters", 0)
        
        self.training_status[profile] = {
            **current_status,
            "status": "running",
            "progress": 0,
            "current_iter": 0,
            "loss": 0.0,
            "error": None,
            "started_at": datetime.now().isoformat()
        }
        
        error_output = []
        
        try:
            # Read stdout and stderr line by line
            # mlx_lm often logs progress to stderr
            while True:
                line_bytes = await process.stderr.readline()
                if not line_bytes:
                    break
                    
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                
                error_output.append(line)
                logger.debug(f"Training [{profile}]: {line}")
                
                # Parse progress formats: 
                # 1. "Iter 10: loss 2.454"
                # 2. "Iteration 10/100: loss 2.454"
                match_iter = re.search(r"(?:Iter|Iteration)\s+(\d+)(?:\/\d+)?:\s+loss\s+([\d\.]+)", line)
                if match_iter:
                    current = int(match_iter.group(1))
                    loss = float(match_iter.group(2))
                    status = self.training_status.get(profile, {})
                    status["current_iter"] = current
                    status["loss"] = loss
                    if status.get("total_iters", 0) > 0:
                        # Ensure we don't exceed 99% until fully complete
                        prog = int((current / status["total_iters"]) * 100)
                        status["progress"] = min(prog, 99)
                    self.training_status[profile] = status

            await process.wait()
            if process.returncode == 0:
                logger.info(f"Training: Completed successfully for profile: {profile}")
                self.training_status[profile]["status"] = "completed"
                self.training_status[profile]["progress"] = 100
                
                # Update last trained time and count
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Get actual trainable count for this profile
                    cursor.execute(
                        "SELECT COUNT(*) FROM training_pairs WHERE profile = ? AND status IN ('ok', 'correction')",
                        (profile,)
                    )
                    current_count = cursor.fetchone()[0]

                    cursor.execute(
                        "INSERT OR REPLACE INTO training_metadata (profile, last_trained_at, last_trained_count) VALUES (?, ?, ?)",
                        (profile, datetime.now().isoformat(), current_count)
                    )
                    conn.commit()
            else:
                logger.error(f"Training: Process failed with code {process.returncode}")
                self.training_status[profile]["status"] = "failed"
                # Show last few lines of error output
                error_summary = "\n".join(error_output[-5:]) if error_output else f"Exit code: {process.returncode}"
                self.training_status[profile]["error"] = error_summary
            # Finally, clear the busy flag so Parcera can resume
            server = getattr(self.teacher_llm, "server", None)
            if server:
                server.set_busy("training_session", False)

        except Exception as e:
            logger.error(f"Training: Error monitoring process: {e}")
            self.training_status[profile]["status"] = "failed"
            self.training_status[profile]["error"] = str(e)
            
            # Clear busy flag even on failure
            server = getattr(self.teacher_llm, "server", None)
            if server:
                server.set_busy("training_session", False)

    def get_training_status(self, profile: str) -> Dict[str, Any]:
        return self.training_status.get(profile, {"status": "none"})
