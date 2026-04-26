from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, model_validator


class BlockerSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class BlockerStatus(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"


class Blocker(BaseModel):
    id: str
    blocked_task_id: str
    blocking_task_id: Optional[str] = None
    external_blocker: Optional[str] = None
    reason: str
    severity: BlockerSeverity = BlockerSeverity.MEDIUM
    status: BlockerStatus = BlockerStatus.ACTIVE
    created_by: str
    created_at: str
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    auto_resolved: bool = False


class BlockerCreate(BaseModel):
    blocked_task_id: str
    blocking_task_id: Optional[str] = None
    external_blocker: Optional[str] = None
    reason: str
    severity: BlockerSeverity = BlockerSeverity.MEDIUM

    @model_validator(mode="after")
    def _exactly_one_source(self) -> "BlockerCreate":
        has_task = self.blocking_task_id is not None and self.blocking_task_id != ""
        has_external = self.external_blocker is not None and self.external_blocker.strip() != ""
        if has_task and has_external:
            raise ValueError("Provide either blocking_task_id or external_blocker, not both")
        if not has_task and not has_external:
            raise ValueError("Must provide either blocking_task_id or external_blocker")
        return self
