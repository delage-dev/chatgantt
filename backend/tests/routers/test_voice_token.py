"""Tests for POST /api/voice/token — LiveKit token minting.

Single-tenant: the backend is server-configured, so the token carries NO
secrets. It mints a room-join grant plus an agent-dispatch entry; the agent's
tools call ChatGantt's own (server-configured) REST API.
"""
from __future__ import annotations

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app

API_KEY = "test-api-key"
API_SECRET = "test-api-secret-test-api-secret-32"  # >=32 bytes to keep jwt happy
SERVER_URL = "wss://example.livekit.cloud"


@pytest.fixture(autouse=True)
def _livekit_env(monkeypatch):
    monkeypatch.setenv("LIVEKIT_URL", SERVER_URL)
    monkeypatch.setenv("LIVEKIT_API_KEY", API_KEY)
    monkeypatch.setenv("LIVEKIT_API_SECRET", API_SECRET)


@pytest.fixture
def client():
    return TestClient(app)


def _decode(token: str) -> dict:
    return jwt.decode(token, API_SECRET, algorithms=["HS256"])


def test_token_endpoint_returns_201_with_server_url_and_token(client):
    resp = client.post("/api/voice/token", json={})
    assert resp.status_code == 201
    data = resp.json()
    assert data["server_url"] == SERVER_URL
    assert data["participant_token"]


def test_token_accepts_empty_body(client):
    # One-click voice posts no body at all.
    resp = client.post("/api/voice/token")
    assert resp.status_code == 201


def test_token_carries_room_grant(client):
    resp = client.post("/api/voice/token", json={})
    claims = _decode(resp.json()["participant_token"])

    grant = claims["video"]
    assert grant["roomJoin"] is True
    assert grant["room"]
    assert grant["canPublish"] is True
    assert grant["canSubscribe"] is True


def test_token_carries_no_secret_attributes(client):
    resp = client.post("/api/voice/token", json={})
    claims = _decode(resp.json()["participant_token"])

    # The JWT must not leak any Notion/project credentials. Either there is no
    # attributes claim at all, or it carries none of the old secret keys.
    attrs = claims.get("attributes", {}) or {}
    assert "notion_token" not in attrs
    assert "project_id" not in attrs
    assert "blockers_source" not in attrs


def test_token_dispatches_chatgantt_voice_agent(client):
    resp = client.post("/api/voice/token", json={})
    claims = _decode(resp.json()["participant_token"])
    agents = claims["roomConfig"]["agents"]
    assert any(a["agentName"] == "chatgantt-voice-agent" for a in agents)


def test_token_uses_provided_participant_name_as_identity(client):
    resp = client.post(
        "/api/voice/token",
        json={"participant_name": "matt"},
    )
    claims = _decode(resp.json()["participant_token"])
    assert claims["sub"] == "matt"


def test_token_uses_provided_identity_and_room(client):
    resp = client.post(
        "/api/voice/token",
        json={
            "participant_identity": "matt-id",
            "room": "project-room-xyz",
        },
    )
    claims = _decode(resp.json()["participant_token"])
    assert claims["sub"] == "matt-id"
    assert claims["video"]["room"] == "project-room-xyz"


def test_token_returns_500_when_livekit_not_configured(client, monkeypatch):
    monkeypatch.delenv("LIVEKIT_API_KEY", raising=False)
    monkeypatch.delenv("LIVEKIT_API_SECRET", raising=False)
    resp = client.post("/api/voice/token", json={})
    assert resp.status_code == 500
