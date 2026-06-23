"""Tests for POST /api/voice/token — LiveKit token minting."""
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
    resp = client.post(
        "/api/voice/token",
        json={
            "project_id": "ds-tasks",
            "notion_token": "secret-notion-token",
            "blockers_source": "ds-blockers",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["server_url"] == SERVER_URL
    assert data["participant_token"]


def test_token_carries_room_grant_and_attributes(client):
    resp = client.post(
        "/api/voice/token",
        json={
            "project_id": "ds-tasks",
            "notion_token": "secret-notion-token",
            "blockers_source": "ds-blockers",
        },
    )
    claims = _decode(resp.json()["participant_token"])

    grant = claims["video"]
    assert grant["roomJoin"] is True
    assert grant["room"]
    assert grant["canPublish"] is True
    assert grant["canSubscribe"] is True

    attrs = claims["attributes"]
    assert attrs["project_id"] == "ds-tasks"
    assert attrs["notion_token"] == "secret-notion-token"
    assert attrs["blockers_source"] == "ds-blockers"


def test_token_dispatches_chatgantt_voice_agent(client):
    resp = client.post(
        "/api/voice/token",
        json={
            "project_id": "ds-tasks",
            "notion_token": "secret-notion-token",
            "blockers_source": "ds-blockers",
        },
    )
    claims = _decode(resp.json()["participant_token"])
    agents = claims["roomConfig"]["agents"]
    assert any(a["agentName"] == "chatgantt-voice-agent" for a in agents)


def test_token_blockers_source_optional(client):
    resp = client.post(
        "/api/voice/token",
        json={
            "project_id": "ds-tasks",
            "notion_token": "secret-notion-token",
        },
    )
    assert resp.status_code == 201
    claims = _decode(resp.json()["participant_token"])
    assert claims["attributes"]["project_id"] == "ds-tasks"
    # absent blockers source surfaces as empty string in attributes
    assert claims["attributes"].get("blockers_source", "") == ""


def test_token_uses_provided_identity_and_room(client):
    resp = client.post(
        "/api/voice/token",
        json={
            "project_id": "ds-tasks",
            "notion_token": "tok",
            "participant_identity": "matt",
            "room": "project-room-xyz",
        },
    )
    claims = _decode(resp.json()["participant_token"])
    assert claims["sub"] == "matt"
    assert claims["video"]["room"] == "project-room-xyz"


def test_token_returns_500_when_livekit_not_configured(client, monkeypatch):
    monkeypatch.delenv("LIVEKIT_API_KEY", raising=False)
    monkeypatch.delenv("LIVEKIT_API_SECRET", raising=False)
    resp = client.post(
        "/api/voice/token",
        json={"project_id": "ds-tasks", "notion_token": "tok"},
    )
    assert resp.status_code == 500
