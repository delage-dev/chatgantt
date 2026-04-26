from __future__ import annotations

from typing import Dict

from app.adapters.knowledge.base import KnowledgeAdapter
from app.adapters.knowledge.mock_adapter import MockKnowledgeAdapter
from app.adapters.knowledge.url_adapter import UrlKnowledgeAdapter

_ADAPTERS: Dict[str, KnowledgeAdapter] = {
    "url": UrlKnowledgeAdapter(),
    "mock": MockKnowledgeAdapter(),
}


def get_knowledge_adapter(source_type: str) -> KnowledgeAdapter:
    adapter = _ADAPTERS.get(source_type)
    if adapter is None:
        raise ValueError(
            f"Unknown knowledge source type: {source_type}. "
            f"Available: {list(_ADAPTERS.keys())}"
        )
    return adapter
