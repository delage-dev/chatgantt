"""Bidirectional audio bridge between Twilio Media Streams and OpenAI Realtime API."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import websockets
from fastapi import WebSocket

logger = logging.getLogger(__name__)

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"


class TwilioOpenAIBridge:
    """Bridges audio between a Twilio media stream WebSocket and OpenAI Realtime."""

    def __init__(
        self,
        twilio_ws: WebSocket,
        openai_api_key: str,
        system_prompt: str,
        voice: str = "alloy",
    ) -> None:
        self.twilio_ws = twilio_ws
        self.openai_api_key = openai_api_key
        self.system_prompt = system_prompt
        self.voice = voice
        self.openai_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.stream_sid: Optional[str] = None

    async def run(self) -> None:
        """Main entry point — opens OpenAI connection and bridges both directions."""
        try:
            await self._connect_openai()
            await self._send_session_update()

            twilio_task = asyncio.create_task(self._handle_twilio_messages())
            openai_task = asyncio.create_task(self._handle_openai_messages())

            done, pending = await asyncio.wait(
                [twilio_task, openai_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            for task in done:
                if task.exception():
                    logger.error("Bridge task error: %s", task.exception())

        finally:
            await self.cleanup()

    async def _connect_openai(self) -> None:
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "OpenAI-Beta": "realtime=v1",
        }
        self.openai_ws = await websockets.connect(
            OPENAI_REALTIME_URL,
            additional_headers=headers,
        )
        logger.info("Connected to OpenAI Realtime API")

    async def _send_session_update(self) -> None:
        session_config = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": self.system_prompt,
                "voice": self.voice,
                "input_audio_format": "g711_ulaw",
                "output_audio_format": "g711_ulaw",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
            },
        }
        await self.openai_ws.send(json.dumps(session_config))
        logger.info("Sent session.update to OpenAI")

    async def _handle_twilio_messages(self) -> None:
        """Receive from Twilio, forward audio to OpenAI."""
        async for raw in self.twilio_ws.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")

            if event == "connected":
                logger.info("Twilio stream connected")

            elif event == "start":
                self.stream_sid = msg["start"]["streamSid"]
                logger.info("Twilio stream started: %s", self.stream_sid)

            elif event == "media":
                payload = msg["media"]["payload"]
                audio_msg = {
                    "type": "input_audio_buffer.append",
                    "audio": payload,
                }
                await self.openai_ws.send(json.dumps(audio_msg))

            elif event == "stop":
                logger.info("Twilio stream stopped")
                break

    async def _handle_openai_messages(self) -> None:
        """Receive from OpenAI, forward audio to Twilio."""
        async for raw in self.openai_ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type")

            if msg_type == "response.audio.delta":
                delta = msg.get("delta", "")
                if delta and self.stream_sid:
                    twilio_msg = {
                        "event": "media",
                        "streamSid": self.stream_sid,
                        "media": {"payload": delta},
                    }
                    await self.twilio_ws.send_text(json.dumps(twilio_msg))

            elif msg_type == "input_audio_buffer.speech_started":
                # Barge-in: stop current playback and cancel response
                if self.stream_sid:
                    clear_msg = {
                        "event": "clear",
                        "streamSid": self.stream_sid,
                    }
                    await self.twilio_ws.send_text(json.dumps(clear_msg))
                cancel_msg = {"type": "response.cancel"}
                await self.openai_ws.send(json.dumps(cancel_msg))

            elif msg_type == "error":
                logger.error("OpenAI error: %s", msg.get("error"))

            elif msg_type in ("session.created", "session.updated"):
                logger.info("OpenAI %s", msg_type)

    async def cleanup(self) -> None:
        if self.openai_ws:
            try:
                await self.openai_ws.close()
            except Exception:
                pass
            self.openai_ws = None
        logger.info("Voice bridge cleaned up")
