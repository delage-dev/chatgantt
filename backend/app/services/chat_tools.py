"""Tool definitions and dispatcher for chat AI tool calling.

Centralized so the same tools can be used by HTTP /chat and the voice bridge.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

from app.adapters.base import TicketProviderAdapter
from app.models.blockers import BlockerCreate, BlockerSeverity, BlockerStatus
from app.models.chat import ToolCall, ToolCallExecution, ToolDefinition
from app.models.tickets import ConnectionConfig


def get_blocker_tools() -> List[ToolDefinition]:
    """Return tool definitions for blocker management."""
    return [
        ToolDefinition(
            name="create_blocker",
            description=(
                "Create a new blocker on a task. Use this when the user describes "
                "something that's blocking progress on a task. The blocker can either "
                "reference another task in the project (blocking_task_id) OR an "
                "external thing like waiting on a person, decision, or third-party "
                "system (external_blocker). Provide exactly one of those."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "blocked_task_id": {
                        "type": "string",
                        "description": "ID of the task that is blocked (e.g. DEMO-7)",
                    },
                    "blocking_task_id": {
                        "type": "string",
                        "description": "ID of the task causing the block (e.g. DEMO-6). Omit if external.",
                    },
                    "external_blocker": {
                        "type": "string",
                        "description": "Brief description of the external blocker (e.g. 'Waiting on legal sign-off'). Omit if blocking_task_id is set.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "A clear explanation of what's blocked and why",
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "Impact severity (default: medium)",
                    },
                },
                "required": ["blocked_task_id", "reason"],
            },
        ),
        ToolDefinition(
            name="resolve_blocker",
            description="Mark a blocker as resolved. Use when the user says a blocker is no longer blocking.",
            input_schema={
                "type": "object",
                "properties": {
                    "blocker_id": {
                        "type": "string",
                        "description": "ID of the blocker to resolve",
                    },
                },
                "required": ["blocker_id"],
            },
        ),
        ToolDefinition(
            name="list_blockers",
            description=(
                "List blockers, optionally filtered by status or task. Use when the "
                "user asks about what's blocking work or wants a status report on "
                "active blockers."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["active", "resolved"],
                        "description": "Filter by status",
                    },
                    "task_id": {
                        "type": "string",
                        "description": "Only return blockers involving this task ID (either side)",
                    },
                },
            },
        ),
    ]


def _summarize_blocker(b: Any) -> str:
    target = b.blocking_task_id or b.external_blocker or "unknown"
    return f"{b.id}: {b.blocked_task_id} blocked by {target} ({b.severity}) — {b.reason[:80]}"


async def execute_tool_call(
    adapter: TicketProviderAdapter,
    config: ConnectionConfig,
    user_id: str,
    tool_call: ToolCall,
) -> ToolCallExecution:
    """Dispatch a single tool call. Returns a human-readable execution record."""
    name = tool_call.name
    args = tool_call.arguments

    try:
        if name == "create_blocker":
            payload = BlockerCreate(
                blocked_task_id=args.get("blocked_task_id", ""),
                blocking_task_id=args.get("blocking_task_id") or None,
                external_blocker=args.get("external_blocker") or None,
                reason=args.get("reason", ""),
                severity=BlockerSeverity(args.get("severity", "medium")),
            )
            blocker = await adapter.create_blocker(config, payload, user_id)
            target = blocker.blocking_task_id or blocker.external_blocker
            return ToolCallExecution(
                name=name,
                arguments=args,
                result=f"Created blocker {blocker.id}: {blocker.blocked_task_id} blocked by {target}",
                succeeded=True,
            )

        elif name == "resolve_blocker":
            blocker_id = args.get("blocker_id", "")
            blocker = await adapter.resolve_blocker(config, blocker_id, user_id)
            return ToolCallExecution(
                name=name,
                arguments=args,
                result=f"Resolved blocker {blocker.id} ({blocker.blocked_task_id})",
                succeeded=True,
            )

        elif name == "list_blockers":
            status_str = args.get("status")
            status = BlockerStatus(status_str) if status_str else None
            task_id = args.get("task_id")
            if task_id:
                blockers = await adapter.get_task_blockers(config, task_id)
                if status:
                    blockers = [b for b in blockers if b.status == status]
            else:
                blockers = await adapter.list_blockers(config, status=status)
            if not blockers:
                summary = "No matching blockers"
            else:
                summary = " | ".join(_summarize_blocker(b) for b in blockers[:10])
            return ToolCallExecution(
                name=name,
                arguments=args,
                result=f"Found {len(blockers)} blocker(s): {summary}",
                succeeded=True,
            )

        else:
            return ToolCallExecution(
                name=name,
                arguments=args,
                result=f"Unknown tool: {name}",
                succeeded=False,
            )
    except Exception as e:
        return ToolCallExecution(
            name=name,
            arguments=args,
            result=f"Error: {str(e)}",
            succeeded=False,
        )
