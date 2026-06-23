"""HTTP-calling logic for the voice agent's function tools.

These are plain ``async`` functions that talk to ChatGantt's own REST API over
httpx. They are intentionally free of any ``livekit`` import so they can be
unit-tested with ``httpx.MockTransport`` and reused independently of the agent
runtime. The thin ``@function_tool`` wrappers in :mod:`agent.agent` build the
headers from participant attributes and delegate here.

Every call targets ChatGantt with the Notion provider headers:
``X-Provider: notion``, ``X-Project: <tasks data source>``,
``Authorization: Bearer <notion token>`` and (optionally)
``X-Notion-Blockers-Source: <blockers data source>``.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import httpx

# Timeout for ChatGantt REST calls. Voice interactions are latency-sensitive,
# so fail fast rather than letting the agent hang mid-conversation.
_TIMEOUT = httpx.Timeout(10.0)


class ToolError(Exception):
    """Raised when a REST call fails.

    Kept local (not ``livekit.agents.llm.ToolError``) so this module stays
    livekit-free. The agent wrapper translates it into LiveKit's ``ToolError``
    so the message is returned to the LLM instead of crashing the tool.
    """


def build_headers(project_id: str, notion_token: str, blockers_source: str) -> Dict[str, str]:
    """Build the ChatGantt REST headers from participant attributes."""
    headers = {
        "X-Provider": "notion",
        "X-Project": project_id,
        "Authorization": f"Bearer {notion_token}",
    }
    if blockers_source:
        headers["X-Notion-Blockers-Source"] = blockers_source
    return headers


async def _request(
    method: str,
    base_url: str,
    path: str,
    headers: Dict[str, str],
    *,
    client: Optional[httpx.AsyncClient] = None,
    **kwargs,
) -> httpx.Response:
    """Issue a request, reusing an injected client (tests) or opening one."""
    url = f"{base_url.rstrip('/')}{path}"
    if client is not None:
        resp = await client.request(method, url, headers=headers, **kwargs)
    else:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as owned:
            resp = await owned.request(method, url, headers=headers, **kwargs)
    return resp


def _check(resp: httpx.Response, action: str) -> None:
    if resp.status_code >= 400:
        raise ToolError(f"Could not {action} (status {resp.status_code}).")


def _fmt_blocker(b: dict) -> str:
    reason = b.get("reason") or "unspecified"
    severity = b.get("severity") or "medium"
    task = b.get("blocked_task_id") or "?"
    return f"{reason} (severity {severity}) on task {task}"


async def get_project_overview(
    base_url: str,
    headers: Dict[str, str],
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> str:
    """Fetch the project tree and return a concise, speech-friendly summary."""
    resp = await _request("GET", base_url, "/api/tasks", headers, client=client)
    _check(resp, "load the project")
    tree = resp.json()
    tickets: List[dict] = tree.get("tickets", [])
    if not tickets:
        return "The project has no tasks yet."

    by_type: Dict[str, int] = {}
    done = 0
    for t in tickets:
        by_type[t.get("ticket_type", "task")] = by_type.get(t.get("ticket_type", "task"), 0) + 1
        if (t.get("status") or "").lower() == "done":
            done += 1

    type_parts = ", ".join(f"{count} {name}{'s' if count != 1 else ''}"
                           for name, count in sorted(by_type.items()))
    names = ", ".join(t.get("summary", "untitled") for t in tickets[:3])
    return (
        f"The project has {len(tickets)} items ({type_parts}), "
        f"with {done} done. Recent items include: {names}."
    )


async def list_active_blockers(
    base_url: str,
    headers: Dict[str, str],
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> str:
    """List currently active blockers as a short spoken summary."""
    resp = await _request(
        "GET", base_url, "/api/blockers", headers,
        client=client, params={"status": "active"},
    )
    _check(resp, "list blockers")
    blockers: List[dict] = resp.json()
    if not blockers:
        return "There are no active blockers."
    lines = "; ".join(_fmt_blocker(b) for b in blockers[:5])
    count = len(blockers)
    return f"There {'is' if count == 1 else 'are'} {count} active blocker{'' if count == 1 else 's'}: {lines}."


async def create_blocker(
    base_url: str,
    headers: Dict[str, str],
    *,
    blocked_task_id: str,
    reason: str,
    severity: str = "medium",
    client: Optional[httpx.AsyncClient] = None,
) -> str:
    """Create a blocker on a task. The reason doubles as the external blocker.

    Voice can't reference another Notion page reliably, so blockers raised by
    voice are recorded as external blockers whose text is the reason.
    """
    body = {
        "blocked_task_id": blocked_task_id,
        "external_blocker": reason,
        "reason": reason,
        "severity": severity,
    }
    resp = await _request(
        "POST", base_url, "/api/blockers", headers, client=client, json=body
    )
    _check(resp, "create the blocker")
    created = resp.json()
    return (
        f"Created blocker {created.get('id', '')} on task {blocked_task_id}: "
        f"{reason} (severity {severity})."
    )


async def resolve_blocker(
    base_url: str,
    headers: Dict[str, str],
    *,
    blocker_id: str,
    client: Optional[httpx.AsyncClient] = None,
) -> str:
    """Resolve an existing blocker by ID."""
    resp = await _request(
        "POST", base_url, f"/api/blockers/{blocker_id}/resolve", headers, client=client
    )
    _check(resp, "resolve the blocker")
    return f"Blocker {blocker_id} is now resolved."
