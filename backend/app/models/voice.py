from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VoiceTokenRequest(BaseModel):
    """Request body for minting a LiveKit voice-session token.

    Project/Notion config is supplied by the browser pane and held only in the
    minted JWT (as participant attributes) — never persisted server-side.
    """

    project_id: str
    notion_token: str
    blockers_source: str = ""
    participant_identity: Optional[str] = None
    room: Optional[str] = None


class VoiceTokenResponse(BaseModel):
    server_url: str
    participant_token: str
