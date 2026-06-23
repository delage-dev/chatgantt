import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.adapters.registry import get_adapter
from app.middleware.sanitization import SanitizationMiddleware
from app.models.tickets import ConnectionConfig
from app.routers import blockers, chat, github, health, resources, tasks, voice
from app.services import github_config, github_poller

# Load backend/.env for local dev (LIVEKIT_*, ANTHROPIC_API_KEY, etc.).
# No-op in production, where the environment is injected by the platform.
load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="ChatGantt", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SanitizationMiddleware)

app.include_router(health.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(github.router, prefix="/api")
app.include_router(blockers.router, prefix="/api")


async def _github_poll_loop() -> None:
    """Background loop that polls GitHub for PRs every 5 minutes."""
    adapter = get_adapter("mock")
    config = ConnectionConfig(provider="mock", access_token="", base_url="", project_key="DEMO")
    while True:
        try:
            await github_poller.run_poll_cycle(adapter, config)
        except Exception as e:
            logger.warning("GitHub poll error: %s", e)
        await asyncio.sleep(300)


@app.on_event("startup")
async def startup_github() -> None:
    gh_config = github_config.load_config()
    token = github_config.get_github_token()
    if gh_config and token:
        asyncio.create_task(_github_poll_loop())
        logger.info("GitHub polling started")


# In production, serve the built frontend
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.is_dir() and os.getenv("CHATGANTT_ENV") != "dev":
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
