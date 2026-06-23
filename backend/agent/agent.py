"""ChatGantt LiveKit voice agent worker.

A telephony-free voice agent: STT (Deepgram) -> Claude -> TTS (Cartesia) over
WebRTC. Its function tools call ChatGantt's own REST API (never Notion directly)
using headers built from the caller's participant attributes, which were minted
into the LiveKit JWT by ``POST /api/voice/token``.

Run modes (see https://docs.livekit.io/agents/server/startup-modes/):
    uv run python -m agent.agent console   # local terminal, no LiveKit needed
    uv run python -m agent.agent dev       # connect to LiveKit Cloud (dev)
    uv run python -m agent.agent start      # production

NOTE: this module imports livekit at load time. It is intentionally NOT imported
by any test. The unit-testable HTTP logic lives in ``agent.tools`` (livekit-free).
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    TurnHandlingOptions,
    function_tool,
    inference,
)
from livekit.agents.llm import ToolError
from livekit.plugins import anthropic

from agent import tools

load_dotenv(".env.local")

logger = logging.getLogger("chatgantt-voice-agent")

AGENT_NAME = "chatgantt-voice-agent"

# Base URL of ChatGantt's REST API that the agent's tools call.
CHATGANTT_API_URL = os.getenv("CHATGANTT_API_URL", "http://localhost:8000")

# Claude model id for the LLM (verified via livekit anthropic plugin docs).
CLAUDE_MODEL = os.getenv("CHATGANTT_CLAUDE_MODEL", "claude-sonnet-4-6")

INSTRUCTIONS = """You are ChatGantt's voice assistant for a software project.
You help the user understand their project and manage blockers by voice.
You reason over the project's tasks and blockers using your tools.
Be conversational and concise — this is a spoken conversation, not a written
report. Say dates and statuses naturally. Avoid any complex formatting,
markdown, asterisks, or emojis. When you create or resolve a blocker, confirm
it back to the user in a single short sentence."""


class ProjectAssistant(Agent):
    """Voice agent whose tools call ChatGantt's REST API.

    The REST headers are derived once from the caller's participant attributes
    and reused for every tool call. The ``@function_tool`` methods are thin
    wrappers that delegate to the livekit-free functions in ``agent.tools``.
    """

    def __init__(self, base_url: str, headers: dict[str, str]) -> None:
        super().__init__(instructions=INSTRUCTIONS)
        self._base_url = base_url
        self._headers = headers

    @function_tool()
    async def get_project_overview(self, context: RunContext) -> str:
        """Summarize the current project: how many tasks, their types, how many
        are done, and a few recent item names. Use this when the user asks about
        the project, its status, or what's going on."""
        try:
            return await tools.get_project_overview(self._base_url, self._headers)
        except tools.ToolError as e:
            raise ToolError(str(e))

    @function_tool()
    async def list_active_blockers(self, context: RunContext) -> str:
        """List the project's currently active blockers. Use this when the user
        asks what is blocked, what's blocking progress, or about blockers."""
        try:
            return await tools.list_active_blockers(self._base_url, self._headers)
        except tools.ToolError as e:
            raise ToolError(str(e))

    @function_tool()
    async def create_blocker(
        self,
        context: RunContext,
        blocked_task_id: str,
        reason: str,
        severity: str = "medium",
    ) -> str:
        """Record a new blocker on a task.

        Args:
            blocked_task_id: The id of the task that is blocked.
            reason: A short description of why the task is blocked.
            severity: One of "low", "medium", or "high". Defaults to "medium".
        """
        # Mutating call — don't let user speech interrupt mid-write.
        context.disallow_interruptions()
        try:
            return await tools.create_blocker(
                self._base_url,
                self._headers,
                blocked_task_id=blocked_task_id,
                reason=reason,
                severity=severity,
            )
        except tools.ToolError as e:
            raise ToolError(str(e))

    @function_tool()
    async def resolve_blocker(self, context: RunContext, blocker_id: str) -> str:
        """Mark an existing blocker as resolved.

        Args:
            blocker_id: The id of the blocker to resolve.
        """
        context.disallow_interruptions()
        try:
            return await tools.resolve_blocker(
                self._base_url, self._headers, blocker_id=blocker_id
            )
        except tools.ToolError as e:
            raise ToolError(str(e))


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    # The browser participant carries the Notion/project config in its
    # attributes (minted into the JWT by POST /api/voice/token).
    participant = await ctx.wait_for_participant()
    attrs = participant.attributes or {}
    project_id = attrs.get("project_id", "")
    notion_token = attrs.get("notion_token", "")
    blockers_source = attrs.get("blockers_source", "")

    if not project_id or not notion_token:
        logger.error(
            "Missing project_id/notion_token in participant attributes for %s",
            participant.identity,
        )

    headers = tools.build_headers(project_id, notion_token, blockers_source)

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=anthropic.LLM(model=CLAUDE_MODEL),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
        ),
    )

    await session.start(
        room=ctx.room,
        agent=ProjectAssistant(base_url=CHATGANTT_API_URL, headers=headers),
    )

    await session.generate_reply(
        instructions="Greet the user briefly and offer to help with their project."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
