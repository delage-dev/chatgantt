from __future__ import annotations

import logging
from typing import List
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from twilio.twiml.voice_response import Connect, Gather, VoiceResponse

from app.adapters.registry import get_adapter
from app.models.chat import TaskContext, TaskSummary
from app.models.tickets import ConnectionConfig
from app.models.voice import (
    CallerMappingRequest,
    CallerMappingResponse,
    VoiceConfigRequest,
    VoiceConfigStatus,
)
from app.services import voice_store
from app.services.chat_context import build_system_prompt
from app.services.voice_bridge import TwilioOpenAIBridge

logger = logging.getLogger(__name__)
router = APIRouter()

VOICE_PREAMBLE = """You are speaking on a phone call. Be conversational and concise.
The caller's name is {user_name}.
Greet them by name and ask how you can help with the project.
Say dates naturally (e.g., "next Tuesday" not "2026-04-14").
Keep responses brief — this is a phone call, not a written report.
"""


# ─── Configuration ────────────────────────────────────────────────────────────


@router.post("/voice/config", response_model=VoiceConfigStatus)
async def save_voice_config(config: VoiceConfigRequest):
    voice_store.set_config(config)
    return voice_store.get_config_status()


@router.get("/voice/config", response_model=VoiceConfigStatus)
async def get_voice_config():
    return voice_store.get_config_status()


# ─── Caller Mappings ──────────────────────────────────────────────────────────


@router.post("/voice/callers", response_model=CallerMappingResponse)
async def add_caller_mapping(mapping: CallerMappingRequest):
    voice_store.add_caller(mapping)
    return CallerMappingResponse(
        phone_number=mapping.phone_number,
        user_name=mapping.user_name,
        project_key=mapping.project_key,
    )


@router.get("/voice/callers", response_model=List[CallerMappingResponse])
async def list_caller_mappings():
    return [
        CallerMappingResponse(
            phone_number=m.phone_number,
            user_name=m.user_name,
            project_key=m.project_key,
        )
        for m in voice_store.list_callers()
    ]


@router.delete("/voice/callers/{phone}")
async def remove_caller_mapping(phone: str):
    if not voice_store.remove_caller(phone):
        raise HTTPException(status_code=404, detail="Caller mapping not found")
    return Response(status_code=204)


# ─── Twilio Webhooks ──────────────────────────────────────────────────────────


def _build_stream_twiml(host: str, scheme: str, project_key: str, user_name: str) -> str:
    ws_scheme = "wss" if scheme == "https" else "ws"
    stream_url = (
        f"{ws_scheme}://{host}/api/voice/stream"
        f"?project={quote(project_key)}&user={quote(user_name)}"
    )
    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)
    return str(response)


@router.post("/voice/incoming")
async def incoming_call(request: Request):
    config = voice_store.get_config()
    if not config:
        response = VoiceResponse()
        response.say("Voice service is not configured. Goodbye.")
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    form = await request.form()
    caller = form.get("From", "")
    host = request.headers.get("host", str(request.url.hostname))
    scheme = request.url.scheme

    mapping = voice_store.lookup_caller(caller)
    if mapping:
        twiml = _build_stream_twiml(host, scheme, mapping.project_key, mapping.user_name)
        return Response(content=twiml, media_type="application/xml")

    # Unknown caller — ask for PIN
    response = VoiceResponse()
    gather = Gather(input="dtmf", num_digits=4, action="/api/voice/pin-verify", method="POST")
    gather.say("Welcome to ChatGantt. Please enter your 4-digit PIN.")
    response.append(gather)
    response.say("No input received. Goodbye.")
    response.hangup()
    return Response(content=str(response), media_type="application/xml")


@router.post("/voice/pin-verify")
async def pin_verify(request: Request):
    form = await request.form()
    digits = form.get("Digits", "")
    host = request.headers.get("host", str(request.url.hostname))
    scheme = request.url.scheme

    mapping = voice_store.lookup_pin(digits)
    if mapping:
        twiml = _build_stream_twiml(host, scheme, mapping.project_key, mapping.user_name)
        return Response(content=twiml, media_type="application/xml")

    response = VoiceResponse()
    response.say("Invalid PIN. Goodbye.")
    response.hangup()
    return Response(content=str(response), media_type="application/xml")


# ─── WebSocket Stream ─────────────────────────────────────────────────────────


async def _build_voice_system_prompt(project_key: str, user_name: str) -> str:
    """Fetch project data and build a voice-optimized system prompt."""
    adapter = get_adapter("mock")
    config = ConnectionConfig(
        provider="mock",
        access_token="",
        base_url="",
        project_key=project_key,
    )
    tree = await adapter.get_project_tree(config)

    tasks = [
        TaskSummary(
            id=t.id,
            summary=t.summary,
            type=t.ticket_type.value,
            status=t.status,
            assignee=t.assignee.display_name if t.assignee else None,
            parent_id=t.parent_id,
            start_date=str(t.start_date) if t.start_date else None,
            end_date=str(t.end_date) if t.end_date else None,
            provider_meta=t.provider_meta,
        )
        for t in tree.tickets
    ]

    task_context = TaskContext(project_key=project_key, tasks=tasks)
    base_prompt = build_system_prompt(task_context)
    voice_intro = VOICE_PREAMBLE.format(user_name=user_name)
    return voice_intro + "\n" + base_prompt


@router.websocket("/voice/stream")
async def voice_stream(ws: WebSocket):
    await ws.accept()

    project = ws.query_params.get("project", "DEMO")
    user = ws.query_params.get("user", "Caller")

    config = voice_store.get_config()
    if not config:
        await ws.close(code=1008, reason="Voice not configured")
        return

    try:
        system_prompt = await _build_voice_system_prompt(project, user)
        bridge = TwilioOpenAIBridge(
            twilio_ws=ws,
            openai_api_key=config.openai_api_key,
            system_prompt=system_prompt,
        )
        await bridge.run()
    except WebSocketDisconnect:
        logger.info("Twilio WebSocket disconnected")
    except Exception as e:
        logger.error("Voice stream error: %s", e)
    finally:
        try:
            await ws.close()
        except Exception:
            pass
