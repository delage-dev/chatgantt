"""Thin async HTTP wrapper for the Notion API (data-source model, 2025-09-03).

Built directly on httpx rather than the notion-client SDK so we control the
``Notion-Version`` header (the data-source endpoints are new) and rate-limit
handling precisely. Stateless: callers pass the integration token per client.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

NOTION_VERSION = "2025-09-03"
DEFAULT_BASE_URL = "https://api.notion.com"


class NotionClient:
    def __init__(
        self,
        token: str,
        base_url: str = DEFAULT_BASE_URL,
        http: Optional[httpx.AsyncClient] = None,
        max_retries: int = 5,
        max_concurrency: int = 3,
    ) -> None:
        self.token = token
        self._owns_http = http is None
        self._http = http or httpx.AsyncClient(base_url=base_url, timeout=30.0)
        self._max_retries = max_retries
        self._sem = asyncio.Semaphore(max_concurrency)

    async def aclose(self) -> None:
        if self._owns_http:
            await self._http.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_VERSION,
        }
        async with self._sem:
            for attempt in range(self._max_retries + 1):
                resp = await self._http.request(method, path, headers=headers, **kwargs)
                if resp.status_code == 429 and attempt < self._max_retries:
                    retry_after = float(resp.headers.get("Retry-After", "1"))
                    await asyncio.sleep(retry_after)
                    continue
                resp.raise_for_status()
                return resp.json()
        raise RuntimeError("unreachable")  # pragma: no cover

    async def query_data_source(
        self, ds_id: str, filter: Optional[dict] = None, sorts: Optional[list] = None
    ) -> list[dict]:
        """Query a data source, auto-paginating until exhausted."""
        results: list[dict] = []
        cursor: Optional[str] = None
        while True:
            body: dict[str, Any] = {"page_size": 100}
            if filter is not None:
                body["filter"] = filter
            if sorts is not None:
                body["sorts"] = sorts
            if cursor:
                body["start_cursor"] = cursor
            data = await self._request("POST", f"/v1/data_sources/{ds_id}/query", json=body)
            results.extend(data.get("results", []))
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")
        return results

    async def get_page(self, page_id: str) -> dict:
        return await self._request("GET", f"/v1/pages/{page_id}")

    async def update_page(self, page_id: str, properties: dict) -> dict:
        return await self._request(
            "PATCH", f"/v1/pages/{page_id}", json={"properties": properties}
        )

    async def create_page(self, parent_ds_id: str, properties: dict) -> dict:
        return await self._request(
            "POST",
            "/v1/pages",
            json={
                "parent": {"type": "data_source_id", "data_source_id": parent_ds_id},
                "properties": properties,
            },
        )

    async def list_comments(self, page_id: str) -> list[dict]:
        results: list[dict] = []
        cursor: Optional[str] = None
        while True:
            params: dict[str, Any] = {"block_id": page_id, "page_size": 100}
            if cursor:
                params["start_cursor"] = cursor
            data = await self._request("GET", "/v1/comments", params=params)
            results.extend(data.get("results", []))
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")
        return results

    async def create_comment(self, page_id: str, text: str) -> dict:
        return await self._request(
            "POST",
            "/v1/comments",
            json={"parent": {"page_id": page_id}, "rich_text": [{"text": {"content": text}}]},
        )

    async def whoami(self) -> dict:
        return await self._request("GET", "/v1/users/me")
