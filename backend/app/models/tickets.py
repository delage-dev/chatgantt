from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class TicketType(str, Enum):
    EPIC = "epic"
    STORY = "story"
    TASK = "task"
    SUBTASK = "subtask"


class Assignee(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None


class Ticket(BaseModel):
    id: str
    parent_id: Optional[str] = None
    ticket_type: TicketType
    summary: str
    description: Optional[str] = None
    assignee: Optional[Assignee] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    dependencies: Optional[List[str]] = None
    qa_start_date: Optional[date] = None
    qa_end_date: Optional[date] = None
    sort_order: int = 0
    provider_meta: Optional[Dict[str, Any]] = None


class TicketTree(BaseModel):
    project_key: str
    tickets: List[Ticket]


class TicketUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parent_id: Optional[str] = None
    assignee_id: Optional[str] = None
    description: Optional[str] = None
    qa_start_date: Optional[date] = None
    qa_end_date: Optional[date] = None
    dependencies: Optional[List[str]] = None
    sort_order: Optional[int] = None
    provider_meta: Optional[Dict[str, Any]] = None
    clear_qa: bool = False


class Comment(BaseModel):
    id: str
    author: Assignee
    content: str
    created_at: str


class TicketCreate(BaseModel):
    parent_id: Optional[str] = None
    ticket_type: TicketType
    summary: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BatchUpdateItem(BaseModel):
    ticket_id: str
    updates: TicketUpdate


class BatchResult(BaseModel):
    succeeded: List[str]
    failed: List[str]
    auto_resolved_blockers: List[str] = []


class TicketUpdateResponse(BaseModel):
    ticket: "Ticket"
    auto_resolved_blockers: List[str] = []


class ConnectionConfig(BaseModel):
    provider: str
    access_token: str
    base_url: str
    project_key: str
    extra: Dict[str, Any] = {}


class UserRole(str, Enum):
    VIEWER = "viewer"
    EDITOR = "editor"


class UserContext(BaseModel):
    user_id: str = "anonymous"
    display_name: str = "Anonymous"
    role: UserRole = UserRole.EDITOR


class CommentCreate(BaseModel):
    content: str
