import asyncio
import base64
import logging
from typing import List, Dict, Any
from google.genai import types
from aiavatar.sts.llm.gemini import GeminiService
from aiavatar.sts.llm import LLMResponse

logger = logging.getLogger(__name__)

class FixedGeminiService(GeminiService):
    def __init__(self, *args, profile_mode: bool = False, **kwargs):
        super().__init__(*args, **kwargs)
        self.profile_mode = profile_mode
        self._system_prompt_logged = False

    async def get_llm_stream_response(self, context_id: str, user_id: str, messages: List[dict], system_prompt_params: Dict[str, Any] = None, tools: List[Dict[str, Any]] = None):
        if messages:
            last_msg = messages[-1]
            if hasattr(last_msg, "parts"):
                user_text = "".join([p.text for p in last_msg.parts if p.text])
            else:
                user_text = str(last_msg)

        system_instruction = await self._get_system_prompt(context_id, user_id, system_prompt_params)

        logger.info(f"LLM: Requesting Gemini (context: {context_id}): {user_text}")
        if not self._system_prompt_logged:
            logger.debug(f"LLM: System Instruction (First Time): {system_instruction[:200]}...")
            self._system_prompt_logged = True
        else:
            logger.debug("LLM: System Instruction: [Applied]")

        logger.debug(f"LLM: Raw Messages to Gemini: {messages}")

        try:
            first_chunk = True
            async for chunk in super().get_llm_stream_response(context_id, user_id, messages, system_prompt_params, tools):
                if self.profile_mode:
                    import time
                    if first_chunk:
                        logger.info(f"[PERF] LLM First Chunk Received at {time.time():.3f}")
                        first_chunk = False
                    # Ensure chunk is stringified before slicing to avoid TypeError
                    logger.debug(f"[PERF] LLM Stream Chunk: {str(chunk)[:50]}...")
                elif first_chunk:
                    logger.debug(f"LLM: First chunk received for context: {context_id}")
                    first_chunk = False

                yield chunk
        except asyncio.CancelledError:
            logger.info(f"LLM: Request cancelled (context: {context_id}).")
            raise
        except Exception as e:
            # Check for common disconnection errors that can be ignored during cancellation
            err_msg = str(e)
            if any(x in err_msg for x in ["Server disconnected", "1006", "RemoteProtocolError"]):
                logger.debug(f"LLM: Connection closed (context: {context_id}): {err_msg}")
                # Re-raise as CancelledError to let the pipeline handle it gracefully
                raise asyncio.CancelledError() from e
            else:
                logger.error(f"LLM Error (context: {context_id}): {err_msg}", exc_info=True)
            raise

    async def update_context(self, context_id: str, user_id: str, messages: List[dict], response_text: str):
        # Add model response to history
        current_messages = list(messages)
        current_messages.append(types.Content(role="model", parts=[types.Part.from_text(text=response_text)]))

        dict_messages = []
        for m in current_messages:
            dumped = m.model_dump(exclude_none=True)

            # Binary data handling
            for part in dumped.get("parts", []):
                inline_data = part.get("inline_data")
                if inline_data and "data" in inline_data:
                    if isinstance(inline_data["data"], bytes):
                        inline_data["data"] = base64.b64encode(inline_data["data"]).decode("utf-8")

            dict_messages.append(dumped)

        if self._update_context_filter:
            if dict_messages and "parts" in dict_messages[-1]:
                for part in dict_messages[-1]["parts"]:
                    if "text" in part:
                        part["text"] = self._update_context_filter(part["text"])

        await self.context_manager.add_histories(context_id, dict_messages, "gemini")
