"""Tests for POST /chat — single-tenant, server-configured LLM key.

The chat assistant's provider and API key come from env (``CHAT_PROVIDER`` /
``CHAT_API_KEY``), never from the browser. With NOTION_TOKEN unset the request
resolves to the mock ticket adapter, so no real Notion/LLM calls are made.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.adapters.chat import registry as chat_registry
from app.main import app
from app.models.chat import ChatTurnResult


@pytest.fixture(autouse=True)
def _mock_provider_env(monkeypatch):
    # Force the ticket adapter to mock (no Notion) for chat tests.
    monkeypatch.delenv("NOTION_TOKEN", raising=False)


@pytest.fixture
def client():
    return TestClient(app)


def _request_body() -> dict:
    return {
        "messages": [{"role": "user", "content": "hi"}],
        "project_context": {"project_key": "DEMO", "tasks": []},
    }


def test_chat_uses_env_key_not_browser_key(client, monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "anthropic")
    monkeypatch.setenv("CHAT_API_KEY", "sk-env-key")

    seen = {}

    async def fake_chat(self, messages, system_prompt, api_key, tools=None):
        seen["api_key"] = api_key
        return ChatTurnResult(text="hello back", stop_reason="end_turn")

    monkeypatch.setattr(
        chat_registry.AnthropicChatAdapter, "chat", fake_chat, raising=True
    )

    resp = client.post("/api/chat", json=_request_body())

    assert resp.status_code == 200
    assert seen["api_key"] == "sk-env-key"
    assert resp.json()["message"]["content"] == "hello back"


def test_chat_returns_503_when_key_unconfigured(client, monkeypatch):
    monkeypatch.delenv("CHAT_API_KEY", raising=False)

    resp = client.post("/api/chat", json=_request_body())

    assert resp.status_code == 503


def test_chat_uses_configured_provider(client, monkeypatch):
    monkeypatch.setenv("CHAT_PROVIDER", "openai")
    monkeypatch.setenv("CHAT_API_KEY", "sk-openai")

    async def fake_chat(self, messages, system_prompt, api_key, tools=None):
        return ChatTurnResult(text="from openai", stop_reason="end_turn")

    monkeypatch.setattr(
        chat_registry.OpenAIChatAdapter, "chat", fake_chat, raising=True
    )

    resp = client.post("/api/chat", json=_request_body())

    assert resp.status_code == 200
    assert resp.json()["message"]["content"] == "from openai"
