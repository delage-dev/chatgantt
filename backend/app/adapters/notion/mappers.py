"""Pure functions mapping Notion page/property JSON <-> ChatGantt models.

Property names are the contract defined in the Track-0 schema (see the plan):
Tasks data source uses Name/Type/Status/Timeline/Due/Assignee/Parent item/
Sub-items/Blocked by/Description/Priority; Blockers data source uses
Blocked task/Blocking task/External blocker/Reason/Severity/Status/Created by/
Created at/Resolved at/Resolved by/Auto resolved.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from app.models.blockers import Blocker, BlockerCreate, BlockerSeverity, BlockerStatus
from app.models.tickets import Assignee, Comment, Ticket, TicketType, TicketUpdate


# ─── property extraction helpers ────────────────────────────────────────────


def _rich(props: dict, name: str, key: str) -> list:
    return (props.get(name, {}) or {}).get(key) or []


def _plain_text(items: Optional[list]) -> str:
    return "".join(i.get("plain_text", "") for i in (items or []))


def _relation_ids(prop: dict) -> list[str]:
    return [r["id"] for r in (prop or {}).get("relation", []) or []]


def _first_relation(prop: dict) -> Optional[str]:
    ids = _relation_ids(prop)
    return ids[0] if ids else None


def _date_start(prop: dict) -> Optional[str]:
    d = (prop or {}).get("date")
    return d.get("start") if d else None


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    return date.fromisoformat(value[:10])


def _select_name(prop: dict) -> Optional[str]:
    sel = (prop or {}).get("select")
    return sel.get("name") if sel else None


# ─── tickets ────────────────────────────────────────────────────────────────


def page_to_ticket(page: dict) -> Ticket:
    props = page.get("properties", {})

    type_name = _select_name(props.get("Type", {}))
    try:
        ticket_type = TicketType(type_name.lower()) if type_name else TicketType.TASK
    except ValueError:
        ticket_type = TicketType.TASK

    status_obj = (props.get("Status", {}) or {}).get("status")
    status = status_obj["name"] if status_obj else ""

    date_obj = (props.get("Timeline", {}) or {}).get("date")
    start = _parse_date(date_obj.get("start")) if date_obj else None
    end = _parse_date(date_obj.get("end")) if date_obj else None

    people = (props.get("Assignee", {}) or {}).get("people") or []
    assignee = None
    if people:
        p = people[0]
        assignee = Assignee(
            id=p["id"],
            display_name=p.get("name") or "Unknown",
            avatar_url=p.get("avatar_url"),
        )

    deps = _relation_ids(props.get("Blocked by", {})) or None
    description = _plain_text(_rich(props, "Description", "rich_text")) or None
    url = page.get("url")

    return Ticket(
        id=page["id"],
        parent_id=_first_relation(props.get("Parent item", {})),
        ticket_type=ticket_type,
        summary=_plain_text(_rich(props, "Name", "title")),
        description=description,
        assignee=assignee,
        start_date=start,
        end_date=end,
        status=status,
        dependencies=deps,
        provider_meta={"notion_url": url} if url else None,
    )


def ticket_update_to_props(u: TicketUpdate) -> dict:
    props: dict[str, Any] = {}
    if u.start_date is not None:
        date_val: dict[str, str] = {"start": u.start_date.isoformat()}
        if u.end_date is not None:
            date_val["end"] = u.end_date.isoformat()
        props["Timeline"] = {"date": date_val}
    if u.assignee_id is not None:
        props["Assignee"] = {"people": [{"id": u.assignee_id}]}
    if u.description is not None:
        props["Description"] = {"rich_text": [{"text": {"content": u.description}}]}
    if u.parent_id is not None:
        props["Parent item"] = {"relation": [{"id": u.parent_id}]}
    if u.dependencies is not None:
        props["Blocked by"] = {"relation": [{"id": d} for d in u.dependencies]}
    return props


# ─── blockers ───────────────────────────────────────────────────────────────


def page_to_blocker(page: dict) -> Blocker:
    props = page["properties"]

    sev_name = _select_name(props.get("Severity", {}))
    try:
        severity = BlockerSeverity(sev_name.lower()) if sev_name else BlockerSeverity.MEDIUM
    except ValueError:
        severity = BlockerSeverity.MEDIUM

    status_name = _select_name(props.get("Status", {}))
    try:
        status = BlockerStatus(status_name.lower()) if status_name else BlockerStatus.ACTIVE
    except ValueError:
        status = BlockerStatus.ACTIVE

    return Blocker(
        id=page["id"],
        blocked_task_id=_first_relation(props.get("Blocked task", {})) or "",
        blocking_task_id=_first_relation(props.get("Blocking task", {})),
        external_blocker=_plain_text(_rich(props, "External blocker", "rich_text")) or None,
        reason=_plain_text(_rich(props, "Reason", "rich_text")),
        severity=severity,
        status=status,
        created_by=_plain_text(_rich(props, "Created by", "rich_text")),
        created_at=_date_start(props.get("Created at", {})) or "",
        resolved_at=_date_start(props.get("Resolved at", {})),
        resolved_by=_plain_text(_rich(props, "Resolved by", "rich_text")) or None,
        auto_resolved=bool((props.get("Auto resolved", {}) or {}).get("checkbox")),
    )


def blocker_create_to_props(b: BlockerCreate, author_id: str, now_iso: str) -> dict:
    props: dict[str, Any] = {
        "Name": {"title": [{"text": {"content": b.reason}}]},
        "Blocked task": {"relation": [{"id": b.blocked_task_id}]},
        "Reason": {"rich_text": [{"text": {"content": b.reason}}]},
        "Severity": {"select": {"name": b.severity.value}},
        "Status": {"select": {"name": "active"}},
        "Created by": {"rich_text": [{"text": {"content": author_id}}]},
        "Created at": {"date": {"start": now_iso}},
        "Auto resolved": {"checkbox": False},
    }
    if b.blocking_task_id:
        props["Blocking task"] = {"relation": [{"id": b.blocking_task_id}]}
    if b.external_blocker:
        props["External blocker"] = {"rich_text": [{"text": {"content": b.external_blocker}}]}
    return props


# ─── comments ───────────────────────────────────────────────────────────────


def page_to_comment(comment: dict) -> Comment:
    created_by = comment.get("created_by", {}) or {}
    return Comment(
        id=comment["id"],
        author=Assignee(
            id=created_by.get("id", "unknown"),
            display_name=created_by.get("name") or "Notion User",
        ),
        content=_plain_text(comment.get("rich_text")),
        created_at=comment.get("created_time", ""),
    )
