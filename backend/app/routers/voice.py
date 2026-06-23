from __future__ import annotations

import logging
import os
import uuid

from fastapi import APIRouter, HTTPException
from livekit.api import (
    AccessToken,
    RoomAgentDispatch,
    RoomConfiguration,
    VideoGrants,
)

from app.models.voice import VoiceTokenRequest, VoiceTokenResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# The dispatch name the LiveKit agent worker registers with
# (`@server.rtc_session(agent_name=...)`). Must match the worker.
AGENT_NAME = "chatgantt-voice-agent"


@router.post("/voice/token", response_model=VoiceTokenResponse, status_code=201)
async def mint_voice_token(body: VoiceTokenRequest) -> VoiceTokenResponse:
    """Mint a LiveKit access token for a browser voice session.

    The token grants room access and carries the caller's Notion/project config
    as participant attributes, plus a dispatch entry for the ChatGantt voice
    agent. Secrets live only in the JWT and are never persisted.
    """
    server_url = os.getenv("LIVEKIT_URL", "")
    api_key = os.getenv("LIVEKIT_API_KEY", "")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "")

    if not (server_url and api_key and api_secret):
        raise HTTPException(status_code=500, detail="LiveKit is not configured")

    identity = body.participant_identity or f"user-{uuid.uuid4().hex[:8]}"
    room = body.room or f"chatgantt-{uuid.uuid4().hex[:12]}"

    token = (
        AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .with_attributes(
            {
                "project_id": body.project_id,
                "notion_token": body.notion_token,
                "blockers_source": body.blockers_source,
            }
        )
        .with_room_config(
            RoomConfiguration(
                agents=[RoomAgentDispatch(agent_name=AGENT_NAME)],
            )
        )
        .to_jwt()
    )

    return VoiceTokenResponse(server_url=server_url, participant_token=token)
