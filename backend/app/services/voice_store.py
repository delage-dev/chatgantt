"""In-memory store for voice configuration and caller mappings.

All data is held in module-level state for the process lifetime.
Nothing is written to disk — restart clears everything.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from app.models.voice import CallerMappingRequest, VoiceConfigRequest, VoiceConfigStatus

_config: Optional[VoiceConfigRequest] = None
_callers: Dict[str, CallerMappingRequest] = {}
_pin_index: Dict[str, CallerMappingRequest] = {}


def set_config(config: VoiceConfigRequest) -> None:
    global _config
    _config = config


def get_config() -> Optional[VoiceConfigRequest]:
    return _config


def get_config_status() -> VoiceConfigStatus:
    if _config is None:
        return VoiceConfigStatus(configured=False)
    return VoiceConfigStatus(
        configured=True,
        twilio_phone_number=_config.twilio_phone_number,
        twilio_account_sid_last4=_config.twilio_account_sid[-4:],
        openai_key_last4=_config.openai_api_key[-4:],
    )


def add_caller(mapping: CallerMappingRequest) -> None:
    _callers[mapping.phone_number] = mapping
    if mapping.pin:
        _pin_index[mapping.pin] = mapping


def remove_caller(phone: str) -> bool:
    mapping = _callers.pop(phone, None)
    if mapping is None:
        return False
    if mapping.pin and mapping.pin in _pin_index:
        _pin_index.pop(mapping.pin, None)
    return True


def list_callers() -> List[CallerMappingRequest]:
    return list(_callers.values())


def lookup_caller(phone: str) -> Optional[CallerMappingRequest]:
    return _callers.get(phone)


def lookup_pin(pin: str) -> Optional[CallerMappingRequest]:
    return _pin_index.get(pin)
