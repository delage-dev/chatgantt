#!/usr/bin/env python3
"""ChatGantt MCP Server — exposes task management as MCP tools."""
from __future__ import annotations

import json
import os
from datetime import date
from typing import Dict, List, Optional

from mcp.server.fastmcp import FastMCP

from app.adapters.registry import get_adapter
from app.adapters.knowledge.registry import get_knowledge_adapter
from app.adapters.exceptions import AdapterError, TicketNotFoundError
from app.models.tickets import ConnectionConfig, Ticket, TicketUpdate

server = FastMCP("chatgantt")


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _default_config(
    provider: Optional[str] = None,
    project_key: Optional[str] = None,
) -> ConnectionConfig:
    return ConnectionConfig(
        provider=provider or os.environ.get("CHATGANTT_PROVIDER", "mock"),
        project_key=project_key or os.environ.get("CHATGANTT_PROJECT", "DEMO"),
        access_token=os.environ.get("CHATGANTT_TOKEN", ""),
        base_url=os.environ.get("CHATGANTT_BASE_URL", ""),
    )


def _format_ticket(ticket: Ticket, indent: int = 0) -> str:
    prefix = "  " * indent
    assignee = ticket.assignee.display_name if ticket.assignee else "Unassigned"
    dates = ""
    if ticket.start_date and ticket.end_date:
        dates = f" | {ticket.start_date} -> {ticket.end_date}"
    tags = ""
    if ticket.provider_meta:
        tag_list = ticket.provider_meta.get("tags", [])
        if tag_list:
            tags = f" | Tags: {', '.join(tag_list)}"
    return (
        f"{prefix}**{ticket.id}** [{ticket.ticket_type.value}] {ticket.summary}\n"
        f"{prefix}  Status: {ticket.status} | Assignee: {assignee}{dates}{tags}"
    )


def _format_ticket_detail(ticket: Ticket) -> str:
    lines = [_format_ticket(ticket)]
    if ticket.description:
        lines.append(f"\n**Description:**\n{ticket.description}")
    if ticket.parent_id:
        lines.append(f"\nParent: {ticket.parent_id}")
    return "\n".join(lines)


def _format_tree(tickets: List[Ticket]) -> str:
    children_map: Dict[Optional[str], List[Ticket]] = {}
    for t in tickets:
        children_map.setdefault(t.parent_id, []).append(t)

    lines: List[str] = []

    def walk(parent_id: Optional[str], depth: int) -> None:
        for t in children_map.get(parent_id, []):
            lines.append(_format_ticket(t, depth))
            walk(t.id, depth + 1)

    walk(None, 0)
    return "\n".join(lines) if lines else "No tasks found."


# ─── Read Tools ───────────────────────────────────────────────────────────────


@server.tool()
async def list_tasks(
    project_key: str = "DEMO",
    provider: str = "mock",
) -> str:
    """List all tasks in a project as a formatted tree showing IDs, types, summaries, statuses, assignees, and dates."""
    try:
        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)
        tree = await adapter.get_project_tree(config)
        return _format_tree(tree.tickets)
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@server.tool()
async def get_task(
    ticket_id: str,
    provider: str = "mock",
    project_key: str = "DEMO",
) -> str:
    """Get full details of a single task including description, dates, assignee, status, and tags."""
    try:
        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)
        ticket = await adapter.get_ticket(config, ticket_id)
        return _format_ticket_detail(ticket)
    except TicketNotFoundError as e:
        return f"Error: {e}"
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@server.tool()
async def search_tasks(
    assignee: str = "",
    status: str = "",
    ticket_type: str = "",
    keyword: str = "",
    provider: str = "mock",
    project_key: str = "DEMO",
) -> str:
    """Search and filter tasks by assignee name, status, ticket type (epic/story/task), or keyword in summary/description."""
    try:
        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)
        tree = await adapter.get_project_tree(config)

        results = tree.tickets
        if assignee:
            a_lower = assignee.lower()
            results = [
                t for t in results
                if t.assignee and a_lower in t.assignee.display_name.lower()
            ]
        if status:
            s_lower = status.lower()
            results = [t for t in results if s_lower in t.status.lower()]
        if ticket_type:
            tt_lower = ticket_type.lower()
            results = [t for t in results if tt_lower in t.ticket_type.value.lower()]
        if keyword:
            k_lower = keyword.lower()
            results = [
                t for t in results
                if k_lower in t.summary.lower()
                or (t.description and k_lower in t.description.lower())
            ]

        if not results:
            return "No tasks matched your criteria."

        return "\n".join(_format_ticket(t) for t in results)
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@server.tool()
async def get_project_summary(
    project_key: str = "DEMO",
    provider: str = "mock",
) -> str:
    """Get a high-level project overview with counts by type and status, date ranges, and team members."""
    try:
        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)
        tree = await adapter.get_project_tree(config)
        tickets = tree.tickets

        type_counts: Dict[str, int] = {}
        status_counts: Dict[str, int] = {}
        assignees = set()
        start_dates: List[date] = []
        end_dates: List[date] = []

        for t in tickets:
            type_counts[t.ticket_type.value] = type_counts.get(t.ticket_type.value, 0) + 1
            status_counts[t.status] = status_counts.get(t.status, 0) + 1
            if t.assignee:
                assignees.add(t.assignee.display_name)
            if t.start_date:
                start_dates.append(t.start_date)
            if t.end_date:
                end_dates.append(t.end_date)

        lines = [
            f"# Project: {tree.project_key}",
            f"Total tickets: {len(tickets)}",
            "",
            "## By Type",
        ]
        for tt, count in sorted(type_counts.items()):
            lines.append(f"- {tt}: {count}")

        lines.append("\n## By Status")
        for st, count in sorted(status_counts.items()):
            lines.append(f"- {st}: {count}")

        if start_dates and end_dates:
            lines.append(f"\n## Timeline")
            lines.append(f"- Earliest start: {min(start_dates)}")
            lines.append(f"- Latest end: {max(end_dates)}")

        if assignees:
            lines.append(f"\n## Team ({len(assignees)} members)")
            for name in sorted(assignees):
                lines.append(f"- {name}")

        return "\n".join(lines)
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@server.tool()
async def fetch_resources(
    urls: str,
    source_type: str = "mock",
    project_key: str = "DEMO",
) -> str:
    """Fetch knowledge documents by URL. Pass urls as a JSON array string, e.g. '["mock://auth-architecture"]'."""
    try:
        url_list = json.loads(urls)
        if not isinstance(url_list, list):
            return "Error: urls must be a JSON array of strings"

        config = _default_config(project_key=project_key)
        adapter = get_knowledge_adapter(source_type)
        results = []
        errors = []

        for url in url_list:
            try:
                resource = await adapter.fetch_resource(url, config)
                results.append(
                    f"### [{resource.title}]({resource.source_url})\n"
                    f"*Type: {resource.source_type}*\n\n"
                    f"{resource.content}"
                )
            except Exception as e:
                errors.append(f"- {url}: {e}")

        output = []
        if results:
            output.append("\n\n---\n\n".join(results))
        if errors:
            output.append(f"\n\n**Errors:**\n" + "\n".join(errors))
        return "\n".join(output) if output else "No resources fetched."
    except json.JSONDecodeError:
        return "Error: urls must be a valid JSON array string"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


# ─── Write Tools ──────────────────────────────────────────────────────────────


@server.tool()
async def update_task(
    ticket_id: str,
    start_date: str = "",
    end_date: str = "",
    description: str = "",
    assignee_id: str = "",
    parent_id: str = "",
    provider: str = "mock",
    project_key: str = "DEMO",
) -> str:
    """Update a task's fields. Provide only the fields you want to change. Dates should be ISO format (YYYY-MM-DD)."""
    try:
        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)

        updates = {}
        if start_date:
            updates["start_date"] = date.fromisoformat(start_date)
        if end_date:
            updates["end_date"] = date.fromisoformat(end_date)
        if description:
            updates["description"] = description
        if assignee_id:
            updates["assignee_id"] = assignee_id
        if parent_id:
            updates["parent_id"] = parent_id

        if not updates:
            return "Error: No fields to update. Provide at least one field."

        ticket_update = TicketUpdate(**updates)
        updated = await adapter.update_ticket(config, ticket_id, ticket_update)
        return f"Updated successfully:\n\n{_format_ticket_detail(updated)}"
    except TicketNotFoundError as e:
        return f"Error: {e}"
    except ValueError as e:
        return f"Error: Invalid date format. Use YYYY-MM-DD. Details: {e}"
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


@server.tool()
async def batch_update_tasks(
    updates: str,
    provider: str = "mock",
    project_key: str = "DEMO",
) -> str:
    """Update multiple tasks at once. Pass updates as a JSON string: [{"ticket_id": "DEMO-1", "start_date": "2026-04-01"}, ...]"""
    try:
        update_list = json.loads(updates)
        if not isinstance(update_list, list):
            return "Error: updates must be a JSON array"

        config = _default_config(provider=provider, project_key=project_key)
        adapter = get_adapter(config.provider)

        pairs = []
        for item in update_list:
            tid = item.pop("ticket_id", None)
            if not tid:
                return "Error: Each update must have a 'ticket_id' field"
            if "start_date" in item:
                item["start_date"] = date.fromisoformat(item["start_date"])
            if "end_date" in item:
                item["end_date"] = date.fromisoformat(item["end_date"])
            pairs.append((tid, TicketUpdate(**item)))

        failed = await adapter.batch_update_tickets(config, pairs)
        succeeded = [tid for tid, _ in pairs if tid not in failed]

        lines = [f"Batch update complete:"]
        lines.append(f"- Succeeded: {len(succeeded)} ({', '.join(succeeded)})")
        if failed:
            lines.append(f"- Failed: {len(failed)} ({', '.join(failed)})")
        return "\n".join(lines)
    except json.JSONDecodeError:
        return "Error: updates must be a valid JSON string"
    except ValueError as e:
        return f"Error: Invalid date format. Use YYYY-MM-DD. Details: {e}"
    except AdapterError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"


# ─── Entrypoint ───────────────────────────────────────────────────────────────


if __name__ == "__main__":
    server.run()
