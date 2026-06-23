from __future__ import annotations

from typing import Dict

from app.adapters.base import TicketProviderAdapter
from app.adapters.mock_adapter import MockAdapter
from app.adapters.notion_adapter import NotionAdapter

_ADAPTERS: Dict[str, TicketProviderAdapter] = {
    "mock": MockAdapter(),
    "notion": NotionAdapter(),
}


def get_adapter(provider: str) -> TicketProviderAdapter:
    """Look up an adapter by provider name. Raises ValueError if unknown."""
    adapter = _ADAPTERS.get(provider)
    if adapter is None:
        raise ValueError(f"Unknown provider: {provider}. Available: {list(_ADAPTERS.keys())}")
    return adapter


def register_adapter(provider: str, adapter: TicketProviderAdapter) -> None:
    """Register a new adapter at runtime (useful for plugins/testing)."""
    _ADAPTERS[provider] = adapter
