"""Notion-backed implementation of the TicketProviderAdapter protocol.

Stateless: ConnectionConfig is passed per call. A NotionClient is built per
call from the config (token + base_url); the constructor accepts an injected
``client_factory`` so tests can supply a mocked client.

Connection config mapping (Track-0 contract):
- ``access_token``                  → Notion internal integration token
- ``project_key``                   → Tasks data source ID
- ``base_url``                      → Notion API base (defaults to api.notion.com)
- ``extra["blockers_source"]``      → Blockers data source ID
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable, List, Optional, Tuple

from app.adapters.exceptions import TicketNotFoundError
from app.adapters.notion.client import DEFAULT_BASE_URL, NotionClient
from app.adapters.notion.mappers import (
    blocker_create_to_props,
    page_to_blocker,
    page_to_comment,
    page_to_ticket,
    ticket_update_to_props,
)
from app.models.blockers import Blocker, BlockerCreate, BlockerStatus
from app.models.tickets import (
    Comment,
    ConnectionConfig,
    Ticket,
    TicketTree,
    TicketUpdate,
)

PROVIDER = "notion"

ClientFactory = Callable[[ConnectionConfig], NotionClient]


def _default_client_factory(config: ConnectionConfig) -> NotionClient:
    return NotionClient(
        token=config.access_token,
        base_url=config.base_url or DEFAULT_BASE_URL,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class NotionAdapter:
    """Maps the ChatGantt adapter protocol onto the Notion data-source model."""

    def __init__(self, client_factory: ClientFactory = _default_client_factory) -> None:
        self._client_factory = client_factory

    # ─── helpers ─────────────────────────────────────────────────────────────

    def _client(self, config: ConnectionConfig) -> NotionClient:
        return self._client_factory(config)

    @staticmethod
    def _tasks_ds(config: ConnectionConfig) -> str:
        return config.project_key

    @staticmethod
    def _blockers_ds(config: ConnectionConfig) -> str:
        return config.extra["blockers_source"]

    # ─── tickets ─────────────────────────────────────────────────────────────

    async def get_project_tree(self, config: ConnectionConfig) -> TicketTree:
        client = self._client(config)
        pages = await client.query_data_source(self._tasks_ds(config))
        return TicketTree(
            project_key=config.project_key,
            tickets=[page_to_ticket(p) for p in pages],
        )

    async def get_ticket(self, config: ConnectionConfig, ticket_id: str) -> Ticket:
        client = self._client(config)
        page = await client.get_page(ticket_id)
        return page_to_ticket(page)

    async def update_ticket(
        self, config: ConnectionConfig, ticket_id: str, updates: TicketUpdate
    ) -> Ticket:
        client = self._client(config)
        props = ticket_update_to_props(updates)
        page = await client.update_page(ticket_id, props)
        return page_to_ticket(page)

    async def batch_update_tickets(
        self, config: ConnectionConfig, updates: List[Tuple[str, TicketUpdate]]
    ) -> List[str]:
        failed: List[str] = []
        for ticket_id, update in updates:
            try:
                await self.update_ticket(config, ticket_id, update)
            except Exception:  # noqa: BLE001 — any per-page failure is collected
                failed.append(ticket_id)
        return failed

    # ─── comments ────────────────────────────────────────────────────────────

    async def get_ticket_comments(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Comment]:
        client = self._client(config)
        raw = await client.list_comments(ticket_id)
        return [page_to_comment(c) for c in raw]

    async def create_comment(
        self, config: ConnectionConfig, ticket_id: str, content: str, author_id: str
    ) -> Comment:
        # Notion attributes the comment to the integration's identity; author_id
        # is accepted for protocol parity but not sent (the API has no author override).
        client = self._client(config)
        created = await client.create_comment(ticket_id, content)
        return page_to_comment(created)

    # ─── blockers ────────────────────────────────────────────────────────────

    async def list_blockers(
        self, config: ConnectionConfig, status: Optional[BlockerStatus] = None
    ) -> List[Blocker]:
        client = self._client(config)
        filter_ = None
        if status is not None:
            filter_ = {"property": "Status", "select": {"equals": status.value}}
        pages = await client.query_data_source(self._blockers_ds(config), filter_)
        return [page_to_blocker(p) for p in pages]

    async def get_task_blockers(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Blocker]:
        client = self._client(config)
        filter_ = {
            "or": [
                {"property": "Blocked task", "relation": {"contains": ticket_id}},
                {"property": "Blocking task", "relation": {"contains": ticket_id}},
            ]
        }
        pages = await client.query_data_source(self._blockers_ds(config), filter_)
        return [page_to_blocker(p) for p in pages]

    async def create_blocker(
        self, config: ConnectionConfig, blocker_data: BlockerCreate, author_id: str
    ) -> Blocker:
        client = self._client(config)

        # Validate that referenced task IDs exist in the Tasks data source.
        task_pages = await client.query_data_source(self._tasks_ds(config))
        existing = {p["id"] for p in task_pages}
        if blocker_data.blocked_task_id not in existing:
            raise TicketNotFoundError(blocker_data.blocked_task_id, provider=PROVIDER)
        if (
            blocker_data.blocking_task_id
            and blocker_data.blocking_task_id not in existing
        ):
            raise TicketNotFoundError(blocker_data.blocking_task_id, provider=PROVIDER)

        props = blocker_create_to_props(blocker_data, author_id, _now_iso())
        page = await client.create_page(self._blockers_ds(config), props)
        return page_to_blocker(page)

    async def resolve_blocker(
        self, config: ConnectionConfig, blocker_id: str, resolved_by: str
    ) -> Blocker:
        client = self._client(config)
        props = {
            "Status": {"select": {"name": BlockerStatus.RESOLVED.value}},
            "Resolved at": {"date": {"start": _now_iso()}},
            "Resolved by": {"rich_text": [{"text": {"content": resolved_by}}]},
        }
        page = await client.update_page(blocker_id, props)
        return page_to_blocker(page)

    async def delete_blocker(self, config: ConnectionConfig, blocker_id: str) -> None:
        # NotionClient has no archive/delete capability (update_page only sends
        # properties), so "delete" is implemented as a soft-resolve: the blocker
        # is marked resolved rather than removed from the data source.
        client = self._client(config)
        props = {"Status": {"select": {"name": BlockerStatus.RESOLVED.value}}}
        await client.update_page(blocker_id, props)
        return None

    async def auto_resolve_blockers_for(
        self, config: ConnectionConfig, ticket_id: str, resolved_by: str = "system"
    ) -> List[str]:
        client = self._client(config)
        filter_ = {
            "and": [
                {"property": "Blocking task", "relation": {"contains": ticket_id}},
                {"property": "Status", "select": {"equals": BlockerStatus.ACTIVE.value}},
            ]
        }
        pages = await client.query_data_source(self._blockers_ds(config), filter_)

        now_iso = _now_iso()
        resolved_ids: List[str] = []
        for page in pages:
            blocker_id = page["id"]
            props = {
                "Status": {"select": {"name": BlockerStatus.RESOLVED.value}},
                "Resolved at": {"date": {"start": now_iso}},
                "Resolved by": {"rich_text": [{"text": {"content": resolved_by}}]},
                "Auto resolved": {"checkbox": True},
            }
            await client.update_page(blocker_id, props)
            resolved_ids.append(blocker_id)
        return resolved_ids

    # ─── connection ──────────────────────────────────────────────────────────

    async def test_connection(self, config: ConnectionConfig) -> bool:
        try:
            client = self._client(config)
            result = await client.whoami()
            return bool(result)
        except Exception:  # noqa: BLE001 — any failure means the connection is bad
            return False
