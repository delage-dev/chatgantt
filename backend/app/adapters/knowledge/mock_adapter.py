from __future__ import annotations

from datetime import datetime
from typing import Dict

from app.models.resources import Resource
from app.models.tickets import ConnectionConfig

_MOCK_RESOURCES: Dict[str, Resource] = {
    "mock://auth-architecture": Resource(
        id="res-auth-arch",
        title="Authentication Architecture Guide",
        source_url="mock://auth-architecture",
        source_type="mock",
        content=(
            "# Authentication Architecture\n\n"
            "## Overview\n"
            "Our authentication system uses **OAuth 2.0** with PKCE flow for all client applications. "
            "The backend acts as a confidential client, exchanging authorization codes for tokens.\n\n"
            "## Token Strategy\n"
            "- **Access tokens**: Short-lived (1 hour), JWT format\n"
            "- **Refresh tokens**: Long-lived (30 days), opaque, stored server-side\n"
            "- **Session cookies**: HTTP-only, Secure, SameSite=Lax\n\n"
            "## Supported Providers\n"
            "1. Google (primary)\n"
            "2. GitHub (developer accounts)\n"
            "3. Microsoft Entra ID (enterprise SSO)\n\n"
            "## Security Requirements\n"
            "- All tokens encrypted at rest using AES-256-GCM\n"
            "- Rate limiting: 10 login attempts per minute per IP\n"
            "- CSRF protection via double-submit cookie pattern\n\n"
            "> **Note**: See [RFC 6749](https://tools.ietf.org/html/rfc6749) for the OAuth 2.0 specification."
        ),
        summary="Our authentication system uses OAuth 2.0 with PKCE flow for all client applications...",
        last_fetched=datetime.utcnow().isoformat(),
        linked_ticket_id="DEMO-1",
    ),
    "mock://api-standards": Resource(
        id="res-api-standards",
        title="API Design Standards",
        source_url="mock://api-standards",
        source_type="mock",
        content=(
            "# API Design Standards\n\n"
            "## Naming Conventions\n"
            "- Use `kebab-case` for URL paths: `/api/user-profiles`\n"
            "- Use `snake_case` for JSON fields: `{ \"first_name\": \"Alice\" }`\n"
            "- Use plural nouns for collections: `/api/tasks`, not `/api/task`\n\n"
            "## HTTP Methods\n"
            "| Method | Usage |\n"
            "|--------|-------|\n"
            "| GET | Read resources |\n"
            "| POST | Create resources |\n"
            "| PATCH | Partial updates |\n"
            "| DELETE | Remove resources |\n\n"
            "## Error Responses\n"
            "All errors return JSON with `detail` field:\n"
            "```json\n"
            '{ "detail": "Resource not found" }\n'
            "```\n\n"
            "## Pagination\n"
            "Use cursor-based pagination for large collections:\n"
            "```\n"
            "GET /api/tasks?cursor=abc123&limit=50\n"
            "```"
        ),
        summary="API design standards covering naming conventions, HTTP methods, error responses, and pagination...",
        last_fetched=datetime.utcnow().isoformat(),
    ),
    "mock://sprint-retro": Resource(
        id="res-sprint-retro",
        title="Sprint 12 Retrospective Notes",
        source_url="mock://sprint-retro",
        source_type="mock",
        content=(
            "# Sprint 12 Retrospective\n\n"
            "**Date**: March 15, 2026\n"
            "**Facilitator**: Carol Johnson\n\n"
            "## What Went Well\n"
            "- OAuth provider config (DEMO-5) shipped ahead of schedule\n"
            "- Strong cross-team collaboration on the auth epic\n"
            "- New dashboard wireframes approved by stakeholders\n\n"
            "## What Could Improve\n"
            "- Token exchange endpoint (DEMO-6) encountered scope creep\n"
            "- Need better test coverage for session edge cases\n"
            "- Design handoff for dashboard components was delayed\n\n"
            "## Action Items\n"
            "- [ ] Add integration tests for token refresh flow (@Bob)\n"
            "- [ ] Schedule design review for dashboard grid layout (@David)\n"
            "- [ ] Document session storage decisions in ADR format (@Alice)"
        ),
        summary="Sprint 12 retrospective covering wins, improvements, and action items...",
        last_fetched=datetime.utcnow().isoformat(),
    ),
    "mock://dashboard-requirements": Resource(
        id="res-dashboard-reqs",
        title="Dashboard Feature Requirements",
        source_url="mock://dashboard-requirements",
        source_type="mock",
        content=(
            "# Dashboard & Reporting Requirements\n\n"
            "## User Stories\n"
            "- As a manager, I want to see team velocity trends so I can forecast delivery dates\n"
            "- As a developer, I want quick access to my assigned tasks from the dashboard\n"
            "- As a stakeholder, I want to export weekly reports as PDF\n\n"
            "## Widget Requirements\n"
            "1. **Velocity Chart**: Bar chart showing story points completed per sprint\n"
            "2. **Burndown**: Line chart for current sprint progress\n"
            "3. **My Tasks**: Filterable list of tasks assigned to current user\n"
            "4. **Team Workload**: Heatmap showing assignment distribution\n\n"
            "## Technical Constraints\n"
            "- Dashboard must load in under 2 seconds\n"
            "- Charts rendered client-side using `recharts`\n"
            "- PDF export via headless browser (Puppeteer)\n"
            "- Widget layout saved per-user in localStorage"
        ),
        summary="Dashboard feature requirements including user stories, widget specs, and technical constraints...",
        last_fetched=datetime.utcnow().isoformat(),
        linked_ticket_id="DEMO-10",
    ),
}


class MockKnowledgeAdapter:
    """Returns hardcoded resources for development."""

    async def fetch_resource(
        self,
        url: str,
        config: ConnectionConfig,
        max_content_length: int = 4000,
    ) -> Resource:
        resource = _MOCK_RESOURCES.get(url)
        if resource is None:
            raise ValueError(f"Mock resource not found: {url}")
        return resource
