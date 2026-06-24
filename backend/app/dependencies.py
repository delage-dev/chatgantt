from __future__ import annotations

from fastapi import Header

from app import settings
from app.adapters.base import TicketProviderAdapter
from app.adapters.registry import get_adapter
from app.models.tickets import ConnectionConfig, UserContext, UserRole


async def get_connection_config() -> ConnectionConfig:
    """Build the ConnectionConfig from server-side env (single-tenant).

    When ``NOTION_TOKEN`` is set, serve the configured Notion workspace:
    ``project_key`` is the tasks data-source ID and (optionally)
    ``extra["blockers_source"]`` the blockers data-source ID. When unset,
    fall back to the mock adapter so dev still works with no credentials.

    The frontend no longer supplies provider/project/token headers.
    """
    token = settings.notion_token()
    if not token:
        return ConnectionConfig(
            provider="mock",
            access_token="",
            base_url="",
            project_key="DEMO",
            extra={},
        )

    blockers_source = settings.notion_blockers_data_source()
    extra = {"blockers_source": blockers_source} if blockers_source else {}

    return ConnectionConfig(
        provider="notion",
        access_token=token,
        base_url="",
        project_key=settings.notion_tasks_data_source() or "",
        extra=extra,
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
