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

    # Gemma 4 thinking-block markers (soc_token + "thought" / eoc_token).
    # The tokenizer config stores soc_token as '<|channel>' but it decodes to '<channel>'
    # in the stream; we check both forms to be safe.
    _G4_THINK_OPEN = ("<channel>thought", "<|channel>thought")
    _G4_THINK_CLOSE = "<channel|>"   # eoc_token
    # Gemma 4 thinking consumes many tokens before the actual response.
    # Guarantee enough budget for thinking + reply so generation doesn't stall.
    _G4_MIN_TOKENS = 512

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
                if self._model_family == "gemma4":
                    m_tokens = max(m_tokens, self._G4_MIN_TOKENS)
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

        # --- Gemma 4 thinking-block filter ---
        # Gemma 4 outputs <channel>thought\n...reasoning...\n<channel|> before the actual
        # response. We buffer tokens to detect and discard these blocks so they don't reach
        # the TTS pipeline. We keep a rolling tail equal to (max_open_tag_len - 1) so that
        # tags split across token boundaries are still detected correctly.
        g4_buf = ""
        g4_thinking = False
        g4_max_tail = max(len(t) for t in self._G4_THINK_OPEN) + len(self._G4_THINK_CLOSE)

        while True:
            word = await asyncio.to_thread(q.get)

            if word is None:
                # Flush any buffered non-thinking content
                if g4_buf and not g4_thinking:
                    clean = g4_buf
                    for tag in self.SPECIAL_TAGS:
                        clean = clean.replace(tag, "")
                    if clean.strip() or clean == " ":
                        yield LLMResponse(context_id=context_id, text=clean)
                break
            if isinstance(word, Exception):
                raise word

            if self._model_family == "gemma4":
                g4_buf += word
                # Inner loop: process buffer until nothing changes
                changed = True
                while changed:
                    changed = False
                    if g4_thinking:
                        idx = g4_buf.find(self._G4_THINK_CLOSE)
                        if idx != -1:
                            g4_buf = g4_buf[idx + len(self._G4_THINK_CLOSE):]
                            g4_thinking = False
                            changed = True
                        else:
                            tail = len(self._G4_THINK_CLOSE) - 1
                            g4_buf = g4_buf[-tail:] if len(g4_buf) > tail else g4_buf
                    else:
                        earliest, found_tag = len(g4_buf), None
                        for tag in self._G4_THINK_OPEN:
                            i = g4_buf.find(tag)
                            if 0 <= i < earliest:
                                earliest, found_tag = i, tag
                        if found_tag:
                            before = g4_buf[:earliest]
                            g4_buf = g4_buf[earliest + len(found_tag):]
                            g4_thinking = True
                            changed = True
                            if before:
                                clean = before
                                for tag in self.SPECIAL_TAGS:
                                    clean = clean.replace(tag, "")
                                if clean.strip() or clean == " ":
                                    yield LLMResponse(context_id=context_id, text=clean)
                        else:
                            tail = max(len(t) for t in self._G4_THINK_OPEN) - 1
                            if len(g4_buf) > tail:
                                to_emit = g4_buf[:-tail]
                                g4_buf = g4_buf[-tail:]
                                clean = to_emit
                                for tag in self.SPECIAL_TAGS:
                                    clean = clean.replace(tag, "")
                                if clean.strip() or clean == " ":
                                    yield LLMResponse(context_id=context_id, text=clean)
            else:
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
