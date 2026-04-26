from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class Resource(BaseModel):
    id: str
    title: str
    source_url: str
    source_type: str
    content: str
    summary: str
    last_fetched: Optional[str] = None
    linked_ticket_id: Optional[str] = None


class ResourceSummary(BaseModel):
    title: str
    source_url: str
    content: str


class ResourceFetchRequest(BaseModel):
    urls: List[str]
    source_type: str = "url"
    max_content_length: int = 4000


class ResourceFetchResponse(BaseModel):
    resources: List[Resource]
    errors: Dict[str, str]
