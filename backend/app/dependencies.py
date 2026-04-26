from __future__ import annotations

from typing import Tuple

from fastapi import Header, Query

from app.adapters.base import TicketProviderAdapter
from app.adapters.registry import get_adapter
from app.models.tickets import ConnectionConfig, UserContext, UserRole


async def get_connection_config(
    x_provider: str = Header(default="mock"),
    x_project: str = Header(default="DEMO"),
    x_base_url: str = Header(default=""),
    authorization: str = Header(default=""),
) -> ConnectionConfig:
    """Extract ConnectionConfig from request headers.

    In production, the provider/project come from the chat platform's channel
    config and the access token from secure storage. For dev, defaults to the
    mock adapter with no auth required.
    """
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""

    return ConnectionConfig(
        provider=x_provider,
        access_token=token,
        base_url=x_base_url,
        project_key=x_project,
    )


async def get_user_context(
    x_user_id: str = Header(default="anonymous"),
    x_user_name: str = Header(default="Anonymous"),
    x_user_role: str = Header(default="editor"),
) -> UserContext:
    """Extract user identity from request headers.

    All headers are optional — defaults produce an anonymous editor,
    preserving full access when no identity is supplied.
    """
    try:
        role = UserRole(x_user_role)
    except ValueError:
        role = UserRole.EDITOR

    return UserContext(user_id=x_user_id, display_name=x_user_name, role=role)


async def get_adapter_dep(
    config: ConnectionConfig = None,
    x_provider: str = Header(default="mock"),
) -> TicketProviderAdapter:
    """Resolve the adapter for the current request's provider."""
    return get_adapter(x_provider)
