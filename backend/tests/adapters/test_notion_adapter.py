"""Tests for NotionAdapter — the Notion-backed TicketProviderAdapter.

All tests mock NotionClient with AsyncMock; no real HTTP calls are made. The
adapter is stateless: ConnectionConfig is passed per call and a client is built
via an injected factory so we can assert on the exact client calls.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.adapters.base import TicketProviderAdapter
from app.adapters.exceptions import TicketNotFoundError
from app.adapters.notion_adapter import NotionAdapter
from app.adapters.registry import get_adapter
from app.models.blockers import BlockerCreate, BlockerSeverity, BlockerStatus
from app.models.tickets import ConnectionConfig, TicketType, TicketUpdate

TASKS_DS = "tasks-ds-id"
BLOCKERS_DS = "blockers-ds-id"


@pytest.fixture
def config() -> ConnectionConfig:
    return ConnectionConfig(
        provider="notion",
        access_token="secret_token",
        base_url="https://api.notion.com",
        project_key=TASKS_DS,
        extra={"blockers_source": BLOCKERS_DS},
    )


@pytest.fixture
def client() -> AsyncMock:
    """A fully-mocked NotionClient."""
    c = AsyncMock()
    return c


@pytest.fixture
def adapter(client: AsyncMock) -> NotionAdapter:
    """Adapter wired to return our mocked client regardless of config."""
    return NotionAdapter(client_factory=lambda config: client)


# ─── fixture page builders ──────────────────────────────────────────────────


def _task_page(
    page_id: str,
    name: str,
    type_name: str = "Task",
    status: str = "To Do",
    parent_id: str | None = None,
    blocked_by: list[str] | None = None,
) -> dict:
    props: dict = {
        "Name": {"title": [{"plain_text": name}]},
        "Type": {"select": {"name": type_name}},
        "Status": {"status": {"name": status}},
    }
    if parent_id:
        props["Parent item"] = {"relation": [{"id": parent_id}]}
    if blocked_by:
        props["Blocked by"] = {"relation": [{"id": d} for d in blocked_by]}
    return {"id": page_id, "url": f"https://notion.so/{page_id}", "properties": props}


def _blocker_page(
    page_id: str,
    blocked_task: str,
    blocking_task: str | None = None,
    status: str = "active",
    severity: str = "medium",
    reason: str = "blocked",
) -> dict:
    props: dict = {
        "Blocked task": {"relation": [{"id": blocked_task}]},
        "Reason": {"rich_text": [{"plain_text": reason}]},
        "Severity": {"select": {"name": severity}},
        "Status": {"select": {"name": status}},
        "Created by": {"rich_text": [{"plain_text": "user-1"}]},
        "Created at": {"date": {"start": "2026-06-22T00:00:00Z"}},
        "Auto resolved": {"checkbox": False},
    }
    if blocking_task:
        props["Blocking task"] = {"relation": [{"id": blocking_task}]}
    return {"id": page_id, "properties": props}


# ─── A.1: skeleton + registration + test_connection ─────────────────────────


def test_registered_as_notion():
    assert isinstance(get_adapter("notion"), NotionAdapter)


def test_satisfies_protocol():
    assert isinstance(NotionAdapter(), TicketProviderAdapter)


async def test_connection_true_on_whoami(adapter, client, config):
    client.whoami.return_value = {"id": "bot-1", "type": "bot"}
    assert await adapter.test_connection(config) is True
    client.whoami.assert_awaited_once()


async def test_connection_false_on_error(adapter, client, config):
    client.whoami.side_effect = RuntimeError("401")
    assert await adapter.test_connection(config) is False


# ─── A.2: get_project_tree + get_ticket ─────────────────────────────────────


async def test_get_project_tree(adapter, client, config):
    client.query_data_source.return_value = [
        _task_page("epic-1", "Epic One", type_name="Epic"),
        _task_page("story-1", "Story One", type_name="Story", parent_id="epic-1"),
        _task_page(
            "task-1", "Task One", type_name="Task", parent_id="story-1",
            blocked_by=["task-0"],
        ),
    ]

    tree = await adapter.get_project_tree(config)

    client.query_data_source.assert_awaited_once_with(TASKS_DS)
    assert tree.project_key == TASKS_DS
    assert len(tree.tickets) == 3
    by_id = {t.id: t for t in tree.tickets}
    assert by_id["epic-1"].ticket_type == TicketType.EPIC
    assert by_id["epic-1"].parent_id is None
    assert by_id["story-1"].parent_id == "epic-1"
    assert by_id["task-1"].parent_id == "story-1"
    assert by_id["task-1"].dependencies == ["task-0"]


async def test_get_ticket(adapter, client, config):
    client.get_page.return_value = _task_page("task-1", "Task One", status="Done")

    ticket = await adapter.get_ticket(config, "task-1")

    client.get_page.assert_awaited_once_with("task-1")
    assert ticket.id == "task-1"
    assert ticket.summary == "Task One"
    assert ticket.status == "Done"


# ─── A.3: blockers ──────────────────────────────────────────────────────────


async def test_list_blockers_no_filter(adapter, client, config):
    client.query_data_source.return_value = [
        _blocker_page("blk-1", "task-1", blocking_task="task-0"),
    ]

    blockers = await adapter.list_blockers(config)

    args, kwargs = client.query_data_source.call_args
    assert args[0] == BLOCKERS_DS
    # no filter passed when status is None
    assert kwargs.get("filter") is None and (len(args) < 2 or args[1] is None)
    assert len(blockers) == 1
    assert blockers[0].id == "blk-1"
    assert blockers[0].blocked_task_id == "task-1"


async def test_list_blockers_with_status_filter(adapter, client, config):
    client.query_data_source.return_value = []

    await adapter.list_blockers(config, status=BlockerStatus.RESOLVED)

    _, kwargs = client.query_data_source.call_args
    flt = kwargs.get("filter") or client.query_data_source.call_args[0][1]
    assert flt["property"] == "Status"
    assert flt["select"]["equals"] == "resolved"


async def test_get_task_blockers(adapter, client, config):
    client.query_data_source.return_value = [
        _blocker_page("blk-1", "task-1", blocking_task="task-0"),
        _blocker_page("blk-2", "task-2", blocking_task="task-1"),
    ]

    blockers = await adapter.get_task_blockers(config, "task-1")

    assert client.query_data_source.await_args[0][0] == BLOCKERS_DS
    ids = {b.id for b in blockers}
    assert ids == {"blk-1", "blk-2"}


async def test_create_blocker_validates_and_writes(adapter, client, config):
    # tasks queried to validate existence
    client.query_data_source.return_value = [
        _task_page("task-1", "Blocked"),
        _task_page("task-0", "Blocking"),
    ]
    client.create_page.return_value = _blocker_page(
        "blk-new", "task-1", blocking_task="task-0", reason="needs api"
    )

    data = BlockerCreate(
        blocked_task_id="task-1",
        blocking_task_id="task-0",
        reason="needs api",
        severity=BlockerSeverity.HIGH,
    )
    blocker = await adapter.create_blocker(config, data, author_id="user-9")

    # created against the blockers data source
    assert client.create_page.await_args[0][0] == BLOCKERS_DS
    props = client.create_page.await_args[0][1]
    assert props["Blocked task"]["relation"][0]["id"] == "task-1"
    assert props["Blocking task"]["relation"][0]["id"] == "task-0"
    assert props["Created by"]["rich_text"][0]["text"]["content"] == "user-9"
    assert blocker.id == "blk-new"


async def test_create_blocker_missing_task_raises(adapter, client, config):
    client.query_data_source.return_value = [_task_page("task-0", "Blocking")]

    data = BlockerCreate(
        blocked_task_id="task-missing",
        blocking_task_id="task-0",
        reason="x",
    )
    with pytest.raises(TicketNotFoundError):
        await adapter.create_blocker(config, data, author_id="user-9")
    client.create_page.assert_not_awaited()


async def test_resolve_blocker(adapter, client, config):
    client.update_page.return_value = _blocker_page(
        "blk-1", "task-1", blocking_task="task-0", status="resolved"
    )

    blocker = await adapter.resolve_blocker(config, "blk-1", resolved_by="user-9")

    page_id, props = client.update_page.await_args[0]
    assert page_id == "blk-1"
    assert props["Status"]["select"]["name"] == "resolved"
    assert props["Resolved by"]["rich_text"][0]["text"]["content"] == "user-9"
    assert "Resolved at" in props
    assert blocker.status == BlockerStatus.RESOLVED


async def test_delete_blocker_sets_resolved(adapter, client, config):
    client.update_page.return_value = _blocker_page("blk-1", "task-1", status="resolved")

    result = await adapter.delete_blocker(config, "blk-1")

    assert result is None
    page_id, props = client.update_page.await_args[0]
    assert page_id == "blk-1"
    assert props["Status"]["select"]["name"] == "resolved"


async def test_auto_resolve_blockers_for(adapter, client, config):
    # active blockers where Blocking task contains task-1
    client.query_data_source.return_value = [
        _blocker_page("blk-1", "task-2", blocking_task="task-1"),
        _blocker_page("blk-2", "task-3", blocking_task="task-1"),
    ]
    client.update_page.return_value = _blocker_page("blk-1", "task-2", status="resolved")

    resolved = await adapter.auto_resolve_blockers_for(config, "task-1")

    # queried the blockers ds with a filter on the blocking relation
    assert client.query_data_source.await_args[0][0] == BLOCKERS_DS
    assert set(resolved) == {"blk-1", "blk-2"}
    assert client.update_page.await_count == 2


# ─── A.4: comments + updates ────────────────────────────────────────────────


async def test_get_ticket_comments(adapter, client, config):
    client.list_comments.return_value = [
        {
            "id": "cmt-1",
            "created_by": {"id": "user-1", "name": "Alice"},
            "rich_text": [{"plain_text": "hello"}],
            "created_time": "2026-06-22T00:00:00Z",
        }
    ]

    comments = await adapter.get_ticket_comments(config, "task-1")

    client.list_comments.assert_awaited_once_with("task-1")
    assert comments[0].id == "cmt-1"
    assert comments[0].content == "hello"


async def test_create_comment(adapter, client, config):
    client.create_comment.return_value = {
        "id": "cmt-2",
        "created_by": {"id": "user-1", "name": "Alice"},
        "rich_text": [{"plain_text": "new comment"}],
        "created_time": "2026-06-22T00:00:00Z",
    }

    comment = await adapter.create_comment(config, "task-1", "new comment", "user-1")

    client.create_comment.assert_awaited_once_with("task-1", "new comment")
    assert comment.id == "cmt-2"
    assert comment.content == "new comment"


async def test_update_ticket(adapter, client, config):
    from datetime import date

    client.update_page.return_value = _task_page("task-1", "Task One", status="Done")

    updates = TicketUpdate(
        start_date=date(2026, 6, 22),
        end_date=date(2026, 6, 25),
        description="updated",
    )
    ticket = await adapter.update_ticket(config, "task-1", updates)

    page_id, props = client.update_page.await_args[0]
    assert page_id == "task-1"
    assert props["Timeline"]["date"]["start"] == "2026-06-22"
    assert props["Timeline"]["date"]["end"] == "2026-06-25"
    assert props["Description"]["rich_text"][0]["text"]["content"] == "updated"
    assert ticket.id == "task-1"


async def test_batch_update_collects_failures(adapter, client, config):
    from datetime import date

    def _update(page_id, props):
        if page_id == "task-bad":
            raise RuntimeError("boom")
        return _task_page(page_id, "ok")

    client.update_page.side_effect = _update

    updates = [
        ("task-1", TicketUpdate(start_date=date(2026, 6, 22))),
        ("task-bad", TicketUpdate(start_date=date(2026, 6, 22))),
        ("task-2", TicketUpdate(start_date=date(2026, 6, 22))),
    ]
    failed = await adapter.batch_update_tickets(config, updates)

    assert failed == ["task-bad"]
