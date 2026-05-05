import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator, ClassVar, List, Dict, Any, Optional
from aiavatar.sts.llm.base import LLMService, LLMResponse
from aiavatar.sts.llm.context_manager import ContextManager

logger = logging.getLogger(__name__)

# MLX creates generation_stream as a thread-local at module import time, and model
# weight arrays are bound to that stream's thread. Mixing threads causes:
#   "There is no Stream(gpu, N) in current thread"
# Fix: dedicate one thread for all MLX operations (load + inference) so the stream
# and the weight arrays are always on the same thread.
_mlx_executor = ThreadPoolExecutor(max_workers=1)

class LocalLLMService(LLMService):
    _model = None
    _tokenizer = None
    _current_model_path = None
    _current_adapter_path = None
    _warned_missing_adapters: ClassVar[set[str]] = set()

    _GEMMA_TAGS = ["<end_of_turn>", "<start_of_turn>", "<|end|>", "<|assistant|>", "<|user|>"]
    _QWEN_TAGS = ["<|im_end|>", "<|im_start|>", "<|endoftext|>", "<think>", "</think>"]
    SPECIAL_TAGS: List[str] = list(set(_GEMMA_TAGS + _QWEN_TAGS))

    @staticmethod
    def _detect_model_family(model_path: str) -> str:
        """Detect model family from model path string."""
        path_lower = model_path.lower()
        if "qwen" in path_lower:
            return "qwen"
        if "gemma-4" in path_lower or "gemma4" in path_lower:
            return "gemma4"
        if "gemma" in path_lower:
            return "gemma"
        return "unknown"

    def __init__(
        self,
        *,
        model: str,
        system_prompt: str,
        temperature: float = 0.8,
        max_tokens: int = 150,
        repetition_penalty: float = 1.1,
        repetition_context_size: int = 20,
        adapter_path: Optional[str] = None,
        context_manager: Optional[ContextManager] = None,
        **kwargs
    ):
        super().__init__(
            system_prompt=system_prompt,
            model=model,
            temperature=temperature,
            context_manager=context_manager,
            **kwargs
        )
        self.max_tokens = max_tokens
        self.repetition_penalty = repetition_penalty
        self.repetition_context_size = repetition_context_size
        self.adapter_path = adapter_path
        self._model_family = self._detect_model_family(model)

    @property
    def dynamic_tool_name(self) -> str:
        return "local_tool"

    @classmethod
    def _load_model(cls, model_path: str, adapter_path: Optional[str] = None):
        if adapter_path and not os.path.exists(adapter_path):
            if adapter_path not in cls._warned_missing_adapters:
                logger.warning(f"Adapter path not found, loading base model only: {adapter_path}")
                cls._warned_missing_adapters.add(adapter_path)
            adapter_path = None
        if cls._model is None or cls._current_model_path != model_path or cls._current_adapter_path != adapter_path:
            from mlx_lm.utils import load_model, load_tokenizer, load_adapters, _download
            logger.info(f"Loading MLX model: {model_path} (adapter: {adapter_path})...")
            # strict=False to allow VL models (e.g. Qwen3.5) to load without vision tower weights
            resolved_path = _download(model_path)
            model, config = load_model(resolved_path, lazy=False, strict=False)
            if adapter_path:
                model = load_adapters(model, adapter_path)
                model.eval()
            tokenizer = load_tokenizer(resolved_path, eos_token_ids=config.get("eos_token_id"))
            cls._model, cls._tokenizer = model, tokenizer
            cls._current_model_path = model_path
            cls._current_adapter_path = adapter_path
            logger.info("MLX model loaded.")
        return cls._model, cls._tokenizer

    @classmethod
    def clear_cache(cls):
        """Unload the model from VRAM/RAM."""
        if cls._model is not None:
            logger.info("Local LLM: Unloading model to free up memory for training...")
            import gc
            cls._model = None
            cls._tokenizer = None
            cls._current_model_path = None
            cls._current_adapter_path = None
            cls._warned_missing_adapters.clear()
            gc.collect()
            logger.info("Local LLM: Model unloaded.")

    async def compose_messages(self, context_id: str, user_id: str, text: str, files: List[Dict[str, str]] = None, system_prompt_params: Dict[str, Any] = None) -> List[Dict]:
        messages = []
        system_content = await self._get_system_prompt(context_id, user_id, system_prompt_params)

        if self.initial_messages:
            messages.extend(self.initial_messages)

        histories = await self.context_manager.get_histories(
            context_id=[context_id] + self.shared_context_ids if self.shared_context_ids else [context_id]
        )

        if self._model_family == "gemma":
            # Gemma 2: system role unsupported — force histories to start with user
            while histories and histories[0]["role"] != "user":
                histories.pop(0)

        messages.extend(histories)

        if text:
            messages.append({"role": "user", "content": text})

        if self._model_family == "gemma":
            # Gemma 2: embed system_content into first user message
            if messages and messages[0]["role"] == "user":
                messages[0]["content"] = f"{system_content}\n\n{messages[0]['content']}"
            elif system_content:
                messages.insert(0, {"role": "user", "content": system_content})
                messages.insert(1, {"role": "model", "content": "了解したわ！よろしくね。"})
        else:
            # Gemma 4 / Qwen / unknown: system role is natively supported
            if system_content:
                messages.insert(0, {"role": "system", "content": system_content})

        return messages

    async def update_context(self, context_id: str, user_id: str, messages: List[Dict], response_text: str):
        assistant_role = "model" if self._model_family in ("gemma", "gemma4") else "assistant"

        current_messages = list(messages)
        current_messages.append({"role": assistant_role, "content": response_text})
        
        if self._update_context_filter:
            if current_messages and "content" in current_messages[-1]:
                current_messages[-1]["content"] = self._update_context_filter(current_messages[-1]["content"])

        await self.context_manager.add_histories(context_id, current_messages, "local")

    async def get_llm_stream_response(
        self,
        context_id: str,
        user_id: str,
        messages: List[dict],
        system_prompt_params: Dict[str, Any] = None,
        tools: List[Dict[str, Any]] = None,
        **kwargs
    ) -> AsyncGenerator[LLMResponse, None]:
        import queue

        template_kwargs = {"tokenize": False, "add_generation_prompt": True}
        if self._model_family == "qwen":
            template_kwargs["enable_thinking"] = False

        logger.debug(f"Local LLM: Starting generation for context {context_id}")

        q: queue.Queue = queue.Queue()

        def producer():
            from mlx_lm.generate import stream_generate
            from mlx_lm.sample_utils import make_sampler, make_repetition_penalty
            # Load model on this thread — all MLX ops (load + generate) must share one thread.
            # generation_stream is a thread-local created at import time; model weight arrays
            # are bound to that same thread's stream. Mixing threads → RuntimeError.
            model, tokenizer = self._load_model(self.model, self.adapter_path)
            prompt = tokenizer.apply_chat_template(messages, **template_kwargs)
            sampler = make_sampler(self.temperature)
            logits_processors = [make_repetition_penalty(self.repetition_penalty, self.repetition_context_size)]
            try:
                m_tokens = kwargs.get("max_tokens", self.max_tokens)
                for response in stream_generate(
                    model=model,
                    tokenizer=tokenizer,
                    prompt=prompt,
                    max_tokens=m_tokens,
                    sampler=sampler,
                    logits_processors=logits_processors
                ):
                    q.put(response.text)
                q.put(None)  # Sentinel for end
            except Exception as e:
                logger.error(f"Error in MLX generation thread: {e}")
                q.put(e)

        # Submit to the dedicated MLX thread (max_workers=1) — never a random thread
        _mlx_executor.submit(producer)

        while True:
            # Yield control back to event loop while waiting for the next word
            word = await asyncio.to_thread(q.get)

            if word is None:
                break
            if isinstance(word, Exception):
                raise word

            clean_text = word
            for tag in self.SPECIAL_TAGS:
                clean_text = clean_text.replace(tag, "")
            
            if clean_text.strip() or clean_text == " ":
                yield LLMResponse(context_id=context_id, text=clean_text)

        logger.debug(f"Local LLM: Finished generation for context {context_id}")

    async def warmup(self):
        """Pre-load the model to memory."""
        logger.info("Local LLM: Warming up (pre-loading model)...")
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_mlx_executor, self._load_model, self.model, self.adapter_path)
        logger.info("Local LLM: Warm-up complete.")
