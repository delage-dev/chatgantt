import json

import httpx

from app.adapters.notion.client import NotionClient


def _client(handler):
    transport = httpx.MockTransport(handler)
    http = httpx.AsyncClient(transport=transport, base_url="https://api.notion.com")
    return NotionClient(token="secret_test", http=http)


async def test_query_data_source_paginates():
    calls = []

    def handler(request):
        calls.append(request)
        body = json.loads(request.content)
        if "start_cursor" not in body:
            return httpx.Response(
                200, json={"results": [{"id": "a"}], "has_more": True, "next_cursor": "c1"}
            )
        assert body["start_cursor"] == "c1"
        return httpx.Response(
            200, json={"results": [{"id": "b"}], "has_more": False, "next_cursor": None}
        )

    client = _client(handler)
    results = await client.query_data_source("ds123")
    assert [r["id"] for r in results] == ["a", "b"]
    assert calls[0].headers["Notion-Version"] == "2025-09-03"
    assert calls[0].headers["Authorization"] == "Bearer secret_test"
    assert calls[0].url.path == "/v1/data_sources/ds123/query"


async def test_query_data_source_retries_on_429():
    state = {"n": 0}

    def handler(request):
        state["n"] += 1
        if state["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"}, json={})
        return httpx.Response(200, json={"results": [], "has_more": False})

    client = _client(handler)
    results = await client.query_data_source("ds")
    assert results == []
    assert state["n"] == 2


async def test_get_page():
    def handler(request):
        assert request.method == "GET"
        assert request.url.path == "/v1/pages/p1"
        return httpx.Response(200, json={"id": "p1", "object": "page"})

    client = _client(handler)
    page = await client.get_page("p1")
    assert page["id"] == "p1"


async def test_update_page_sends_properties():
    captured = {}

    def handler(request):
        assert request.method == "PATCH"
        assert request.url.path == "/v1/pages/p1"
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"id": "p1"})

    client = _client(handler)
    await client.update_page("p1", {"Status": {"status": {"name": "Done"}}})
    assert captured["properties"]["Status"]["status"]["name"] == "Done"


async def test_create_page_sets_data_source_parent():
    captured = {}

    def handler(request):
        assert request.url.path == "/v1/pages"
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"id": "new"})

    client = _client(handler)
    page = await client.create_page("ds9", {"Name": {"title": []}})
    assert page["id"] == "new"
    assert captured["parent"] == {"type": "data_source_id", "data_source_id": "ds9"}
    assert "Name" in captured["properties"]


async def test_list_comments_paginates():
    state = {"n": 0}

    def handler(request):
        state["n"] += 1
        assert request.url.path == "/v1/comments"
        if state["n"] == 1:
            assert request.url.params["block_id"] == "p1"
            return httpx.Response(
                200, json={"results": [{"id": "c1"}], "has_more": True, "next_cursor": "n1"}
            )
        assert request.url.params["start_cursor"] == "n1"
        return httpx.Response(200, json={"results": [{"id": "c2"}], "has_more": False})

    client = _client(handler)
    comments = await client.list_comments("p1")
    assert [c["id"] for c in comments] == ["c1", "c2"]


async def test_create_comment():
    captured = {}

    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/v1/comments"
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"id": "c9"})

    client = _client(handler)
    c = await client.create_comment("p1", "hello")
    assert c["id"] == "c9"
    assert captured["parent"] == {"page_id": "p1"}
    assert captured["rich_text"][0]["text"]["content"] == "hello"


async def test_whoami():
    def handler(request):
        assert request.url.path == "/v1/users/me"
        return httpx.Response(200, json={"id": "bot", "type": "bot"})

    client = _client(handler)
    me = await client.whoami()
    assert me["id"] == "bot"
