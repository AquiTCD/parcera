import asyncio
import logging
import time
from typing import AsyncGenerator, Callable, Optional, List, Dict, Any
from aiavatar.sts.llm import LLMService

logger = logging.getLogger(__name__)

_FALLBACK_ERROR_MARKERS = (
    "429",
    "resource_exhausted",
    "rate_limit",
    "rate limit",
    "quota",
    "too many requests",
    "timeout",
    "timed out",
    "503",
    "overloaded",
)


def _is_fallback_trigger(exc: Exception) -> bool:
    if isinstance(exc, (TimeoutError, asyncio.TimeoutError)):
        return True
    msg = str(exc).lower()
    return any(marker in msg for marker in _FALLBACK_ERROR_MARKERS)


class ParceraLLMWrapper(LLMService):
    """
    Wraps any LLMService to provide Parcera-specific profiling, system prompt
    forwarding, and optional cooldown-based fallback to a secondary LLMService.
    """
    def __init__(
        self,
        wrapped_service: LLMService,
        profile_mode: bool = False,
        secondary: Optional[LLMService] = None,
        secondary_factory: Optional[Callable[[], LLMService]] = None,
        cooldown_seconds: int = 10800,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.wrapped = wrapped_service
        self.profile_mode = profile_mode
        self._secondary_instance = secondary
        self._secondary_factory = secondary_factory
        self.cooldown_seconds = cooldown_seconds
        self._clock = clock
        self._cooldown_until: Optional[float] = None
        self._system_prompt_logged = False
        self._last_compose_args: Optional[tuple] = None
        self._last_secondary_messages: Optional[list] = None
        self._active_turn_is_secondary: bool = False

    @property
    def has_secondary(self) -> bool:
        return self._secondary_instance is not None or self._secondary_factory is not None

    @property
    def secondary(self) -> Optional[LLMService]:
        if self._secondary_instance is None and self._secondary_factory is not None:
            self._secondary_instance = self._secondary_factory()
            if hasattr(self._secondary_instance, "system_prompt") and hasattr(self.wrapped, "system_prompt"):
                self._secondary_instance.system_prompt = self.wrapped.system_prompt
        return self._secondary_instance

    def _is_in_cooldown(self) -> bool:
        return (
            self.has_secondary
            and self._cooldown_until is not None
            and self._clock() < self._cooldown_until
        )

    @staticmethod
    def _fallback_context_id(context_id: str) -> str:
        return f"{context_id}:fallback"

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

    @property
    def system_prompt(self):
        return self.wrapped.system_prompt

    @system_prompt.setter
    def system_prompt(self, value):
        self.wrapped.system_prompt = value
        if self._secondary_instance is not None and hasattr(self._secondary_instance, "system_prompt"):
            self._secondary_instance.system_prompt = value

    async def compose_messages(self, context_id: str, user_id: str, text: str, files: Optional[List[Any]] = None, system_prompt_params: Optional[Dict[str, Any]] = None):
        self._last_compose_args = (context_id, user_id, text, files, system_prompt_params)
        self._last_secondary_messages = None
        if self._is_in_cooldown():
            self._active_turn_is_secondary = True
            msgs = await self.secondary.compose_messages(
                self._fallback_context_id(context_id),
                user_id,
                text,
                files,
                system_prompt_params,
            )
            self._last_secondary_messages = msgs
            return msgs

        self._active_turn_is_secondary = False
        return await self.wrapped.compose_messages(context_id, user_id, text, files, system_prompt_params)

    async def update_context(self, context_id: str, user_id: str, messages: list, response_text: str):
        if self._active_turn_is_secondary and self.secondary is not None:
            fb_msgs = self._last_secondary_messages if self._last_secondary_messages is not None else messages
            return await self.secondary.update_context(
                self._fallback_context_id(context_id),
                user_id,
                fb_msgs,
                response_text,
            )
        return await self.wrapped.update_context(context_id, user_id, messages, response_text)

    async def _stream_from_service(
        self,
        service: LLMService,
        context_id: str,
        user_id: str,
        messages: list,
        system_prompt_params: Optional[Dict[str, Any]],
        tools: Optional[List[Any]],
        **kwargs,
    ):
        for attempt in range(2):
            start_time = time.time()
            first_chunk = True
            try:
                async for chunk in service.get_llm_stream_response(
                    context_id, user_id, messages, system_prompt_params, tools, **kwargs
                ):
                    if first_chunk:
                        latency = time.time() - start_time
                        if self.profile_mode:
                            logger.info(f"[PERF] LLM First Token Latency: {latency:.3f}s")
                        first_chunk = False
                    yield chunk
                return
            except Exception as e:
                effort = getattr(service, "reasoning_effort", None)
                msg = str(e).lower()
                is_reasoning_err = "reasoning_effort" in msg and ("400" in msg or "unsupported" in msg or "not supported" in msg)
                if attempt == 0 and first_chunk and effort is not None and is_reasoning_err:
                    logger.warning(
                        f"LLM Wrapper: reasoning_effort '{effort}' is not supported by {getattr(service, 'model', 'model')}; "
                        "falling back to provider default (unset) and retrying."
                    )
                    service.reasoning_effort = None
                    continue
                raise

    async def get_llm_stream_response(self, context_id: str, user_id: str, messages: list, system_prompt_params: Optional[Dict[str, Any]] = None, tools: Optional[List[Any]] = None, **kwargs):
        # 1. System Prompt Logging (First time only)
        if not self._system_prompt_logged:
            if hasattr(self.wrapped, "_get_system_prompt"):
                try:
                    sys_prompt = await self.wrapped._get_system_prompt(context_id, user_id, system_prompt_params)
                    logger.debug(f"LLM Wrapper: System Prompt: {sys_prompt[:200]}...")
                except Exception:
                    pass
            self._system_prompt_logged = True

        # 2. Direct secondary route when primary is in cooldown
        if self._active_turn_is_secondary and self.secondary is not None:
            async for chunk in self._stream_from_service(
                self.secondary,
                self._fallback_context_id(context_id),
                user_id,
                messages,
                system_prompt_params,
                tools,
                **kwargs,
            ):
                yield chunk
            return

        # 3. Primary route with cooldown fallback on first-chunk failure
        received_any_chunk = False
        try:
            async for chunk in self._stream_from_service(
                self.wrapped, context_id, user_id, messages, system_prompt_params, tools, **kwargs
            ):
                received_any_chunk = True
                yield chunk
            self._cooldown_until = None
            return
        except Exception as e:
            if not received_any_chunk and self.has_secondary and _is_fallback_trigger(e):
                secondary = self.secondary
                self._cooldown_until = self._clock() + self.cooldown_seconds
                self._active_turn_is_secondary = True
                logger.warning(
                    f"LLM Wrapper: Primary LLM failed ({type(e).__name__}: {e}). "
                    f"Switching to fallback LLM for {self.cooldown_seconds}s."
                )
                fb_context_id = self._fallback_context_id(context_id)
                if self._last_compose_args is not None:
                    _, u_id, text, files, sys_params = self._last_compose_args
                    fb_messages = await self.secondary.compose_messages(
                        fb_context_id, u_id, text, files, sys_params
                    )
                else:
                    fb_messages = messages
                self._last_secondary_messages = fb_messages
                async for chunk in self._stream_from_service(
                    self.secondary, fb_context_id, user_id, fb_messages, system_prompt_params, tools, **kwargs
                ):
                    yield chunk
                return
            raise

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
        try:
            result = await self.wrapped.recognize(session_id, data)
        except Exception as e:
            logger.error(f"STT Wrapper: Error during delegation: {e}")
            if self.set_busy_handler:
                self.set_busy_handler(session_id, False)
            from aiavatar.sts.stt.base import SpeechRecognitionResult
            return SpeechRecognitionResult(text="")

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
                if self.set_busy_handler:
                    self.set_busy_handler(session_id, False)
                from aiavatar.sts.stt.base import SpeechRecognitionResult
                return SpeechRecognitionResult(text="")

        else:
            # Result text is empty (silence/noise)
            if self.set_busy_handler:
                self.set_busy_handler(session_id, False)

        return result
