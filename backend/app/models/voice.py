from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VoiceConfigRequest(BaseModel):
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    openai_api_key: str


class VoiceConfigStatus(BaseModel):
    configured: bool
    twilio_phone_number: Optional[str] = None
    twilio_account_sid_last4: Optional[str] = None
    openai_key_last4: Optional[str] = None


class CallerMappingRequest(BaseModel):
    phone_number: str
    user_name: str
    project_key: str
    pin: Optional[str] = None


class CallerMappingResponse(BaseModel):
    phone_number: str
    user_name: str
    project_key: str
