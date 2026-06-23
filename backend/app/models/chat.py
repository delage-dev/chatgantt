from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


# ─── Tool calling protocol ────────────────────────────────────────────────────


class ToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: Dict[str, Any]


class ToolResult(BaseModel):
    tool_call_id: str
    content: str
    is_error: bool = False


class ChatTurnResult(BaseModel):
    text: Optional[str] = None
    tool_calls: List[ToolCall] = []
    stop_reason: str  # "end_turn" | "tool_use" | "max_tokens" | etc.


class ToolCallExecution(BaseModel):
    name: str
    arguments: Dict[str, Any]
    result: str
    succeeded: bool


class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    # When the assistant emits tool calls, they're attached here
    tool_calls: Optional[List[ToolCall]] = None
    # When the user (router) responds with tool results, attached here
    tool_results: Optional[List[ToolResult]] = None


class ChatProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class TaskSummary(BaseModel):
    id: str
    summary: str
    type: str
    status: str
    assignee: Optional[str] = None
    parent_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    provider_meta: Optional[Dict[str, Any]] = None


class ResourceSummaryChat(BaseModel):
    title: str
    source_url: str
    content: str


class BlockerSummary(BaseModel):
    id: str
    blocked_task_id: str
    blocking_task_id: Optional[str] = None
    external_blocker: Optional[str] = None
    reason: str
    severity: str
    status: str


class TaskContext(BaseModel):
    project_key: str
    tasks: List[TaskSummary]
    resources: Optional[List[ResourceSummaryChat]] = None
    blockers: Optional[List[BlockerSummary]] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    project_context: TaskContext
    # Single-tenant: provider/key come from server env, not the browser.
    # Kept optional for backward compatibility; values are ignored.
    provider: Optional[ChatProvider] = None
    api_key: Optional[str] = None


class ChatResponse(BaseModel):
    message: ChatMessage
    tool_executions: List[ToolCallExecution] = []
