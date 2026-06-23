from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VoiceTokenRequest(BaseModel):
    """Request body for minting a LiveKit voice-session token.

    Single-tenant: the backend is server-configured, so the token carries no
    secrets. The body is optional — one-click voice may post nothing at all —
    and only names the participant/room.
    """

    participant_name: Optional[str] = None
    participant_identity: Optional[str] = None
    room: Optional[str] = None


class VoiceTokenResponse(BaseModel):
    server_url: str
    participant_token: str
