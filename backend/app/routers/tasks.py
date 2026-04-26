from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.adapters.base import TicketProviderAdapter
from app.adapters.exceptions import (
    AdapterError,
    AuthenticationError,
    RateLimitError,
    TicketNotFoundError,
)
from app.adapters.registry import get_adapter
from app.dependencies import get_connection_config, get_user_context
from app.models.blockers import Blocker
from app.models.tickets import (
    BatchResult,
    BatchUpdateItem,
    Comment,
    CommentCreate,
    ConnectionConfig,
    Ticket,
    TicketTree,
    TicketUpdate,
    TicketUpdateResponse,
    UserContext,
    UserRole,
)

router = APIRouter()


def _resolve_adapter(config: ConnectionConfig) -> TicketProviderAdapter:
    try:
        return get_adapter(config.provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _require_editor(user: UserContext) -> None:
    if user.role == UserRole.VIEWER:
        raise HTTPException(status_code=403, detail="Viewer role cannot modify tasks")


def _handle_adapter_error(e: AdapterError) -> None:
    from app.adapters.exceptions import BlockerNotFoundError
    if isinstance(e, AuthenticationError):
        raise HTTPException(status_code=401, detail=str(e))
    if isinstance(e, TicketNotFoundError):
        raise HTTPException(status_code=404, detail=str(e))
    if isinstance(e, BlockerNotFoundError):
        raise HTTPException(status_code=404, detail=str(e))
    if isinstance(e, RateLimitError):
        headers = {}
        if e.retry_after:
            headers["Retry-After"] = str(e.retry_after)
        raise HTTPException(status_code=429, detail=str(e), headers=headers)
    raise HTTPException(status_code=502, detail=str(e))


async def _maybe_auto_resolve(adapter, config, ticket: Ticket) -> List[str]:
    """If ticket status is Done, auto-resolve any blockers it was blocking."""
    if (ticket.status or "").lower() == "done":
        try:
            return await adapter.auto_resolve_blockers_for(config, ticket.id, "system")
        except Exception:
            return []
    return []


@router.get("/me", response_model=UserContext)
async def get_current_user(user: UserContext = Depends(get_user_context)):
    return user


@router.get("/tasks", response_model=TicketTree)
async def get_tasks(config: ConnectionConfig = Depends(get_connection_config)):
    adapter = _resolve_adapter(config)
    try:
        return await adapter.get_project_tree(config)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.get("/tasks/{ticket_id}", response_model=Ticket)
async def get_ticket(
    ticket_id: str,
    config: ConnectionConfig = Depends(get_connection_config),
):
    adapter = _resolve_adapter(config)
    try:
        return await adapter.get_ticket(config, ticket_id)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.patch("/tasks/{ticket_id}", response_model=TicketUpdateResponse)
async def update_ticket(
    ticket_id: str,
    updates: TicketUpdate,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    _require_editor(user)
    adapter = _resolve_adapter(config)
    try:
        ticket = await adapter.update_ticket(config, ticket_id, updates)
    except AdapterError as e:
        _handle_adapter_error(e)

    auto_resolved = await _maybe_auto_resolve(adapter, config, ticket)
    return TicketUpdateResponse(ticket=ticket, auto_resolved_blockers=auto_resolved)


@router.post("/tasks/batch", response_model=BatchResult)
async def batch_update_tickets(
    items: List[BatchUpdateItem],
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    _require_editor(user)
    adapter = _resolve_adapter(config)
    updates = [(item.ticket_id, item.updates) for item in items]
    try:
        failed = await adapter.batch_update_tickets(config, updates)
    except AdapterError as e:
        _handle_adapter_error(e)

    succeeded = [item.ticket_id for item in items if item.ticket_id not in failed]

    # Run auto-resolve for each successfully-updated ticket
    auto_resolved_all: List[str] = []
    for tid in succeeded:
        try:
            ticket = await adapter.get_ticket(config, tid)
            ids = await _maybe_auto_resolve(adapter, config, ticket)
            auto_resolved_all.extend(ids)
        except Exception:
            continue

    return BatchResult(
        succeeded=succeeded,
        failed=failed,
        auto_resolved_blockers=auto_resolved_all,
    )


@router.get("/tasks/{ticket_id}/comments", response_model=List[Comment])
async def get_ticket_comments(
    ticket_id: str,
    config: ConnectionConfig = Depends(get_connection_config),
):
    adapter = _resolve_adapter(config)
    try:
        return await adapter.get_ticket_comments(config, ticket_id)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.post("/tasks/{ticket_id}/comments", response_model=Comment)
async def post_comment(
    ticket_id: str,
    body: CommentCreate,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    adapter = _resolve_adapter(config)
    try:
        return await adapter.create_comment(config, ticket_id, body.content, user.user_id)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.get("/tasks/{ticket_id}/blockers", response_model=List[Blocker])
async def get_task_blockers(
    ticket_id: str,
    config: ConnectionConfig = Depends(get_connection_config),
):
    adapter = _resolve_adapter(config)
    try:
        return await adapter.get_task_blockers(config, ticket_id)
    except AdapterError as e:
        _handle_adapter_error(e)
