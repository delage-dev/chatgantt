import datetime

from app.adapters.notion.mappers import (
    blocker_create_to_props,
    page_to_blocker,
    page_to_comment,
    page_to_ticket,
    ticket_update_to_props,
)
from app.models.blockers import BlockerCreate, BlockerSeverity, BlockerStatus
from app.models.tickets import TicketType, TicketUpdate


def _task_page():
    return {
        "id": "page-1",
        "url": "https://notion.so/page-1",
        "properties": {
            "Name": {"type": "title", "title": [{"plain_text": "Build login"}]},
            "Type": {"type": "select", "select": {"name": "Story"}},
            "Status": {"type": "status", "status": {"name": "In progress"}},
            "Timeline": {"type": "date", "date": {"start": "2026-01-01", "end": "2026-01-10"}},
            "Assignee": {
                "type": "people",
                "people": [{"id": "u1", "name": "Matt", "avatar_url": "http://a"}],
            },
            "Parent item": {"type": "relation", "relation": [{"id": "epic-1"}]},
            "Blocked by": {"type": "relation", "relation": [{"id": "task-9"}]},
            "Description": {"type": "rich_text", "rich_text": [{"plain_text": "Do the thing"}]},
        },
    }


def test_page_to_ticket():
    t = page_to_ticket(_task_page())
    assert t.id == "page-1"
    assert t.summary == "Build login"
    assert t.ticket_type == TicketType.STORY
    assert t.status == "In progress"
    assert t.start_date == datetime.date(2026, 1, 1)
    assert t.end_date == datetime.date(2026, 1, 10)
    assert t.assignee.id == "u1"
    assert t.assignee.display_name == "Matt"
    assert t.parent_id == "epic-1"
    assert t.dependencies == ["task-9"]
    assert t.description == "Do the thing"


def test_page_to_ticket_status_from_select():
    # Provisioning creates Status as a select (Notion API can't create status-type),
    # so the mapper must read it from either a status or a select property.
    page = _task_page()
    page["properties"]["Status"] = {"type": "select", "select": {"name": "Done"}}
    t = page_to_ticket(page)
    assert t.status == "Done"


def test_page_to_ticket_handles_empty_optionals():
    page = {
        "id": "p",
        "properties": {
            "Name": {"type": "title", "title": []},
            "Type": {"type": "select", "select": None},
            "Status": {"type": "status", "status": None},
            "Timeline": {"type": "date", "date": None},
            "Assignee": {"type": "people", "people": []},
            "Parent item": {"type": "relation", "relation": []},
            "Blocked by": {"type": "relation", "relation": []},
            "Description": {"type": "rich_text", "rich_text": []},
        },
    }
    t = page_to_ticket(page)
    assert t.summary == ""
    assert t.ticket_type == TicketType.TASK
    assert t.status == ""
    assert t.start_date is None and t.end_date is None
    assert t.assignee is None
    assert t.parent_id is None
    assert t.dependencies is None
    assert t.description is None


def test_ticket_update_to_props():
    u = TicketUpdate(
        start_date=datetime.date(2026, 2, 1),
        end_date=datetime.date(2026, 2, 5),
        assignee_id="u2",
        description="new",
        parent_id="epic-2",
        dependencies=["t1", "t2"],
    )
    props = ticket_update_to_props(u)
    assert props["Timeline"]["date"] == {"start": "2026-02-01", "end": "2026-02-05"}
    assert props["Assignee"]["people"] == [{"id": "u2"}]
    assert props["Description"]["rich_text"][0]["text"]["content"] == "new"
    assert props["Parent item"]["relation"] == [{"id": "epic-2"}]
    assert props["Blocked by"]["relation"] == [{"id": "t1"}, {"id": "t2"}]


def test_ticket_update_to_props_skips_unset():
    props = ticket_update_to_props(TicketUpdate(description="only"))
    assert set(props.keys()) == {"Description"}


def _blocker_page():
    return {
        "id": "b-1",
        "properties": {
            "Blocked task": {"type": "relation", "relation": [{"id": "t-blocked"}]},
            "Blocking task": {"type": "relation", "relation": [{"id": "t-blocking"}]},
            "External blocker": {"type": "rich_text", "rich_text": []},
            "Reason": {"type": "rich_text", "rich_text": [{"plain_text": "waiting on API"}]},
            "Severity": {"type": "select", "select": {"name": "high"}},
            "Status": {"type": "select", "select": {"name": "active"}},
            "Created by": {"type": "rich_text", "rich_text": [{"plain_text": "matt"}]},
            "Created at": {"type": "date", "date": {"start": "2026-06-01T00:00:00.000Z"}},
            "Resolved at": {"type": "date", "date": None},
            "Resolved by": {"type": "rich_text", "rich_text": []},
            "Auto resolved": {"type": "checkbox", "checkbox": False},
        },
    }


def test_page_to_blocker():
    b = page_to_blocker(_blocker_page())
    assert b.id == "b-1"
    assert b.blocked_task_id == "t-blocked"
    assert b.blocking_task_id == "t-blocking"
    assert b.external_blocker is None
    assert b.reason == "waiting on API"
    assert b.severity == BlockerSeverity.HIGH
    assert b.status == BlockerStatus.ACTIVE
    assert b.created_by == "matt"
    assert b.created_at == "2026-06-01T00:00:00.000Z"
    assert b.resolved_at is None
    assert b.auto_resolved is False


def test_blocker_create_to_props_task_source():
    bc = BlockerCreate(
        blocked_task_id="tb", blocking_task_id="tk", reason="blocked!", severity=BlockerSeverity.LOW
    )
    props = blocker_create_to_props(bc, author_id="matt", now_iso="2026-06-22T00:00:00Z")
    assert props["Name"]["title"][0]["text"]["content"] == "blocked!"
    assert props["Blocked task"]["relation"] == [{"id": "tb"}]
    assert props["Blocking task"]["relation"] == [{"id": "tk"}]
    assert props["Reason"]["rich_text"][0]["text"]["content"] == "blocked!"
    assert props["Severity"]["select"]["name"] == "low"
    assert props["Status"]["select"]["name"] == "active"
    assert props["Created by"]["rich_text"][0]["text"]["content"] == "matt"
    assert props["Created at"]["date"]["start"] == "2026-06-22T00:00:00Z"
    assert props["Auto resolved"]["checkbox"] is False


def test_blocker_create_to_props_external_source():
    bc = BlockerCreate(blocked_task_id="tb", external_blocker="vendor delay", reason="ext")
    props = blocker_create_to_props(bc, author_id="m", now_iso="2026-06-22T00:00:00Z")
    assert "Blocking task" not in props
    assert props["External blocker"]["rich_text"][0]["text"]["content"] == "vendor delay"


def test_page_to_comment():
    c = {
        "id": "cmt-1",
        "created_by": {"object": "user", "id": "u9"},
        "rich_text": [{"plain_text": "looks good"}],
        "created_time": "2026-06-10T12:00:00.000Z",
    }
    comment = page_to_comment(c)
    assert comment.id == "cmt-1"
    assert comment.author.id == "u9"
    assert comment.content == "looks good"
    assert comment.created_at == "2026-06-10T12:00:00.000Z"
