from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.adapters.exceptions import AdapterError
from app.dependencies import get_connection_config, get_user_context
from app.models.blockers import Blocker, BlockerCreate, BlockerStatus
from app.models.tickets import ConnectionConfig, UserContext
from app.routers.tasks import _handle_adapter_error, _require_editor, _resolve_adapter

router = APIRouter()


@router.get("/blockers", response_model=List[Blocker])
async def list_blockers(
    status: Optional[BlockerStatus] = Query(default=None),
    blocked_task_id: Optional[str] = Query(default=None),
    blocking_task_id: Optional[str] = Query(default=None),
    config: ConnectionConfig = Depends(get_connection_config),
):
    adapter = _resolve_adapter(config)
    try:
        blockers = await adapter.list_blockers(config, status=status)
    except AdapterError as e:
        _handle_adapter_error(e)

    if blocked_task_id:
        blockers = [b for b in blockers if b.blocked_task_id == blocked_task_id]
    if blocking_task_id:
        blockers = [b for b in blockers if b.blocking_task_id == blocking_task_id]
    return blockers


@router.post("/blockers", response_model=Blocker)
async def create_blocker(
    body: BlockerCreate,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    _require_editor(user)
    adapter = _resolve_adapter(config)
    try:
        return await adapter.create_blocker(config, body, user.user_id)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.post("/blockers/{blocker_id}/resolve", response_model=Blocker)
async def resolve_blocker(
    blocker_id: str,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    _require_editor(user)
    adapter = _resolve_adapter(config)
    try:
        return await adapter.resolve_blocker(config, blocker_id, user.user_id)
    except AdapterError as e:
        _handle_adapter_error(e)


@router.delete("/blockers/{blocker_id}")
async def delete_blocker(
    blocker_id: str,
    config: ConnectionConfig = Depends(get_connection_config),
    user: UserContext = Depends(get_user_context),
):
    _require_editor(user)
    adapter = _resolve_adapter(config)
    try:
        await adapter.delete_blocker(config, blocker_id)
    except AdapterError as e:
        _handle_adapter_error(e)
    return Response(status_code=204)
