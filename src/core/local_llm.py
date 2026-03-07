import asyncio
import logging
import threading
from typing import AsyncGenerator, List, Dict, Any, Optional
from aiavatar.sts.llm.base import LLMService, LLMResponse
from aiavatar.sts.llm.context_manager import ContextManager

logger = logging.getLogger(__name__)

class LocalLLMService(LLMService):
    _model = None
    _tokenizer = None
    _current_model_path = None
    _current_adapter_path = None

    def __init__(
        self,
        *,
        model: str,
        system_prompt: str,
        temperature: float = 0.8,
        max_tokens: int = 150,
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
        self.adapter_path = adapter_path

    @property
    def dynamic_tool_name(self) -> str:
        return "local_tool"

    @classmethod
    def _load_model(cls, model_path: str, adapter_path: Optional[str] = None):
        if not adapter_path:
            adapter_path = None
        if cls._model is None or cls._current_model_path != model_path or cls._current_adapter_path != adapter_path:
            from mlx_lm import load
            logger.info(f"Loading MLX model: {model_path} (adapter: {adapter_path})...")
            cls._model, cls._tokenizer = load(model_path, adapter_path=adapter_path)
            cls._current_model_path = model_path
            cls._current_adapter_path = adapter_path
            logger.info("MLX model loaded.")
        return cls._model, cls._tokenizer

    async def compose_messages(self, context_id: str, user_id: str, text: str, files: List[Dict[str, str]] = None, system_prompt_params: Dict[str, Any] = None) -> List[Dict]:
        messages = []
        
        # Add system prompt as a user message since Gemma 2 Instruct doesn't strictly have a system role in MLX template usually
        # Or we can just prepend it to the first user message.
        system_content = await self._get_system_prompt(context_id, user_id, system_prompt_params)
        
        # Add initial messages
        if self.initial_messages:
            messages.extend(self.initial_messages)

        # Get history
        # histories are returned as list of dicts with role and content
        histories = await self.context_manager.get_histories(
            context_id=[context_id] + self.shared_context_ids if self.shared_context_ids else [context_id]
        )
        
        # Filter histories to start with a user message if necessary (Gemma requirement)
        while histories and histories[0]["role"] != "user":
            histories.pop(0)
            
        messages.extend(histories)
        
        # Add current message
        if text:
            messages.append({"role": "user", "content": text})
            
        # Re-insert system prompt if it's the first message or prepend it to the first user message
        if messages and messages[0]["role"] == "user":
            messages[0]["content"] = f"{system_content}\n\n{messages[0]['content']}"
        elif system_content:
            messages.insert(0, {"role": "user", "content": system_content})
            messages.insert(1, {"role": "model", "content": "了解したわ！よろしくね。"})

        return messages

    async def update_context(self, context_id: str, user_id: str, messages: List[Dict], response_text: str):
        # Store in context manager. Gemma roles are user/model.
        # We append the assistant response.
        current_messages = list(messages)
        current_messages.append({"role": "model", "content": response_text})
        
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
        from mlx_lm.generate import stream_generate
        from mlx_lm.sample_utils import make_sampler
        
        model, tokenizer = self._load_model(self.model, self.adapter_path)
        
        # Apply chat template
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        
        logger.debug(f"Local LLM: Starting generation for context {context_id}")
        
        # Create sampler for temperature
        sampler = make_sampler(self.temperature)
        
        count = 0
        # Use stream_generate which handles temperature and decoding via sampler
        for response in stream_generate(
            model=model,
            tokenizer=tokenizer,
            prompt=prompt,
            max_tokens=self.max_tokens,
            sampler=sampler
        ):
            clean_text = response.text
            # Remove Gemma special tokens and roles that might leak
            for tag in ["<end_of_turn>", "<start_of_turn>", "<|end|>", "<|assistant|>", "<|user|>"]:
                clean_text = clean_text.replace(tag, "")
            
            # If we have content, yield it
            if clean_text.strip() or clean_text == " ":
                yield LLMResponse(context_id=context_id, text=clean_text)
            
            # small sleep to allow other tasks to run if needed
            await asyncio.sleep(0.01)
            
            count += 1
            if count >= self.max_tokens:
                break
        
        logger.debug(f"Local LLM: Finished generation ({count} tokens)")

    async def warmup(self):
        """Pre-load the model to memory."""
        logger.info("Local LLM: Warming up (pre-loading model)...")
        await asyncio.to_thread(self._load_model, self.model, self.adapter_path)
        logger.info("Local LLM: Warm-up complete.")
