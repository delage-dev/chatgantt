from __future__ import annotations

from typing import runtime_checkable

from typing_extensions import Protocol

from app.models.resources import Resource
from app.models.tickets import ConnectionConfig


@runtime_checkable
class KnowledgeAdapter(Protocol):
    """Contract for knowledge/resource fetching adapters."""

    async def fetch_resource(
        self,
        url: str,
        config: ConnectionConfig,
        max_content_length: int = 4000,
    ) -> Resource:
        """Fetch a single resource by URL or identifier."""
        ...
