"""Input sanitization middleware.

Validates and cleans incoming request bodies to ensure only safe inputs reach
route handlers. Designed to be permissive for legitimate content (markdown,
code blocks, URLs) while rejecting injection vectors and resource exhaustion
attempts.

What it does:
- Enforces request body size limit (10MB default)
- For JSON bodies: recursively walks strings and rejects null bytes, strips
  C0 control characters (except tab/newline/CR), enforces per-string length
  limits
- Validates custom X-* headers for control characters
- Exempts WebSocket connections and Twilio form-encoded webhooks (these are
  validated by their own handlers / Twilio's signed requests)

What it intentionally does NOT do:
- Strip HTML/script tags from strings — markdown rendering is handled safely
  by ReactMarkdown on the frontend, which escapes raw HTML by default
- Modify URL paths or query parameters — these are typed by FastAPI and
  validated by route handlers

Implementation note:
This is a raw ASGI middleware (not BaseHTTPMiddleware) because we need to
modify the request body before it reaches the route handler. BaseHTTPMiddleware
doesn't propagate body modifications through call_next.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)

MAX_BODY_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_STRING_LENGTH = 100_000  # 100 KB per string field

_STRIPPED_CONTROL = {
    chr(c) for c in range(0x00, 0x20) if chr(c) not in ("\t", "\n", "\r")
} | {"\x7f"}

_REJECTED_CHARS = {"\x00"}

_EXEMPT_PATHS = {
    "/api/voice/incoming",
    "/api/voice/pin-verify",
    "/api/voice/stream",
}


class SanitizationError(Exception):
    """Raised when input contains content that cannot be sanitized."""


def _sanitize_string(value: str, *, path: str = "") -> str:
    if "\x00" in value:
        raise SanitizationError(f"Null byte not allowed in '{path}'")

    if len(value) > MAX_STRING_LENGTH:
        raise SanitizationError(
            f"Field '{path}' exceeds max length of {MAX_STRING_LENGTH} characters"
        )

    if any(ch in value for ch in _STRIPPED_CONTROL):
        return "".join(ch for ch in value if ch not in _STRIPPED_CONTROL)

    return value


def _sanitize_value(value: Any, *, path: str = "") -> Any:
    if isinstance(value, str):
        return _sanitize_string(value, path=path)
    if isinstance(value, dict):
        return {
            k: _sanitize_value(v, path=f"{path}.{k}" if path else k)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [
            _sanitize_value(v, path=f"{path}[{i}]")
            for i, v in enumerate(value)
        ]
    return value


def _has_invalid_header_chars(value: str) -> bool:
    return any(ch in value for ch in _REJECTED_CHARS) or any(
        ch in value for ch in _STRIPPED_CONTROL
    )


async def _send_json_error(send: Send, status_code: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status_code,
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
    })
    await send({
        "type": "http.response.body",
        "body": body,
        "more_body": False,
    })


class SanitizationMiddleware:
    """Raw ASGI middleware that sanitizes JSON request bodies."""

    def __init__(self, app: ASGIApp, max_body_size: int = MAX_BODY_SIZE_BYTES) -> None:
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Header validation — check custom X-* headers for control chars
        for name_bytes, value_bytes in scope.get("headers", []):
            name = name_bytes.decode("latin-1").lower()
            if not name.startswith("x-"):
                continue
            try:
                value = value_bytes.decode("latin-1")
            except UnicodeDecodeError:
                await _send_json_error(send, 400, f"Invalid characters in header '{name}'")
                return
            if _has_invalid_header_chars(value):
                await _send_json_error(send, 400, f"Invalid characters in header '{name}'")
                return

        # Content-Length pre-check
        for name_bytes, value_bytes in scope.get("headers", []):
            if name_bytes.lower() == b"content-length":
                try:
                    length = int(value_bytes)
                except ValueError:
                    continue
                if length > self.max_body_size:
                    await _send_json_error(send, 413, "Request body too large")
                    return
                break

        path = scope.get("path", "")

        # Skip body sanitization for exempt paths
        if path in _EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        # Determine content type
        content_type = b""
        for name_bytes, value_bytes in scope.get("headers", []):
            if name_bytes.lower() == b"content-type":
                content_type = value_bytes.lower()
                break

        if not content_type.startswith(b"application/json"):
            await self.app(scope, receive, send)
            return

        # Read full body
        body_chunks: list[bytes] = []
        more_body = True
        total_size = 0
        while more_body:
            message = await receive()
            if message["type"] != "http.request":
                # Disconnect or other event — pass through
                await self.app(scope, receive, send)
                return
            chunk = message.get("body", b"")
            total_size += len(chunk)
            if total_size > self.max_body_size:
                await _send_json_error(send, 413, "Request body too large")
                return
            body_chunks.append(chunk)
            more_body = message.get("more_body", False)

        body = b"".join(body_chunks)

        # Sanitize JSON body
        sanitized_body = body
        if body:
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                # Invalid JSON — let the route handler return its own 422
                sanitized_body = body
            else:
                try:
                    sanitized = _sanitize_value(data)
                except SanitizationError as e:
                    await _send_json_error(send, 400, str(e))
                    return
                sanitized_body = json.dumps(sanitized).encode("utf-8")

        # Build a new receive callable that yields the sanitized body
        body_sent = False

        async def wrapped_receive() -> Message:
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {
                    "type": "http.request",
                    "body": sanitized_body,
                    "more_body": False,
                }
            return {"type": "http.disconnect"}

        await self.app(scope, wrapped_receive, send)
