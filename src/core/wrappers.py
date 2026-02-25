import logging
import time
from typing import AsyncGenerator
from aiavatar.sts.llm import LLMService

logger = logging.getLogger(__name__)

class ParceraLLMWrapper(LLMService):
    """
    Wraps any LLMService to provide Parcera-specific profiling and system prompt logging.
    """
    def __init__(self, wrapped_service: LLMService, profile_mode: bool = False):
        self.wrapped = wrapped_service
        self.profile_mode = profile_mode
        self._system_prompt_logged = False

    async def chat(self, *args, **kwargs) -> AsyncGenerator[str, None]:
        # Delegate directly to the wrapped service
        async for chunk in self.wrapped.chat(*args, **kwargs):
            yield chunk

    def __getattr__(self, name):
        # Delegate access to undefined attributes (like context_manager) to the wrapped instance
        return getattr(self.wrapped, name)

    @property
    def dynamic_tool_name(self) -> str:
        return self.wrapped.dynamic_tool_name

    async def compose_messages(self, context_id: str, user_id: str, text: str, files: list = None, system_prompt_params: dict = None):
        return await self.wrapped.compose_messages(context_id, user_id, text, files, system_prompt_params)

    async def update_context(self, context_id: str, user_id: str, messages: list, response_text: str):
        return await self.wrapped.update_context(context_id, user_id, messages, response_text)

    async def get_llm_stream_response(self, context_id: str, user_id: str, messages: list, system_prompt_params: dict = None, tools: list = None):
        # 1. System Prompt Logging (First time only)
        if not self._system_prompt_logged:
            # We try to inspect the wrapped service to see if we can log the system prompt
            if hasattr(self.wrapped, "_get_system_prompt"):
                try:
                    # Note: This is hacky as it tries to access internal method of base classes
                    # but useful for debugging.
                    sys_prompt = await self.wrapped._get_system_prompt(context_id, user_id, system_prompt_params)
                    logger.debug(f"LLM Wrapper: System Prompt: {sys_prompt[:200]}...")
                except Exception:
                    pass
            self._system_prompt_logged = True

        # 2. Profiling & Streaming
        start_time = time.time()
        first_chunk = True

        async for chunk in self.wrapped.get_llm_stream_response(context_id, user_id, messages, system_prompt_params, tools):
            if first_chunk:
                latency = time.time() - start_time
                if self.profile_mode:
                    logger.info(f"[PERF] LLM First Token Latency: {latency:.3f}s")
                first_chunk = False

            yield chunk

class ParceraSTTWrapper:
    """
    Wraps any SpeechRecognizer to filter inputs when AI is busy or based on content.
    Note: Can't inherit SpeechRecognizer easily because we need to wrap the instance.
    """
    def __init__(self, wrapped_recognizer, is_busy_handler=None, set_busy_handler=None, response_filter=None, on_recognized_callback=None):
        self.wrapped = wrapped_recognizer
        self.is_busy_handler = is_busy_handler
        self.set_busy_handler = set_busy_handler
        self.response_filter = response_filter
        self.on_recognized_callback = on_recognized_callback

    async def recognize(self, session_id: str, data: bytes):
        # 1. Busy Check
        if self.is_busy_handler and self.is_busy_handler(session_id):
            logger.info(f"STT Wrapper: AI is busy. Ignoring input for session {session_id} (First-Wins).")
            # Return empty result structure compatible with aiavatar
            from aiavatar.sts.stt.base import SpeechRecognitionResult
            return SpeechRecognitionResult(text="")

        # Immediate Busy Flag
        if self.set_busy_handler:
            self.set_busy_handler(session_id, True)

        # 2. Delegate to wrapped recognizer
        result = await self.wrapped.recognize(session_id, data)
        result_text = result.text if hasattr(result, "text") else str(result)

        if result_text:
            # Determine if we should ignore this based on the filter
            is_filtered = False
            if self.response_filter and not self.response_filter.should_respond(result_text):
                is_filtered = True

            if self.on_recognized_callback:
                await self.on_recognized_callback(session_id, result_text, is_filtered)

            # Filtering happens AFTER the callback so the text can be logged
            if is_filtered:
                logger.debug(f"STT Wrapper: Ignored by filter (Silence Mode): {result_text}")
                from aiavatar.sts.stt.base import SpeechRecognitionResult
                return SpeechRecognitionResult(text="")

        return result
