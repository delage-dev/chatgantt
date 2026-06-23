"""Unit tests for the agent's HTTP-calling tool logic.

These exercise the plain async functions in ``agent.tools`` with a mocked
httpx transport. They must NOT import livekit — ``agent.tools`` is deliberately
livekit-free so it can be unit-tested without the agent runtime.
"""
from __future__ import annotations

import json

import httpx
import pytest

from agent import tools


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_build_headers_maps_attributes_to_chatgantt_headers():
    headers = tools.build_headers(
        project_id="ds-tasks",
        notion_token="secret-tok",
        blockers_source="ds-blockers",
    )
    assert headers["X-Provider"] == "notion"
    assert headers["X-Project"] == "ds-tasks"
    assert headers["Authorization"] == "Bearer secret-tok"
    assert headers["X-Notion-Blockers-Source"] == "ds-blockers"


def test_build_headers_omits_blockers_source_when_absent():
    headers = tools.build_headers(
        project_id="ds-tasks",
        notion_token="secret-tok",
        blockers_source="",
    )
    assert "X-Notion-Blockers-Source" not in headers


async def test_get_project_overview_calls_tasks_endpoint_with_headers():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["headers"] = dict(request.headers)
        body = {
            "project_key": "ds-tasks",
            "tickets": [
                {"id": "1", "ticket_type": "epic", "summary": "Launch", "status": "In Progress"},
                {"id": "2", "ticket_type": "task", "summary": "Wire API", "status": "Done",
                 "parent_id": "1"},
            ],
        }
        return httpx.Response(200, json=body)

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    text = await tools.get_project_overview(
        "http://api.test", headers, client=_client(handler)
    )

    assert seen["method"] == "GET"
    assert seen["url"] == "http://api.test/api/tasks"
    assert seen["headers"]["x-provider"] == "notion"
    assert seen["headers"]["x-project"] == "ds-tasks"
    assert seen["headers"]["authorization"] == "Bearer tok"
    # Speech-friendly summary mentions counts and at least one task name
    assert "2" in text
    assert "Launch" in text


async def test_get_project_overview_raises_tool_error_on_http_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="nope")

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    with pytest.raises(tools.ToolError):
        await tools.get_project_overview(
            "http://api.test", headers, client=_client(handler)
        )


async def test_list_active_blockers_queries_active_status():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(
            200,
            json=[
                {
                    "id": "b1",
                    "blocked_task_id": "2",
                    "reason": "waiting on design",
                    "severity": "high",
                    "status": "active",
                    "created_by": "voice",
                    "created_at": "2026-06-22T00:00:00Z",
                }
            ],
        )

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    text = await tools.list_active_blockers(
        "http://api.test", headers, client=_client(handler)
    )

    assert "/api/blockers" in seen["url"]
    assert "status=active" in seen["url"]
    assert "waiting on design" in text


async def test_list_active_blockers_reports_none_when_empty():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    text = await tools.list_active_blockers(
        "http://api.test", headers, client=_client(handler)
    )
    assert "no active blockers" in text.lower()


async def test_create_blocker_posts_correct_body():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "b9",
                "blocked_task_id": "2",
                "external_blocker": "vendor delay",
                "reason": "vendor delay",
                "severity": "medium",
                "status": "active",
                "created_by": "voice",
                "created_at": "2026-06-22T00:00:00Z",
            },
        )

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    text = await tools.create_blocker(
        "http://api.test",
        headers,
        blocked_task_id="2",
        reason="vendor delay",
        severity="medium",
        client=_client(handler),
    )

    assert seen["method"] == "POST"
    assert seen["url"] == "http://api.test/api/blockers"
    assert seen["body"]["blocked_task_id"] == "2"
    assert seen["body"]["reason"] == "vendor delay"
    assert seen["body"]["severity"] == "medium"
    # When no blocking task is given, an external_blocker is supplied so the
    # BlockerCreate "exactly one source" validator passes.
    assert seen["body"].get("external_blocker")
    assert "b9" in text or "created" in text.lower()


async def test_create_blocker_raises_tool_error_on_http_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, text="bad")

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    with pytest.raises(tools.ToolError):
        await tools.create_blocker(
            "http://api.test",
            headers,
            blocked_task_id="2",
            reason="x",
            severity="low",
            client=_client(handler),
        )


async def test_resolve_blocker_posts_to_resolve_endpoint():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["method"] = request.method
        return httpx.Response(
            200,
            json={
                "id": "b1",
                "blocked_task_id": "2",
                "reason": "waiting on design",
                "severity": "high",
                "status": "resolved",
                "created_by": "voice",
                "created_at": "2026-06-22T00:00:00Z",
                "resolved_at": "2026-06-22T01:00:00Z",
            },
        )

    headers = tools.build_headers("ds-tasks", "tok", "ds-blockers")
    text = await tools.resolve_blocker(
        "http://api.test", headers, blocker_id="b1", client=_client(handler)
    )

    assert seen["method"] == "POST"
    assert seen["url"] == "http://api.test/api/blockers/b1/resolve"
    assert "resolved" in text.lower()
