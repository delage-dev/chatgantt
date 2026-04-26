from __future__ import annotations

from fastapi import APIRouter

from app.adapters.registry import get_adapter
from app.models.tickets import ConnectionConfig
from app.services import github_config, github_poller

router = APIRouter()


@router.get("/github/status")
async def github_status():
    config = github_config.get_config()
    token = github_config.get_github_token()
    return {
        "enabled": config is not None and token is not None,
        "repos": config.repos if config else [],
        "match_rules_count": len(config.match_rules) if config else 0,
        "last_poll_at": github_poller.get_last_poll_at(),
    }


@router.post("/github/reload-config")
async def reload_config():
    github_config.load_config()
    config = github_config.get_config()
    token = github_config.get_github_token()
    return {
        "enabled": config is not None and token is not None,
        "repos": config.repos if config else [],
    }


@router.post("/github/poll")
async def trigger_poll():
    config = github_config.get_config()
    token = github_config.get_github_token()
    if not config or not token:
        return {"matched": 0, "message": "GitHub integration not configured"}

    adapter = get_adapter("mock")
    connection_config = ConnectionConfig(
        provider="mock", access_token="", base_url="", project_key="DEMO"
    )
    matched = await github_poller.run_poll_cycle(adapter, connection_config)
    return {"matched": matched}
