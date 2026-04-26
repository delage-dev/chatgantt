from __future__ import annotations

from typing import Dict

from app.adapters.chat.base import ChatAdapter
from app.adapters.chat.anthropic_adapter import AnthropicChatAdapter
from app.adapters.chat.openai_adapter import OpenAIChatAdapter

_ADAPTERS: Dict[str, ChatAdapter] = {
    "anthropic": AnthropicChatAdapter(),
    "openai": OpenAIChatAdapter(),
}


def get_chat_adapter(provider: str) -> ChatAdapter:
    adapter = _ADAPTERS.get(provider)
    if adapter is None:
        raise ValueError(
            f"Unknown chat provider: {provider}. Available: {list(_ADAPTERS.keys())}"
        )
    return adapter
