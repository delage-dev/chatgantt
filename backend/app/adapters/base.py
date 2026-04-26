from __future__ import annotations

from typing import List, Optional, Tuple, runtime_checkable

from typing_extensions import Protocol

from app.models.blockers import Blocker, BlockerCreate, BlockerStatus
from app.models.tickets import Comment, ConnectionConfig, Ticket, TicketTree, TicketUpdate


@runtime_checkable
class TicketProviderAdapter(Protocol):
    """Contract all ticket provider adapters must satisfy.

    Adapters are stateless — ConnectionConfig is passed per call so a single
    adapter instance can serve multiple projects/channels.
    """

    async def get_project_tree(self, config: ConnectionConfig) -> TicketTree:
        """Return the full epic -> story -> task tree for a project."""
        ...

    async def get_ticket(self, config: ConnectionConfig, ticket_id: str) -> Ticket:
        """Fetch a single ticket's current state."""
        ...

    async def update_ticket(
        self, config: ConnectionConfig, ticket_id: str, updates: TicketUpdate
    ) -> Ticket:
        """Apply field updates to a single ticket. Returns the updated ticket."""
        ...

    async def batch_update_tickets(
        self, config: ConnectionConfig, updates: List[Tuple[str, TicketUpdate]]
    ) -> List[str]:
        """Update multiple tickets. Returns list of failed ticket IDs."""
        ...

    async def get_ticket_comments(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Comment]:
        """Fetch comments for a ticket."""
        ...

    async def create_comment(
        self, config: ConnectionConfig, ticket_id: str, content: str, author_id: str
    ) -> Comment:
        """Post a new comment on a ticket. Returns the created comment."""
        ...

    async def list_blockers(
        self, config: ConnectionConfig, status: Optional[BlockerStatus] = None
    ) -> List[Blocker]:
        """Fetch all blockers, optionally filtered by status."""
        ...

    async def get_task_blockers(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Blocker]:
        """Fetch blockers where this ticket is either the blocked or blocking side."""
        ...

    async def create_blocker(
        self, config: ConnectionConfig, blocker_data: BlockerCreate, author_id: str
    ) -> Blocker:
        """Create a new blocker. Validates referenced ticket IDs exist."""
        ...

    async def resolve_blocker(
        self, config: ConnectionConfig, blocker_id: str, resolved_by: str
    ) -> Blocker:
        """Mark a blocker as resolved."""
        ...

    async def delete_blocker(self, config: ConnectionConfig, blocker_id: str) -> None:
        """Delete a blocker."""
        ...

    async def auto_resolve_blockers_for(
        self, config: ConnectionConfig, ticket_id: str, resolved_by: str = "system"
    ) -> List[str]:
        """Auto-resolve all active blockers where this ticket is the blocking side.

        Called when a task transitions to Done. Returns the IDs of resolved blockers.
        """
        ...

    async def test_connection(self, config: ConnectionConfig) -> bool:
        """Verify that credentials and project config are valid."""
        ...
