from __future__ import annotations

from typing import List, Optional, runtime_checkable

from typing_extensions import Protocol

from app.models.chat import ChatMessage, ChatTurnResult, ToolDefinition


@runtime_checkable
class ChatAdapter(Protocol):
    """Contract for LLM chat adapters with optional tool calling."""

    async def chat(
        self,
        messages: List[ChatMessage],
        system_prompt: str,
        api_key: str,
        tools: Optional[List[ToolDefinition]] = None,
    ) -> ChatTurnResult:
        """Send messages to the LLM. Returns text and/or tool call requests."""
        ...
