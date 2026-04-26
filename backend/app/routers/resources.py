from __future__ import annotations

import asyncio
from typing import Dict, List, Tuple

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.knowledge.registry import get_knowledge_adapter
from app.dependencies import get_connection_config
from app.models.resources import Resource, ResourceFetchRequest, ResourceFetchResponse
from app.models.tickets import ConnectionConfig

router = APIRouter()


async def _fetch_one(
    url: str, source_type: str, config: ConnectionConfig, max_content_length: int
) -> Tuple[str, Resource | None, str | None]:
    """Fetch a single resource, returning (url, resource_or_none, error_or_none)."""
    try:
        adapter = get_knowledge_adapter(source_type)
        resource = await adapter.fetch_resource(url, config, max_content_length)
        return (url, resource, None)
    except Exception as e:
        return (url, None, str(e))


@router.post("/resources/fetch", response_model=ResourceFetchResponse)
async def fetch_resources(
    request: ResourceFetchRequest,
    config: ConnectionConfig = Depends(get_connection_config),
):
    if not request.urls:
        return ResourceFetchResponse(resources=[], errors={})

    # Fetch all URLs concurrently
    tasks = [
        _fetch_one(url, request.source_type, config, request.max_content_length)
        for url in request.urls
    ]
    results = await asyncio.gather(*tasks)

    resources: List[Resource] = []
    errors: Dict[str, str] = {}
    for url, resource, error in results:
        if resource:
            resources.append(resource)
        elif error:
            errors[url] = error

    return ResourceFetchResponse(resources=resources, errors=errors)
