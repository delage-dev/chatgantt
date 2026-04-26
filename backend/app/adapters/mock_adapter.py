from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Tuple
from uuid import uuid4

from typing import Optional

from app.adapters.exceptions import BlockerNotFoundError, TicketNotFoundError
from app.models.blockers import Blocker, BlockerCreate, BlockerSeverity, BlockerStatus
from app.models.tickets import (
    Assignee,
    Comment,
    ConnectionConfig,
    Ticket,
    TicketTree,
    TicketType,
    TicketUpdate,
)

# Mock users
_USERS = {
    "user-1": Assignee(id="user-1", display_name="Alice Chen", avatar_url=None),
    "user-2": Assignee(id="user-2", display_name="Bob Martinez", avatar_url=None),
    "user-3": Assignee(id="user-3", display_name="Carol Johnson", avatar_url=None),
    "user-4": Assignee(id="user-4", display_name="David Kim", avatar_url=None),
}


def _build_mock_tickets() -> List[Ticket]:
    """Build a realistic project with 2 epics, stories, and tasks."""
    today = date.today()

    return [
        # ── Epic 1: User Authentication ──
        Ticket(
            id="DEMO-1",
            parent_id=None,
            ticket_type=TicketType.EPIC,
            summary="User Authentication",
            description="# User Authentication\n\nImplement a complete authentication system supporting **OAuth 2.0** providers with secure session management and role-based access control.\n\n## Goals\n- Single sign-on via OAuth providers\n- Secure token storage and refresh\n- RBAC with admin/user/viewer roles\n\n## Acceptance Criteria\n1. Users can log in via Google or GitHub\n2. Sessions persist across browser refreshes\n3. Admin panel accessible only to admin role",
            assignee=_USERS["user-1"],
            start_date=today,
            end_date=today + timedelta(days=28),
            status="In Progress",
            sort_order=0,
            provider_meta={
                "project_name": "Authentication Platform",
                "resource_urls": ["mock://auth-architecture", "mock://api-standards"],
                "priority_context": {
                    "rationale": "Authentication is a **hard blocker** for the public beta launch. No other feature can go live without user login working end-to-end.",
                    "stakeholder_goals": ["Launch public beta by end of Q2", "Support enterprise SSO for pilot customers"],
                    "linked_objectives": ["Q2 OKR: Public beta with 500 users"],
                },
            },
        ),
        # Stories under Epic 1
        Ticket(
            id="DEMO-2",
            parent_id="DEMO-1",
            ticket_type=TicketType.STORY,
            summary="OAuth 2.0 login flow",
            description="Implement the full OAuth 2.0 authorization code flow for **Google** and **GitHub** providers.\n\nThis story covers the end-to-end login experience from the user clicking \"Sign in\" to receiving a valid session token.",
            assignee=_USERS["user-1"],
            start_date=today,
            end_date=today + timedelta(days=10),
            status="In Progress",
            sort_order=0,
        ),
        Ticket(
            id="DEMO-3",
            parent_id="DEMO-1",
            ticket_type=TicketType.STORY,
            summary="Session management",
            assignee=_USERS["user-2"],
            start_date=today + timedelta(days=8),
            end_date=today + timedelta(days=18),
            status="To Do",
            sort_order=1,
        ),
        Ticket(
            id="DEMO-4",
            parent_id="DEMO-1",
            ticket_type=TicketType.STORY,
            summary="Role-based access control",
            assignee=_USERS["user-3"],
            start_date=today + timedelta(days=16),
            end_date=today + timedelta(days=28),
            status="To Do",
            sort_order=2,
        ),
        # Tasks under Story DEMO-2
        Ticket(
            id="DEMO-5",
            parent_id="DEMO-2",
            ticket_type=TicketType.TASK,
            summary="Set up OAuth provider config",
            description="Configure OAuth client credentials for Google and GitHub providers.\n\n**Steps:**\n1. Register apps in provider dashboards\n2. Store client IDs/secrets in env config\n3. Add redirect URI validation\n\n> Note: Use PKCE flow for public clients.",
            assignee=_USERS["user-1"],
            start_date=today,
            end_date=today + timedelta(days=3),
            status="Done",
            sort_order=0,
            provider_meta={"tags": ["backend", "api"]},
        ),
        Ticket(
            id="DEMO-6",
            parent_id="DEMO-2",
            ticket_type=TicketType.TASK,
            summary="Implement token exchange endpoint",
            description="Build the `/auth/callback` endpoint that:\n- Receives the authorization code\n- Exchanges it for access + refresh tokens\n- Creates or updates the user record\n- Sets a secure HTTP-only session cookie\n\nSee [RFC 6749](https://tools.ietf.org/html/rfc6749) for reference.",
            assignee=_USERS["user-1"],
            start_date=today + timedelta(days=3),
            end_date=today + timedelta(days=7),
            status="In Progress",
            dependencies=["DEMO-5"],
            qa_start_date=today + timedelta(days=8),
            qa_end_date=today + timedelta(days=10),
            sort_order=1,
            provider_meta={"tags": ["backend", "api"]},
        ),
        Ticket(
            id="DEMO-7",
            parent_id="DEMO-2",
            ticket_type=TicketType.TASK,
            summary="Add login UI components",
            assignee=_USERS["user-4"],
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=10),
            status="To Do",
            dependencies=["DEMO-6"],
            qa_start_date=today + timedelta(days=11),
            qa_end_date=today + timedelta(days=13),
            sort_order=2,
            provider_meta={
                "tags": ["frontend", "ui"],
                "design_links": [
                    {"url": "https://www.figma.com/design/example/login-flow", "title": "Login Flow Mockup", "type": "figma"},
                ],
                "acceptance_criteria": [
                    {"id": "ac-1", "text": "Login form matches Figma mockup pixel-perfect", "completed": False},
                    {"id": "ac-2", "text": "OAuth buttons for Google and GitHub positioned per spec", "completed": False},
                    {"id": "ac-3", "text": "Mobile responsive down to 375px width", "completed": False},
                ],
                "priority_context": {
                    "rationale": "Login UI is the first user touchpoint. Poor UX here directly impacts signup conversion.",
                    "stakeholder_goals": ["Increase signup conversion by 15%"],
                    "linked_objectives": [],
                },
            },
        ),
        # Tasks under Story DEMO-3
        Ticket(
            id="DEMO-8",
            parent_id="DEMO-3",
            ticket_type=TicketType.TASK,
            summary="Design session storage strategy",
            assignee=_USERS["user-2"],
            start_date=today + timedelta(days=8),
            end_date=today + timedelta(days=11),
            status="To Do",
            sort_order=0,
            provider_meta={"tags": ["backend"]},
        ),
        Ticket(
            id="DEMO-9",
            parent_id="DEMO-3",
            ticket_type=TicketType.TASK,
            summary="Implement session middleware",
            assignee=_USERS["user-2"],
            start_date=today + timedelta(days=11),
            end_date=today + timedelta(days=18),
            status="To Do",
            dependencies=["DEMO-8"],
            sort_order=1,
            provider_meta={"tags": ["backend"]},
        ),
        # ── Epic 2: Dashboard ──
        Ticket(
            id="DEMO-10",
            parent_id=None,
            ticket_type=TicketType.EPIC,
            summary="Dashboard & Reporting",
            description="# Dashboard & Reporting\n\nDesign and build a comprehensive dashboard with **real-time analytics** and export capabilities.\n\n## Key Deliverables\n- Responsive grid layout with draggable widgets\n- Charts: bar, line, pie using `recharts`\n- PDF export via server-side rendering\n\n## Tech Notes\n- Use `react-grid-layout` for the widget grid\n- Chart data fetched via `/api/analytics` endpoints",
            assignee=_USERS["user-3"],
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=35),
            status="To Do",
            sort_order=1,
            provider_meta={"project_name": "Analytics Suite", "resource_urls": ["mock://dashboard-requirements", "mock://sprint-retro"]},
        ),
        # Stories under Epic 2
        Ticket(
            id="DEMO-11",
            parent_id="DEMO-10",
            ticket_type=TicketType.STORY,
            summary="Dashboard layout and navigation",
            assignee=_USERS["user-4"],
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=15),
            status="To Do",
            sort_order=0,
        ),
        Ticket(
            id="DEMO-12",
            parent_id="DEMO-10",
            ticket_type=TicketType.STORY,
            summary="Analytics charts and widgets",
            assignee=_USERS["user-3"],
            start_date=today + timedelta(days=14),
            end_date=today + timedelta(days=25),
            status="To Do",
            sort_order=1,
        ),
        Ticket(
            id="DEMO-13",
            parent_id="DEMO-10",
            ticket_type=TicketType.STORY,
            summary="Export reports to PDF",
            assignee=_USERS["user-2"],
            start_date=today + timedelta(days=24),
            end_date=today + timedelta(days=35),
            status="To Do",
            sort_order=2,
        ),
        # Tasks under Story DEMO-11
        Ticket(
            id="DEMO-14",
            parent_id="DEMO-11",
            ticket_type=TicketType.TASK,
            summary="Create sidebar navigation component",
            assignee=_USERS["user-4"],
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=9),
            status="To Do",
            sort_order=0,
            provider_meta={"tags": ["frontend", "ui"]},
        ),
        Ticket(
            id="DEMO-15",
            parent_id="DEMO-11",
            ticket_type=TicketType.TASK,
            summary="Build dashboard grid layout",
            assignee=_USERS["user-4"],
            start_date=today + timedelta(days=9),
            end_date=today + timedelta(days=15),
            status="To Do",
            dependencies=["DEMO-14"],
            qa_start_date=today + timedelta(days=16),
            qa_end_date=today + timedelta(days=18),
            sort_order=1,
            provider_meta={
                "tags": ["frontend", "ui"],
                "design_links": [
                    {"url": "https://miro.com/app/board/example-dashboard", "title": "Dashboard Widget Layout", "type": "miro"},
                ],
                "acceptance_criteria": [
                    {"id": "ac-4", "text": "Grid supports drag-and-drop widget rearrangement", "completed": False},
                    {"id": "ac-5", "text": "Grid layout persists across page reloads", "completed": False},
                    {"id": "ac-6", "text": "Minimum 3 widget sizes: small, medium, large", "completed": False},
                    {"id": "ac-7", "text": "Grid is responsive on tablet (768px+)", "completed": True},
                ],
            },
        ),
    ]


class MockAdapter:
    """In-memory adapter for development and testing.

    Stores tickets in a dict so updates persist for the lifetime of the process.
    """

    def __init__(self) -> None:
        self._tickets: Dict[str, Ticket] = {
            t.id: t for t in _build_mock_tickets()
        }

    async def get_project_tree(self, config: ConnectionConfig) -> TicketTree:
        return TicketTree(
            project_key=config.project_key,
            tickets=list(self._tickets.values()),
        )

    async def get_ticket(self, config: ConnectionConfig, ticket_id: str) -> Ticket:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            raise TicketNotFoundError(ticket_id, provider="mock")
        return ticket

    async def update_ticket(
        self, config: ConnectionConfig, ticket_id: str, updates: TicketUpdate
    ) -> Ticket:
        ticket = self._tickets.get(ticket_id)
        if not ticket:
            raise TicketNotFoundError(ticket_id, provider="mock")

        update_data = updates.model_dump(exclude_none=True)
        # Handle clear_qa flag — explicitly null out QA dates
        if updates.clear_qa:
            update_data["qa_start_date"] = None
            update_data["qa_end_date"] = None
        update_data.pop("clear_qa", None)
        # Deep-merge provider_meta so updating one key doesn't clobber others
        if "provider_meta" in update_data and update_data["provider_meta"] is not None:
            existing_meta = dict(ticket.provider_meta or {})
            existing_meta.update(update_data["provider_meta"])
            update_data["provider_meta"] = existing_meta
        updated = ticket.model_copy(update=update_data)
        self._tickets[ticket_id] = updated
        return updated

    async def batch_update_tickets(
        self, config: ConnectionConfig, updates: List[Tuple[str, TicketUpdate]]
    ) -> List[str]:
        failed = []
        for ticket_id, update in updates:
            try:
                await self.update_ticket(config, ticket_id, update)
            except TicketNotFoundError:
                failed.append(ticket_id)
        return failed

    async def get_ticket_comments(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Comment]:
        if ticket_id not in self._tickets:
            raise TicketNotFoundError(ticket_id, provider="mock")
        return _MOCK_COMMENTS.get(ticket_id, [])

    async def create_comment(
        self, config: ConnectionConfig, ticket_id: str, content: str, author_id: str
    ) -> Comment:
        if ticket_id not in self._tickets:
            raise TicketNotFoundError(ticket_id, provider="mock")

        author = _USERS.get(author_id, Assignee(id=author_id, display_name=author_id, avatar_url=None))
        comment = Comment(
            id=str(uuid4()),
            author=author,
            content=content,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        _MOCK_COMMENTS.setdefault(ticket_id, []).append(comment)
        return comment

    # ─── Blockers ─────────────────────────────────────────────────────────

    async def list_blockers(
        self, config: ConnectionConfig, status: Optional[BlockerStatus] = None
    ) -> List[Blocker]:
        blockers = list(_BLOCKERS.values())
        if status is not None:
            blockers = [b for b in blockers if b.status == status]
        return blockers

    async def get_task_blockers(
        self, config: ConnectionConfig, ticket_id: str
    ) -> List[Blocker]:
        return [
            b for b in _BLOCKERS.values()
            if b.blocked_task_id == ticket_id or b.blocking_task_id == ticket_id
        ]

    async def create_blocker(
        self, config: ConnectionConfig, blocker_data: BlockerCreate, author_id: str
    ) -> Blocker:
        if blocker_data.blocked_task_id not in self._tickets:
            raise TicketNotFoundError(blocker_data.blocked_task_id, provider="mock")
        if blocker_data.blocking_task_id and blocker_data.blocking_task_id not in self._tickets:
            raise TicketNotFoundError(blocker_data.blocking_task_id, provider="mock")

        blocker = Blocker(
            id=str(uuid4()),
            blocked_task_id=blocker_data.blocked_task_id,
            blocking_task_id=blocker_data.blocking_task_id,
            external_blocker=blocker_data.external_blocker,
            reason=blocker_data.reason,
            severity=blocker_data.severity,
            status=BlockerStatus.ACTIVE,
            created_by=author_id,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        _BLOCKERS[blocker.id] = blocker
        return blocker

    async def resolve_blocker(
        self, config: ConnectionConfig, blocker_id: str, resolved_by: str
    ) -> Blocker:
        blocker = _BLOCKERS.get(blocker_id)
        if not blocker:
            raise BlockerNotFoundError(blocker_id, provider="mock")
        updated = blocker.model_copy(update={
            "status": BlockerStatus.RESOLVED,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": resolved_by,
        })
        _BLOCKERS[blocker_id] = updated
        return updated

    async def delete_blocker(self, config: ConnectionConfig, blocker_id: str) -> None:
        if blocker_id not in _BLOCKERS:
            raise BlockerNotFoundError(blocker_id, provider="mock")
        _BLOCKERS.pop(blocker_id, None)

    async def auto_resolve_blockers_for(
        self, config: ConnectionConfig, ticket_id: str, resolved_by: str = "system"
    ) -> List[str]:
        resolved_ids: List[str] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        for bid, blocker in list(_BLOCKERS.items()):
            if (
                blocker.blocking_task_id == ticket_id
                and blocker.status == BlockerStatus.ACTIVE
            ):
                _BLOCKERS[bid] = blocker.model_copy(update={
                    "status": BlockerStatus.RESOLVED,
                    "resolved_at": now_iso,
                    "resolved_by": resolved_by,
                    "auto_resolved": True,
                })
                resolved_ids.append(bid)
        return resolved_ids

    async def test_connection(self, config: ConnectionConfig) -> bool:
        return True


# ─── Mock Comments ────────────────────────────────────────────────────────────

_MOCK_COMMENTS: Dict[str, List[Comment]] = {
    "DEMO-5": [
        Comment(
            id="c1",
            author=_USERS["user-1"],
            content="OAuth client registered for Google and GitHub. Client IDs stored in vault.",
            created_at="2026-03-31T10:30:00Z",
        ),
        Comment(
            id="c2",
            author=_USERS["user-2"],
            content="Should we also add Microsoft as a provider? The enterprise team has been asking.",
            created_at="2026-03-31T14:15:00Z",
        ),
    ],
    "DEMO-6": [
        Comment(
            id="c3",
            author=_USERS["user-1"],
            content="Token exchange is working but refresh flow needs more testing. Edge case when token expires mid-request.",
            created_at="2026-04-01T09:00:00Z",
        ),
        Comment(
            id="c4",
            author=_USERS["user-3"],
            content="Make sure we're using PKCE — the security audit flagged this.",
            created_at="2026-04-01T11:20:00Z",
        ),
        Comment(
            id="c5",
            author=_USERS["user-1"],
            content="Good call, PKCE is implemented. Will add test coverage for the code verifier generation.",
            created_at="2026-04-01T11:45:00Z",
        ),
    ],
    "DEMO-7": [
        Comment(
            id="c6",
            author=_USERS["user-4"],
            content="Waiting on DEMO-6 to finish so I can wire up the login button to the real auth endpoint.",
            created_at="2026-04-02T08:30:00Z",
        ),
    ],
    "DEMO-14": [
        Comment(
            id="c7",
            author=_USERS["user-4"],
            content="Using a collapsible sidebar pattern from the design system. Should we support keyboard nav (arrow keys)?",
            created_at="2026-04-02T10:00:00Z",
        ),
        Comment(
            id="c8",
            author=_USERS["user-3"],
            content="Keyboard nav is a nice-to-have. Let's ship without it and add in a follow-up.",
            created_at="2026-04-02T10:30:00Z",
        ),
    ],
}


# ─── Mock Blockers ────────────────────────────────────────────────────────────

_BLOCKERS: Dict[str, Blocker] = {
    "blk-1": Blocker(
        id="blk-1",
        blocked_task_id="DEMO-7",
        blocking_task_id="DEMO-6",
        external_blocker=None,
        reason="Backend `/auth/callback` endpoint not ready yet — can't wire up the login button to the real flow.",
        severity=BlockerSeverity.MEDIUM,
        status=BlockerStatus.ACTIVE,
        created_by="user-4",
        created_at="2026-04-12T09:00:00Z",
    ),
    "blk-2": Blocker(
        id="blk-2",
        blocked_task_id="DEMO-15",
        blocking_task_id=None,
        external_blocker="Design system v2 release",
        reason="Waiting on design system v2 release with the new grid tokens before we can finalize widget sizing.",
        severity=BlockerSeverity.HIGH,
        status=BlockerStatus.ACTIVE,
        created_by="user-4",
        created_at="2026-04-10T14:30:00Z",
    ),
}
