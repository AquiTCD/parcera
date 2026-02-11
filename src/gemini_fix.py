
import asyncio
import base64
import logging
from typing import AsyncGenerator, Dict, List
from google import genai
from google.genai import types
from aiavatar.sts.llm.gemini import GeminiService

logger = logging.getLogger(__name__)

class FixedGeminiService(GeminiService):
    async def update_context(self, context_id: str, user_id: str, messages: List[dict], response_text: str):
        # The original code tries to append to 'messages' which are types.Content objects,
        # then converts them back to dicts to add to context_manager.
        # But wait, messages starts as a list of types.Content in compose_messages.

        # Add model response to history
        current_messages = list(messages) # Copy to avoid mutating original list unexpectedly
        current_messages.append(types.Content(role="model", parts=[types.Part.from_text(text=response_text)]))

        dict_messages = []
        for m in current_messages:
            # Manually convert Content to dict since model_validate/dump might be tricky with nested Part
            # Actually, types.Content is a Pydantic model.

            # The original code:
            # dumped = m.model_dump()
            # This should work if it's a Pydantic model.

            dumped = m.model_dump(exclude_none=True)

            # Binary data handling (images etc)
            for part in dumped.get("parts", []):
                inline_data = part.get("inline_data")
                if inline_data and "data" in inline_data:
                    # If it's already bytes, encode to base64 string for JSON serializability in SQLite
                    if isinstance(inline_data["data"], bytes):
                        inline_data["data"] = base64.b64encode(inline_data["data"]).decode("utf-8")

            dict_messages.append(dumped)

        if self._update_context_filter:
            # Check if there is text to filter in the last message
            if dict_messages and "parts" in dict_messages[-1]:
                for part in dict_messages[-1]["parts"]:
                    if "text" in part:
                        part["text"] = self._update_context_filter(part["text"])

        await self.context_manager.add_histories(context_id, dict_messages, "gemini")
